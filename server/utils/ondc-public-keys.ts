/**
 * Optional override: ONDC_TRUSTED_KEYS_JSON env
 * [{"subscriberId":"...","uniqueKeyId":"...","publicKey":"base64..."}]
 */
function loadEnvTrustedKeys(): Record<string, string> {
  const out: Record<string, string> = {};
  const raw = process.env.ONDC_TRUSTED_KEYS_JSON;
  if (!raw) return out;
  try {
    const arr = JSON.parse(raw) as {
      subscriberId: string;
      uniqueKeyId: string;
      publicKey: string;
    }[];
    for (const row of arr) {
      if (row.subscriberId && row.uniqueKeyId && row.publicKey) {
        out[`${row.subscriberId}|${row.uniqueKeyId}`] = row.publicKey;
      }
    }
  } catch {
    // ignore invalid JSON
  }
  return out;
}

const ENV_TRUSTED = loadEnvTrustedKeys();

export function getStaticPublicKey(
  subscriberId: string,
  uniqueKeyId?: string
): string | null {
  if (!uniqueKeyId) return null;
  const composite = `${subscriberId}|${uniqueKeyId}`;
  return ENV_TRUSTED[composite] ?? null;
}
