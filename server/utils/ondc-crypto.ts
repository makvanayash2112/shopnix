import sodium from "libsodium-wrappers";
import { env } from "../config/env";

/**
 * Creates an ONDC compliant Authorization header
 */
export async function createAuthorizationHeader(payload: Record<string, unknown>): Promise<string> {
  await sodium.ready;
  
  if (!env.ondc.signingPrivateKey || !env.ondc.subscriberId) {
    // Return empty if keys not configured (e.g. local dev without keys)
    console.warn("[ondc-crypto] Missing ONDC_SIGNING_PRIVATE_KEY or ONDC_SUBSCRIBER_ID. Skipping signature.");
    return "";
  }

  const created = Math.floor(Date.now() / 1000);
  const expires = created + 3000; // 50 mins validity

  // Stringify exactly as it will be sent
  const bodyString = JSON.stringify(payload);
  
  // Blake2b hash of the body string
  const hash = sodium.crypto_generichash(64, bodyString);
  const digest = sodium.to_base64(hash, sodium.base64_variants.ORIGINAL);

  const signatureString = `(created): ${created}\n(expires): ${expires}\ndigest: BLAKE-512=${digest}`;
  
  try {
    const privateKeyBase64 = env.ondc.signingPrivateKey;
    const privateKey = sodium.from_base64(privateKeyBase64, sodium.base64_variants.ORIGINAL);
    
    const signatureBytes = sodium.crypto_sign_detached(signatureString, privateKey);
    const signatureBase64 = sodium.to_base64(signatureBytes, sodium.base64_variants.ORIGINAL);

    // Using BPP ID if this is an outgoing BPP call, or subscriber ID. ONDC recommends unique ID per role if possible, but subscriberId is the main one.
    // In Beckn, keyId format is typically: subscriber_id|unique_key_id|algorithm
    // The unique_key_id is specified during portal registration (often the same as subscriber_id or with a -key suffix)
    // For simplicity, we use the subscriber ID here as the key ID.
    const keyId = `${env.ondc.subscriberId}|${env.ondc.subscriberId}|ed25519`;
    
    return `Signature keyId="${keyId}",algorithm="ed25519",created="${created}",expires="${expires}",headers="(created) (expires) digest",signature="${signatureBase64}"`;
  } catch (err) {
    console.error("[ondc-crypto] Error creating signature:", err);
    return "";
  }
}

/**
 * Verifies an incoming ONDC Authorization header
 * (Note: Production requires fetching the public key from the ONDC registry using keyId)
 */
export async function verifyAuthorizationHeader(authHeader: string | undefined, payload: Record<string, unknown>): Promise<boolean> {
  await sodium.ready;
  
  if (!authHeader) {
    // In strict production, return false. Allowing for dev mode if keys not set.
    if (!env.ondc.signingPrivateKey) return true;
    return false;
  }

  // Parse header
  const signatureMatch = authHeader.match(/signature="([^"]+)"/);
  if (!signatureMatch) return false;

  // In a full implementation, you would:
  // 1. Parse keyId from header
  // 2. Lookup public key from ONDC registry (/lookup API)
  // 3. Verify the digest matches the body
  // 4. Verify the signature against the public key
  
  // For this scope, we validate that the header is well-formed.
  return true;
}
