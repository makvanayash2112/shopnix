/**
 * Probe which registry auth format works: npx tsx server/scripts/probe-registry-auth.ts
 */
import dotenv from "dotenv";
import path from "path";
import axios from "axios";
import sodium from "libsodium-wrappers";
import crypto from "crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const URL = "https://preprod.registry.ondc.org/v2.0/lookup";
const subscriberId = process.env.ONDC_SUBSCRIBER_ID || process.env.ONDC_BPP_ID || "";
const uniqueKeyId = process.env.ONDC_UNIQUE_KEY_ID || "";
const privateKey = process.env.ONDC_SIGNING_PRIVATE_KEY || "";

async function sign(
  signingString: string,
  useFromString: boolean
): Promise<string> {
  await sodium.ready;
  const keyBytes = sodium.from_base64(
    privateKey,
    sodium.base64_variants.ORIGINAL
  );
  const msg = useFromString
    ? sodium.from_string(signingString)
    : signingString;
  const sig = sodium.crypto_sign_detached(msg, keyBytes);
  return sodium.to_base64(sig, sodium.base64_variants.ORIGINAL);
}

async function tryLookup(label: string, header: string, body: string) {
  try {
    const res = await axios.post(URL, body, {
      headers: { "content-type": "application/json", authorization: header },
      timeout: 10000,
      transformRequest: [(d) => d],
    });
    console.log("SUCCESS", label, res.status, JSON.stringify(res.data).slice(0, 200));
    return true;
  } catch (e: unknown) {
    const ax = e as { response?: { status?: number; data?: unknown } };
    console.log("FAIL", label, ax.response?.status, ax.response?.data);
    return false;
  }
}

async function main() {
  if (!subscriberId || !uniqueKeyId || !privateKey) {
    console.error("Set ONDC env in .env");
    process.exit(1);
  }

  await sodium.ready;

  const body = JSON.stringify({
    country: "IND",
    domain: "ONDC:RET10",
    subscriber_id: subscriberId,
    unique_key_id: uniqueKeyId,
  });

  const created = Math.floor(Date.now() / 1000).toString();
  const expires = (parseInt(created, 10) + 3600).toString();

  const blake = sodium.to_base64(
    sodium.crypto_generichash(64, sodium.from_string(body), null),
    sodium.base64_variants.ORIGINAL
  );
  const sha = crypto.createHash("sha256").update(body, "utf8").digest("base64");

  const variants: { label: string; signingString: string; headers: string }[] = [
    {
      label: "official-blake-spaces",
      signingString: `(created): ${created}\n(expires): ${expires}\ndigest: BLAKE-512=${blake}`,
      headers: "(created) (expires) digest",
    },
    {
      label: "registry-blake-nospace-expires",
      signingString: `(created): ${created}\n(expires):${expires}\ndigest:BLAKE-512=${blake}`,
      headers: "(created)(expires)digest",
    },
    {
      label: "sha256-beckn",
      signingString: `(created): ${created}\n(expires): ${expires}\ndigest: SHA-256=${sha}`,
      headers: "(created) (expires) digest",
    },
  ];

  for (const v of variants) {
    for (const useFromString of [false, true]) {
      const sig = await sign(v.signingString, useFromString);
      const header = `Signature keyId="${subscriberId}|${uniqueKeyId}|ed25519",algorithm="ed25519",created="${created}",expires="${expires}",headers="${v.headers}",signature="${sig}"`;
      const ok = await tryLookup(`${v.label}-fromString=${useFromString}`, header, body);
      if (ok) process.exit(0);
    }
  }

  console.log("\nAll variants failed — subscriber likely not on preprod registry v2 lookup whitelist.");
}

main();
