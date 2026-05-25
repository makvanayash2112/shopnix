/**
 * Fallback public keys for staging / Pramaan when registry lookup is slow.
 * Add entries from ONDC portal or registry lookup response.
 * Key format: "subscriberId|uniqueKeyId" or "subscriberId"
 */
const STATIC_KEYS: Record<string, string> = {
  "pramaan.ondc.org/beta/preprod/mock/buyer":
    "VeKKg8tUxcZ00SB1tvkwYDrZ2VnQ0rQ4c/KyzyBVMMY=",
  "pp-ondc-buyer.digicraft.ai":
    "VeKKg8tUxcZ00SB1tvkwYDrZ2VnQ0rQ4c/KyzyBVMMY=",
};

export function getStaticPublicKey(
  subscriberId: string,
  uniqueKeyId?: string
): string | null {
  const composite = uniqueKeyId ? `${subscriberId}|${uniqueKeyId}` : "";
  if (composite && STATIC_KEYS[composite]) {
    return STATIC_KEYS[composite];
  }
  return STATIC_KEYS[subscriberId] ?? null;
}
