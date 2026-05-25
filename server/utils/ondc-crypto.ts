import sodium from "libsodium-wrappers";
import crypto from "crypto";
import { env } from "../config/env";
import { fetchPublicKey } from "./ondc-registry";
import { getStaticPublicKey } from "./ondc-public-keys";
import { deriveSigningPublicKey, logOndcBpp } from "./ondc-debug";

type DigestAlgo = "SHA-256" | "BLAKE-512";

async function createBodyDigest(
  body: string,
  algo: DigestAlgo
): Promise<string> {
  if (algo === "SHA-256") {
    const hash = crypto
      .createHash("sha256")
      .update(body, "utf8")
      .digest("base64");
    return `SHA-256=${hash}`;
  }
  await sodium.ready;
  const hashBytes = sodium.crypto_generichash(
    64,
    sodium.from_string(body),
    null
  );
  const hash = sodium.to_base64(
    hashBytes,
    sodium.base64_variants.ORIGINAL
  );
  return `BLAKE-512=${hash}`;
}

function buildSigningString(
  created: string,
  expires: string,
  digest: string,
  style: "beckn" | "registry"
): string {
  if (style === "registry") {
    return `(created): ${created}\n(expires):${expires}\ndigest:${digest}`;
  }
  return `(created): ${created}\n(expires): ${expires}\ndigest: ${digest}`;
}

function assertSigningConfig() {
  const subscriberId = env.ondc.subscriberId || env.ondc.bppId;
  const uniqueKeyId = env.ondc.uniqueKeyId;
  const privateKey = env.ondc.signingPrivateKey;

  if (!subscriberId) {
    throw new Error(
      "ONDC_SUBSCRIBER_ID or ONDC_BPP_ID is required (use shopnix-nine.vercel.app)"
    );
  }
  if (!uniqueKeyId) {
    throw new Error("ONDC_UNIQUE_KEY_ID is required (from ONDC portal)");
  }
  if (!privateKey) {
    throw new Error("ONDC_SIGNING_PRIVATE_KEY is required");
  }

  return { subscriberId, uniqueKeyId, privateKey };
}

async function signBody(
  body: string,
  options: {
    digestAlgo: DigestAlgo;
    headerStyle: "beckn" | "registry";
    logTag: string;
  }
): Promise<string> {
  const { subscriberId, uniqueKeyId, privateKey } = assertSigningConfig();
  await sodium.ready;

  const created = Math.floor(Date.now() / 1000);
  const expires = created + 300;
  const digest = await createBodyDigest(body, options.digestAlgo);
  const signingString = buildSigningString(
    String(created),
    String(expires),
    digest,
    options.headerStyle
  );

  const keyBytes = sodium.from_base64(
    privateKey,
    sodium.base64_variants.ORIGINAL
  );

  if (keyBytes.length !== 64) {
    throw new Error(
      `Invalid ONDC_SIGNING_PRIVATE_KEY length (${keyBytes.length}). Use npm run ondc:keys`
    );
  }

  const signatureBytes = sodium.crypto_sign_detached(
    sodium.from_string(signingString),
    keyBytes
  );

  const signature = sodium.to_base64(
    signatureBytes,
    sodium.base64_variants.ORIGINAL
  );

  const headersAttr =
    options.headerStyle === "registry"
      ? "(created)(expires)digest"
      : "(created) (expires) digest";

  const header = `Signature keyId="${subscriberId}|${uniqueKeyId}|ed25519",algorithm="ed25519",created="${created}",expires="${expires}",headers="${headersAttr}",signature="${signature}"`;

  logOndcBpp(options.logTag, {
    subscriberId,
    uniqueKeyId,
    digestAlgo: options.digestAlgo,
    headerStyle: options.headerStyle,
    digest,
    bodyLength: body.length,
  });

  return header;
}

/** Beckn protocol 1.2 — SHA-256 (outgoing on_search, etc.) */
export async function createAuthorizationHeader(body: string): Promise<string> {
  return signBody(body, {
    digestAlgo: "SHA-256",
    headerStyle: "beckn",
    logTag: "createAuthorizationHeader (beckn)",
  });
}

/** ONDC registry v2.0/lookup — BLAKE-512 per official docs */
export async function createRegistryAuthorizationHeader(
  body: string
): Promise<string> {
  return signBody(body, {
    digestAlgo: "BLAKE-512",
    headerStyle: "registry",
    logTag: "createRegistryAuthorizationHeader",
  });
}

export async function verifyAuthorizationHeader(
  authHeader: string | undefined,
  rawBody: string
): Promise<boolean> {
  if (process.env.ONDC_VERIFY_SIGNATURES === "false") {
    logOndcBpp("verify SKIPPED (ONDC_VERIFY_SIGNATURES=false)");
    return true;
  }

  try {
    await sodium.ready;

    if (!authHeader) {
      logOndcBpp("verify FAIL: missing auth header");
      return false;
    }

    const keyId = authHeader.match(/keyId="([^"]+)"/)?.[1];
    const created = authHeader.match(/created="([^"]+)"/)?.[1];
    const expires = authHeader.match(/expires="([^"]+)"/)?.[1];
    const signature = authHeader.match(/signature="([^"]+)"/)?.[1];

    if (!keyId || !created || !expires || !signature) {
      logOndcBpp("verify FAIL: invalid auth header format");
      return false;
    }

    const parts = keyId.split("|");
    const subscriberId = parts[0];
    const uniqueKeyId = parts[1];

    if (!subscriberId || !uniqueKeyId) {
      logOndcBpp("verify FAIL: invalid keyId", keyId);
      return false;
    }

    logOndcBpp("verify incoming", {
      subscriberId,
      uniqueKeyId,
      rawBodyLength: rawBody.length,
    });

    const staticKey = getStaticPublicKey(subscriberId, uniqueKeyId);
    const registryKey = staticKey
      ? null
      : await fetchPublicKey(subscriberId, uniqueKeyId);
    const publicKey = staticKey ?? registryKey;
    const keySource = staticKey ? "static" : registryKey ? "registry" : "none";

    if (!publicKey) {
      logOndcBpp("verify FAIL: no public key", {
        subscriberId,
        uniqueKeyId,
        keySource,
      });
      return false;
    }

    logOndcBpp("verify using public key", {
      source: keySource,
      prefix: publicKey.slice(0, 12) + "...",
    });

    const sigBytes = sodium.from_base64(
      signature,
      sodium.base64_variants.ORIGINAL
    );
    const pubBytes = sodium.from_base64(
      publicKey,
      sodium.base64_variants.ORIGINAL
    );

    const attempts: { algo: DigestAlgo; style: "beckn" | "registry" }[] = [
      { algo: "SHA-256", style: "beckn" },
      { algo: "SHA-256", style: "registry" },
      { algo: "BLAKE-512", style: "registry" },
      { algo: "BLAKE-512", style: "beckn" },
    ];

    for (const { algo, style } of attempts) {
      const digest = await createBodyDigest(rawBody, algo);
      const signingString = buildSigningString(created, expires, digest, style);
      const verified = sodium.crypto_sign_verify_detached(
        sigBytes,
        sodium.from_string(signingString),
        pubBytes
      );
      if (verified) {
        logOndcBpp("verify result OK", { subscriberId, algo, style });
        return true;
      }
    }

    logOndcBpp("verify result FAILED (all digest/style attempts)", {
      subscriberId,
    });
    return false;
  } catch (err) {
    logOndcBpp("verify ERROR", err);
    return false;
  }
}

export async function debugOwnSigningKeys(): Promise<void> {
  const pk = env.ondc.signingPrivateKey
    ? await deriveSigningPublicKey(env.ondc.signingPrivateKey)
    : null;
  logOndcBpp("debugOwnSigningKeys", {
    derivedPublic: pk,
    envPublic: process.env.ONDC_SIGNING_PUBLIC_KEY || "(unset)",
  });
}
