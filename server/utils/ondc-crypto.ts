import sodium from "libsodium-wrappers";
import crypto from "crypto";
import { env } from "../config/env";
import { fetchPublicKey } from "./ondc-registry";
import { getStaticPublicKey } from "./ondc-public-keys";
import { deriveSigningPublicKey, logOndcBpp } from "./ondc-debug";

type DigestAlgo = "SHA-256" | "BLAKE-512";

/** Matches ONDC reference SDK signing string format */
async function createOndcSigningString(
  message: string,
  created: string,
  expires: string,
  algo: DigestAlgo
): Promise<string> {
  let digestValue: string;
  if (algo === "SHA-256") {
    digestValue = crypto
      .createHash("sha256")
      .update(message, "utf8")
      .digest("base64");
  } else {
    await sodium.ready;
    const hashBytes = sodium.crypto_generichash(
      64,
      sodium.from_string(message),
      null
    );
    digestValue = sodium.to_base64(
      hashBytes,
      sodium.base64_variants.ORIGINAL
    );
  }
  const digestLine = `${algo}=${digestValue}`;
  return `(created): ${created}\n(expires): ${expires}\ndigest: ${digestLine}`;
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

function getSigningKeyBytes(privateKey: string): Uint8Array {
  const keyBytes = sodium.from_base64(
    privateKey,
    sodium.base64_variants.ORIGINAL
  );
  if (keyBytes.length === 64) return keyBytes;
  if (keyBytes.length === 32) {
    return sodium.crypto_sign_seed_keypair(keyBytes).privateKey;
  }
  throw new Error(
    `Invalid ONDC_SIGNING_PRIVATE_KEY length (${keyBytes.length}). Use npm run ondc:keys`
  );
}

/** Sign per ONDC official Node SDK (BLAKE-512 + headers with spaces) */
async function signAuthorization(
  body: string,
  algo: DigestAlgo,
  logTag: string
): Promise<string> {
  const { subscriberId, uniqueKeyId, privateKey } = assertSigningConfig();
  await sodium.ready;

  const created = Math.floor(Date.now() / 1000).toString();
  const expires = (parseInt(created, 10) + 3600).toString();
  const signingString = await createOndcSigningString(
    body,
    created,
    expires,
    algo
  );

  const keyBytes = getSigningKeyBytes(privateKey);
  const signatureBytes = sodium.crypto_sign_detached(
    signingString,
    keyBytes
  );
  const signature = sodium.to_base64(
    signatureBytes,
    sodium.base64_variants.ORIGINAL
  );

  const header = `Signature keyId="${subscriberId}|${uniqueKeyId}|ed25519",algorithm="ed25519",created="${created}",expires="${expires}",headers="(created) (expires) digest",signature="${signature}"`;

  logOndcBpp(logTag, {
    subscriberId,
    uniqueKeyId,
    algo,
    bodyLength: body.length,
  });

  return header;
}

/** Ed25519 sign raw string (vlookup) — no BLAKE digest */
export async function signRawString(stringToSign: string): Promise<string> {
  const { privateKey } = assertSigningConfig();
  await sodium.ready;
  const keyBytes = getSigningKeyBytes(privateKey);
  const sig = sodium.crypto_sign_detached(stringToSign, keyBytes);
  return sodium.to_base64(sig, sodium.base64_variants.ORIGINAL);
}

/** Beckn 1.2 outgoing callbacks — SHA-256 */
export async function createAuthorizationHeader(body: string): Promise<string> {
  return signAuthorization(body, "SHA-256", "createAuthorizationHeader");
}

/** Registry v2.0/lookup — BLAKE-512 (official ONDC SDK format) */
export async function createRegistryAuthorizationHeader(
  body: string
): Promise<string> {
  return signAuthorization(body, "BLAKE-512", "createRegistryAuthorizationHeader");
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

    for (const algo of ["SHA-256", "BLAKE-512"] as DigestAlgo[]) {
      const signingString = await createOndcSigningString(
        rawBody,
        created,
        expires,
        algo
      );
      const verified = sodium.crypto_sign_verify_detached(
        sigBytes,
        signingString,
        pubBytes
      );
      if (verified) {
        logOndcBpp("verify result OK", { subscriberId, algo });
        return true;
      }
    }

    logOndcBpp("verify result FAILED", { subscriberId });
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
