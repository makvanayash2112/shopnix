import { getClientApiBase } from "./site-url";

const BUYER_TOKEN_KEY = "shopnix_buyer_token";

export function getBuyerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BUYER_TOKEN_KEY);
}

export function setBuyerToken(token: string) {
  localStorage.setItem(BUYER_TOKEN_KEY, token);
}

export function clearBuyerToken() {
  localStorage.removeItem(BUYER_TOKEN_KEY);
}

export async function buyerFetch<T>(
  path: string,
  options: RequestInit = {},
  auth = false
): Promise<T> {
  const headers: HeadersInit = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  const token = getBuyerToken();
  if (auth && token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const base = getClientApiBase();
  const res = await fetch(`${base}/api/buyer${path}`, {
    ...options,
    headers,
  });

  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Request failed");
  }

  return json.data as T;
}

export async function buyerAuthFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  return buyerFetch<T>(path, options, true);
}

export const API_URL = getClientApiBase();
