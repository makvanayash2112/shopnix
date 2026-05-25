import sodium from "libsodium-wrappers";
import crypto from "crypto";
import { env } from "../config/env";
import { fetchPublicKey } from "./ondc-registry";
import { getStaticPublicKey } from "./ondc-public-keys";
import { deriveSigningPublicKey, logOndcBpp } from "./ondc-debug";

function createDigest(body: string) {
  const hash = crypto
    .createHash("sha256")
    .update(body, "utf8")
    .digest("base64");
  return `SHA-256=${hash}`;
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

export async function createAuthorizationHeader(body: string): Promise<string> {
  const { subscriberId, uniqueKeyId, privateKey } = assertSigningConfig();

  await sodium.ready;

  const created = Math.floor(Date.now() / 1000);
  const expires = created + 300;
  const digest = createDigest(body);
  const signingString =
    `(created): ${created}\n` +
    `(expires): ${expires}\n` +
    `digest: ${digest}`;

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

  const header = `Signature keyId="${subscriberId}|${uniqueKeyId}|ed25519",algorithm="ed25519",created="${created}",expires="${expires}",headers="(created) (expires) digest",signature="${signature}"`;

  logOndcBpp("createAuthorizationHeader", {
    subscriberId,
    uniqueKeyId,
    created,
    expires,
    digest,
    bodyLength: body.length,
    keyId: `${subscriberId}|${uniqueKeyId}|ed25519`,
  });

  return header;
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

    const digest = createDigest(rawBody);
    const signingString =
      `(created): ${created}\n` +
      `(expires): ${expires}\n` +
      `digest: ${digest}`;

    logOndcBpp("verify incoming", {
      subscriberId,
      uniqueKeyId,
      rawBodyLength: rawBody.length,
      digest,
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
      subscriberId,
      uniqueKeyId,
    });

    const verified = sodium.crypto_sign_verify_detached(
      sodium.from_base64(signature, sodium.base64_variants.ORIGINAL),
      sodium.from_string(signingString),
      sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL)
    );

    logOndcBpp("verify result", { subscriberId, verified });
    return verified;
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
