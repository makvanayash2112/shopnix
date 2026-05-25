/**
 * Run: npm run ondc:test-registry
 * Confirms your keys are registered on preprod ONDC registry.
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const { env } = await import("../config/env");
  const { createAuthorizationHeader } = await import("../utils/ondc-crypto");
  const { fetchPublicKey } = await import("../utils/ondc-registry");

  console.log("\n--- ONDC Registry self-test ---\n");
  console.log("Subscriber ID:", env.ondc.subscriberId || "(missing)");
  console.log("Unique Key ID:", env.ondc.uniqueKeyId || "(missing)");
  console.log("Private key set:", Boolean(env.ondc.signingPrivateKey));

  if (!env.ondc.subscriberId || !env.ondc.uniqueKeyId || !env.ondc.signingPrivateKey) {
    console.error("\nFAIL: Set ONDC_SUBSCRIBER_ID, ONDC_UNIQUE_KEY_ID, ONDC_SIGNING_PRIVATE_KEY in .env");
    process.exit(1);
  }

  try {
    const body = JSON.stringify({
      country: env.ondc.country,
      domain: env.ondc.domain,
      subscriber_id: env.ondc.subscriberId,
      unique_key_id: env.ondc.uniqueKeyId,
    });
    await createAuthorizationHeader(body);
    console.log("\nOK: Can build Authorization header (private key valid length)");
  } catch (e) {
    console.error("\nFAIL: Authorization header:", (e as Error).message);
    process.exit(1);
  }

  const selfKey = await fetchPublicKey(
    env.ondc.subscriberId,
    env.ondc.uniqueKeyId
  );

  if (selfKey) {
    console.log("OK: Registry returned your public key (you are registered on preprod)");
  } else {
    console.error(
      "FAIL: Registry lookup failed — complete ONDC portal integration + staging registry before Pramaan"
    );
    process.exit(1);
  }

  console.log("\nDone.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
