import sodium from "libsodium-wrappers";
import crypto from "crypto";
import { env } from "../config/env";
import { fetchPublicKey } from "./ondc-registry";

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

export async function verifyAuthorizationHeader(
  authHeader: string | undefined,
  payload: Record<string, unknown>
): Promise<boolean> {

  try {

    await sodium.ready;

    if (!authHeader) {
      console.error(
        "[ondc-crypto] Missing Authorization header"
      );

      return false;
    }

    // Parse Authorization Header

    const keyIdMatch =
      authHeader.match(/keyId="([^"]+)"/);

    const createdMatch =
      authHeader.match(/created="([^"]+)"/);

    const expiresMatch =
      authHeader.match(/expires="([^"]+)"/);

    const signatureMatch =
      authHeader.match(/signature="([^"]+)"/);

    if (
      !keyIdMatch ||
      !createdMatch ||
      !expiresMatch ||
      !signatureMatch
    ) {

      console.error(
        "[ondc-crypto] Invalid auth header format"
      );

      return false;
    }

    const keyId = keyIdMatch[1];

    const created = createdMatch[1];

    const expires = expiresMatch[1];

    const signatureBase64 =
      signatureMatch[1];

    // Check expiry

    const now =
      Math.floor(Date.now() / 1000);

    if (now > Number(expires)) {

      console.error(
        "[ondc-crypto] Signature expired"
      );

      return false;
    }

    // Generate digest

    const body =
      JSON.stringify(payload);

    const digestHash = crypto
      .createHash("sha256")
      .update(body)
      .digest("base64");

    const digest =
      `SHA-256=${digestHash}`;

    // Recreate signing string

    const signingString =
      `(created): ${created}\n` +
      `(expires): ${expires}\n` +
      `digest: ${digest}`;

    // Extract subscriber ID

    const subscriberId =
      keyId.split("|")[0];

    // Fetch public key

    const publicKey =
      await fetchPublicKey(subscriberId);

    if (!publicKey) {

      console.error(
        "[ondc-crypto] Public key not found"
      );

      return false;
    }

    // Verify signature

    const publicKeyBytes =
      sodium.from_base64(
        publicKey,
        sodium.base64_variants.ORIGINAL
      );

    const signatureBytes =
      sodium.from_base64(
        signatureBase64,
        sodium.base64_variants.ORIGINAL
      );

    const verified =
      sodium.crypto_sign_verify_detached(
        signatureBytes,
        signingString,
        publicKeyBytes
      );

    if (!verified) {

      console.error(
        "[ondc-crypto] Signature verification failed"
      );

      return false;
    }

    console.log(
      "[ondc-crypto] Signature verified"
    );

    return true;

  } catch (err) {

    console.error(
      "[ondc-crypto] Verification error",
      err
    );

    return false;
  }
}