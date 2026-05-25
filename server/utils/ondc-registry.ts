import axios from "axios";
import { env } from "../config/env";
import { createRegistryAuthorizationHeader } from "./ondc-crypto";
import { logOndcBpp } from "./ondc-debug";

const REGISTRY_V2_URL = "https://preprod.registry.ondc.org/v2.0/lookup";
const REGISTRY_LEGACY_URL = "https://preprod.registry.ondc.org/ondc/lookup";

const keyCache = new Map<string, string>();

function cacheKey(subscriberId: string, uniqueKeyId?: string) {
  return `${subscriberId}|${uniqueKeyId ?? ""}`;
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

  const data = response.data;
  logOndcBpp("registry v2 lookup OK", {
    payload,
    status: response.status,
    count: Array.isArray(data) ? data.length : 0,
  });

  if (Array.isArray(data) && data.length > 0) {
    const publicKey = data[0]?.signing_public_key as string | undefined;
    if (publicKey) {
      logOndcBpp("registry v2 public key", publicKey);
      return publicKey;
    }
  }
  return null;
}

/** Deprecated lookup — no auth; fallback when v2 fails */
async function registryLegacyLookup(
  payload: Record<string, string>
): Promise<string | null> {
  const response = await axios.post(REGISTRY_LEGACY_URL, payload, {
    headers: { "content-type": "application/json", accept: "application/json" },
    timeout: 15000,
  });

  const data = response.data;
  logOndcBpp("registry legacy lookup OK", {
    payload,
    status: response.status,
    count: Array.isArray(data) ? data.length : 0,
  });

  if (Array.isArray(data) && data.length > 0) {
    const publicKey = data[0]?.signing_public_key as string | undefined;
    if (publicKey) {
      logOndcBpp("registry legacy public key", publicKey);
      return publicKey;
    }
  }
  return null;
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

  const legacyPayload: Record<string, string> = {
    country: env.ondc.country,
    domain: env.ondc.domain,
    subscriber_id: subscriberId,
  };
  if (uniqueKeyId) {
    legacyPayload.unique_key_id = uniqueKeyId;
  }

  logOndcBpp("registry legacy lookup request", {
    url: REGISTRY_LEGACY_URL,
    payload: legacyPayload,
  });
  try {
    const publicKey = await registryLegacyLookup(legacyPayload);
    if (publicKey) {
      keyCache.set(ck, publicKey);
      return publicKey;
    }
  } catch (err: unknown) {
    const ax = err as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    logOndcBpp("registry legacy lookup FAILED", {
      status: ax.response?.status,
      data: ax.response?.data,
      message: ax.message,
    });
  }

  logOndcBpp("registry: no signing_public_key found", {
    subscriberId,
    uniqueKeyId,
  });
  return null;
}
