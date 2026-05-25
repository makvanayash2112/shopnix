import axios from "axios";
import crypto from "crypto";
import { env } from "../config/env";
import {
  createRegistryAuthorizationHeader,
  signRawString,
} from "./ondc-crypto";
import { logOndcBpp } from "./ondc-debug";

const REGISTRY_V2_URL = "https://preprod.registry.ondc.org/v2.0/lookup";
const REGISTRY_VLOOKUP_URL = "https://preprod.registry.ondc.org/ondc/vlookup";

const keyCache = new Map<string, string>();

function cacheKey(subscriberId: string, uniqueKeyId?: string) {
  return `${subscriberId}|${uniqueKeyId ?? ""}`;
}

function extractPublicKey(data: unknown): string | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as Record<string, unknown>;
  const key =
    (row.signing_public_key as string) ||
    (row.signing_public_key_b64 as string) ||
    null;
  return key || null;
}

async function registryV2Lookup(
  payload: Record<string, string>
): Promise<string | null> {
  const body = JSON.stringify(payload);
  const authHeader = await createRegistryAuthorizationHeader(body);

  const response = await axios.post(REGISTRY_V2_URL, body, {
    headers: {
      "content-type": "application/json",
      authorization: authHeader,
      accept: "application/json",
    },
    timeout: 15000,
    transformRequest: [(data) => data],
  });

  logOndcBpp("registry v2 lookup OK", {
    payload,
    status: response.status,
    count: Array.isArray(response.data) ? response.data.length : 0,
  });

  return extractPublicKey(response.data);
}

/** Preprod vlookup — works when v2 lookup returns 1010 */
async function registryVlookup(
  targetSubscriberId: string,
  type: "gateway" | "buyerApp" | "sellerApp"
): Promise<string | null> {
  const ourId = env.ondc.subscriberId || env.ondc.bppId;
  if (!ourId) return null;

  const search_parameters = {
    country: env.ondc.country,
    domain: env.ondc.domain,
    type,
    city: env.ondc.city,
    subscriber_id: targetSubscriberId,
  };

  const stringToSign = [
    search_parameters.country,
    search_parameters.domain,
    search_parameters.type,
    search_parameters.city,
    search_parameters.subscriber_id,
  ].join("|");

  const signature = await signRawString(stringToSign);
  const payload = {
    sender_subscriber_id: ourId,
    request_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    signature,
    search_parameters,
  };

  logOndcBpp("registry vlookup request", {
    url: REGISTRY_VLOOKUP_URL,
    targetSubscriberId,
    type,
  });

  const response = await axios.post(REGISTRY_VLOOKUP_URL, payload, {
    headers: { "content-type": "application/json", accept: "application/json" },
    timeout: 15000,
  });

  logOndcBpp("registry vlookup OK", {
    status: response.status,
    count: Array.isArray(response.data) ? response.data.length : 0,
  });

  return extractPublicKey(response.data);
}

function guessVlookupType(subscriberId: string): "gateway" | "buyerApp" | "sellerApp" {
  const id = subscriberId.toLowerCase();
  if (id.includes("gateway") || id.includes("gcr.ondc.org")) return "gateway";
  if (id.includes("buyer") || id.includes("bap") || id.includes("pramaan")) {
    return "buyerApp";
  }
  return "sellerApp";
}

export async function fetchPublicKey(
  subscriberId: string,
  uniqueKeyId?: string
): Promise<string | null> {
  const ck = cacheKey(subscriberId, uniqueKeyId);
  const cached = keyCache.get(ck);
  if (cached) {
    logOndcBpp("registry cache hit", { subscriberId, uniqueKeyId });
    return cached;
  }

  const base: Record<string, string> = {
    country: env.ondc.country,
    subscriber_id: subscriberId,
  };
  if (uniqueKeyId) {
    base.unique_key_id = uniqueKeyId;
  }

  const v2Attempts: Record<string, string>[] = [
    { ...base, domain: env.ondc.domain },
    { ...base },
  ];

  for (const payload of v2Attempts) {
    logOndcBpp("registry v2 lookup request", { url: REGISTRY_V2_URL, payload });
    try {
      const publicKey = await registryV2Lookup(payload);
      if (publicKey) {
        keyCache.set(ck, publicKey);
        return publicKey;
      }
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      logOndcBpp("registry v2 lookup FAILED", {
        payload,
        status: ax.response?.status,
        data: ax.response?.data,
        message: ax.message,
      });
    }
  }

  const vlookupTypes: ("gateway" | "buyerApp" | "sellerApp")[] = [
    guessVlookupType(subscriberId),
    "gateway",
    "buyerApp",
  ];

  for (const type of [...new Set(vlookupTypes)]) {
    try {
      const publicKey = await registryVlookup(subscriberId, type);
      if (publicKey) {
        keyCache.set(ck, publicKey);
        return publicKey;
      }
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      logOndcBpp("registry vlookup FAILED", {
        subscriberId,
        type,
        status: ax.response?.status,
        data: ax.response?.data,
        message: ax.message,
      });
    }
  }

  logOndcBpp("registry: no signing_public_key found", {
    subscriberId,
    uniqueKeyId,
  });
  return null;
}
