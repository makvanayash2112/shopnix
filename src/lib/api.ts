import { getClientApiBase } from "./site-url";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("shopnix_token");
}

export function setToken(token: string) {
  localStorage.setItem("shopnix_token", token);
}

export function clearToken() {
  localStorage.removeItem("shopnix_token");
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const base = getClientApiBase();
  const res = await fetch(`${base}/api${path}`, {
    ...options,
    headers,
  });

  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Server returned an empty response. Redeploy latest code or check Vercel function logs."
        : `Request failed (${res.status}) with empty body`
    );
  }

  let json: { success?: boolean; message?: string; data?: T };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new Error(
      `Invalid JSON from API (${res.status}). Check that /api routes are deployed.`
    );
  }

  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Request failed (${res.status})`);
  }

  return json.data as T;
}

export const API_URL = getClientApiBase();
