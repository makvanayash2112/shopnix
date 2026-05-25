/**
 * Optional fallback public keys when registry lookup is unavailable.
 * Format: "subscriberId|uniqueKeyId" → base64 public key (NEVER use your own BPP key here).
 */
const STATIC_KEYS: Record<string, string> = {
  // Add only verified third-party keys, e.g.:
  // "pramaan.ondc.org/beta/preprod/mock/buyer|df0b5672-27f0-42c4-90b5-9138e3c45a79": "<their-public-key>",
};

export function getStaticPublicKey(
  subscriberId: string,
  uniqueKeyId?: string
): string | null {
  if (!uniqueKeyId) return null;
  const composite = `${subscriberId}|${uniqueKeyId}`;
  return STATIC_KEYS[composite] ?? null;
}
