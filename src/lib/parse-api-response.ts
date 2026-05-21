export async function parseApiJson<T>(res: Response): Promise<{
  ok: boolean;
  json: { success?: boolean; message?: string; data?: T };
}> {
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";

  if (!text.trim()) {
    throw new Error(
      res.status === 504
        ? "API timed out (504). Check MONGODB_URI on Vercel and redeploy latest code."
        : `Empty response (${res.status})`
    );
  }

  if (!contentType.includes("application/json")) {
    throw new Error(
      res.status === 504
        ? "API timed out. Check Vercel logs and MongoDB Atlas."
        : text.slice(0, 120)
    );
  }

  try {
    return { ok: res.ok, json: JSON.parse(text) as { success?: boolean; message?: string; data?: T } };
  } catch {
    throw new Error(`Invalid JSON (${res.status}): ${text.slice(0, 80)}`);
  }
}
