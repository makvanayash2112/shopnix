/** Browser / SSR API base — empty = same origin (Vercel production). */
export function getClientApiBase(): string {
  const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (publicApi) {
    return publicApi.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return "";
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
