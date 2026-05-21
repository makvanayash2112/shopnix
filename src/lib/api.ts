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

  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new Error(json.message || "Request failed");
  }

  return json.data as T;
}

export const API_URL = getClientApiBase();
