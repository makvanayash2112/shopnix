import sodium from "libsodium-wrappers";
import { env } from "../config/env";

/** Portal-registered public key (from ONDC View Details) — for debug compare only */
const PORTAL_REGISTERED_PUBLIC_KEY =
  "VeKKg8tUxcZ00SB1tvkwYDrZ2VnQ0rQ4c/KyzyBVMMY=";

let envLogged = false;

function mask(value: string, visible = 8): string {
  if (!value) return "(empty)";
  if (value.length <= visible * 2) return "***";
  return `${value.slice(0, visible)}...${value.slice(-visible)} (len=${value.length})`;
}

/** Derive Ed25519 public key from libsodium signing secret key (64 bytes base64) */
export async function deriveSigningPublicKey(
  signingPrivateKeyBase64: string
): Promise<string | null> {
  await sodium.ready;
  try {
    const sk = sodium.from_base64(
      signingPrivateKeyBase64,
      sodium.base64_variants.ORIGINAL
    );
    if (sk.length === 64) {
      return sodium.to_base64(sk.subarray(32), sodium.base64_variants.ORIGINAL);
    }
    if (sk.length === 32) {
      const kp = sodium.crypto_sign_seed_keypair(sk);
      return sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL);
    }
    return null;
  } catch {
    return null;
  }
}

export async function logOndcEnvConfig(reason = "startup"): Promise<void> {
  if (envLogged && reason === "startup") return;
  envLogged = true;

  const subscriberId = env.ondc.subscriberId || env.ondc.bppId;
  const privateKey = env.ondc.signingPrivateKey;
  const envPublic = process.env.ONDC_SIGNING_PUBLIC_KEY || "";
  const derivedPublic = privateKey
    ? await deriveSigningPublicKey(privateKey)
    : null;

  const keysMatchPortal =
    derivedPublic === PORTAL_REGISTERED_PUBLIC_KEY ||
    envPublic === PORTAL_REGISTERED_PUBLIC_KEY;
  const keysMatchEachOther =
    Boolean(derivedPublic && envPublic && derivedPublic === envPublic);

  console.log("\n========== [ONDC-BPP] ENV CONFIG ==========");
  console.log("[ONDC-BPP] reason:", reason);
  console.log("[ONDC-BPP] VERCEL:", process.env.VERCEL ?? "false");
  console.log("[ONDC-BPP] NODE_ENV:", process.env.NODE_ENV ?? "(unset)");
  console.log("[ONDC-BPP] apiBaseUrl:", env.apiBaseUrl);
  console.log("[ONDC-BPP] ONDC_BPP_ID (env raw):", process.env.ONDC_BPP_ID ?? "(unset)");
  console.log("[ONDC-BPP] ONDC_SUBSCRIBER_ID (env raw):", process.env.ONDC_SUBSCRIBER_ID ?? "(unset)");
  console.log("[ONDC-BPP] ONDC_UNIQUE_KEY_ID (env raw):", process.env.ONDC_UNIQUE_KEY_ID ?? "(unset)");
  console.log("[ONDC-BPP] ONDC_SIGNING_PRIVATE_KEY:", mask(privateKey));
  console.log("[ONDC-BPP] ONDC_SIGNING_PUBLIC_KEY (env):", mask(envPublic) || "(unset)");
  console.log("[ONDC-BPP] derived public from private:", derivedPublic ?? "(failed)");
  console.log("[ONDC-BPP] portal registered public:", PORTAL_REGISTERED_PUBLIC_KEY);
  console.log("[ONDC-BPP] resolved subscriberId:", subscriberId || "(MISSING)");
  console.log("[ONDC-BPP] resolved uniqueKeyId:", env.ondc.uniqueKeyId || "(MISSING)");
  console.log("[ONDC-BPP] resolved bppId:", env.ondc.bppId);
  console.log("[ONDC-BPP] resolved bppUri:", env.ondc.bppUri);
  console.log("[ONDC-BPP] domain:", env.ondc.domain);
  console.log("[ONDC-BPP] city:", env.ondc.city);
  console.log("[ONDC-BPP] country:", env.ondc.country);
  console.log(
    "[ONDC-BPP] ONDC_VERIFY_SIGNATURES:",
    process.env.ONDC_VERIFY_SIGNATURES ?? "true (default)"
  );

  if (!subscriberId) {
    console.error("[ONDC-BPP] ERROR: Set ONDC_SUBSCRIBER_ID=shopnix-nine.vercel.app on Vercel");
  }
  if (!env.ondc.uniqueKeyId) {
    console.error(
      "[ONDC-BPP] ERROR: Set ONDC_UNIQUE_KEY_ID=843e59d7-0bcc-4be5-bc5c-aa8c4240beb5 on Vercel"
    );
  }
  if (!privateKey) {
    console.error("[ONDC-BPP] ERROR: ONDC_SIGNING_PRIVATE_KEY is missing on Vercel");
  }
  if (derivedPublic && !keysMatchPortal) {
    console.error(
      "[ONDC-BPP] CRITICAL: Private key does NOT match portal public key!"
    );
    console.error(
      "[ONDC-BPP] Fix: Upload derived public key to ONDC portal OR paste portal private key into Vercel."
    );
    console.error("[ONDC-BPP] derived:", derivedPublic);
    console.error("[ONDC-BPP] portal:  ", PORTAL_REGISTERED_PUBLIC_KEY);
  } else if (keysMatchPortal) {
    console.log("[ONDC-BPP] OK: Signing keys match ONDC portal registration");
  }
  if (envPublic && derivedPublic && !keysMatchEachOther) {
    console.warn(
      "[ONDC-BPP] WARN: ONDC_SIGNING_PUBLIC_KEY env does not match derived key from private"
    );
  }
  console.log("========== [ONDC-BPP] END ENV ==========\n");
}

export function logOndcBpp(tag: string, data?: unknown): void {
  if (data !== undefined) {
    console.log(`[ONDC-BPP] ${tag}`, data);
  } else {
    console.log(`[ONDC-BPP] ${tag}`);
  }
}
