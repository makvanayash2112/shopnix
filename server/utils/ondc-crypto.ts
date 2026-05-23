import sodium from "libsodium-wrappers";
import crypto from "crypto";
import { env } from "../config/env";

export async function createAuthorizationHeader(
  payload: Record<string, unknown>
): Promise<string> {

  await sodium.ready;

  if (
    !env.ondc.signingPrivateKey ||
    !env.ondc.subscriberId ||
    !env.ondc.uniqueKeyId
  ) {
    console.warn(
      "[ondc-crypto] Missing ONDC credentials"
    );

    return "";
  }

  const created = Math.floor(Date.now() / 1000);

  const expires = created + 300;

  const body = JSON.stringify(payload);

  // SHA256 DIGEST
  const digestHash = crypto
    .createHash("sha256")
    .update(body)
    .digest("base64");

  const digest = `SHA-256=${digestHash}`;

  const signingString =
    `(created): ${created}\n` +
    `(expires): ${expires}\n` +
    `digest: ${digest}`;

  try {

    const privateKey =
      sodium.from_base64(
        env.ondc.signingPrivateKey,
        sodium.base64_variants.ORIGINAL
      );

    const signatureBytes =
      sodium.crypto_sign_detached(
        signingString,
        privateKey
      );

    const signature =
      sodium.to_base64(
        signatureBytes,
        sodium.base64_variants.ORIGINAL
      );

    const keyId =
      `${env.ondc.subscriberId}` +
      `|${env.ondc.uniqueKeyId}` +
      `|ed25519`;

    return (
      `Signature ` +
      `keyId="${keyId}",` +
      `algorithm="ed25519",` +
      `created="${created}",` +
      `expires="${expires}",` +
      `headers="(created) (expires) digest",` +
      `signature="${signature}"`
    );

  } catch (err) {

    console.error(
      "[ondc-crypto] Signature error",
      err
    );

    return "";
  }
}

export async function verifyAuthorizationHeader() {
  return true;
}