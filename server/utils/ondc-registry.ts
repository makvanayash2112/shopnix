import axios from "axios";
import { env } from "../config/env";
import { createAuthorizationHeader } from "./ondc-crypto";
import { logOndcBpp } from "./ondc-debug";

const REGISTRY_URL = "https://preprod.registry.ondc.org/v2.0/lookup";

const keyCache = new Map<string, string>();

function cacheKey(subscriberId: string, uniqueKeyId?: string) {
  return `${subscriberId}|${uniqueKeyId ?? ""}`;
}

async function registryLookup(
  payload: Record<string, string>
): Promise<string | null> {
  const body = JSON.stringify(payload);
  const authHeader = await createAuthorizationHeader(body);

  const response = await axios.post(REGISTRY_URL, body, {
    headers: {
      "content-type": "application/json",
      authorization: authHeader,
      accept: "application/json",
    },
    timeout: 15000,
    transformRequest: [(data) => data],
  });

  const data = response.data;
  logOndcBpp("registry lookup OK", {
    payload,
    status: response.status,
    count: Array.isArray(data) ? data.length : 0,
  });

  if (Array.isArray(data) && data.length > 0) {
    const publicKey = data[0]?.signing_public_key as string | undefined;
    if (publicKey) {
      logOndcBpp("registry public key", publicKey);
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

  const attempts: Record<string, string>[] = [
    { ...base, domain: env.ondc.domain },
    { ...base },
  ];

  for (const payload of attempts) {
    logOndcBpp("registry lookup request", { url: REGISTRY_URL, payload });
    try {
      const publicKey = await registryLookup(payload);
      if (publicKey) {
        keyCache.set(ck, publicKey);
        return publicKey;
      }
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      logOndcBpp("registry lookup FAILED", {
        payload,
        status: ax.response?.status,
        data: ax.response?.data,
        message: ax.message,
      });
    }
  }

  logOndcBpp("registry: no signing_public_key found", { subscriberId, uniqueKeyId });
  return null;
}
