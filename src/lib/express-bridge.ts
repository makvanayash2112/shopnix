import "server-only";
import type { NextRequest } from "next/server";

let cachedApp: import("express").Application | null = null;

async function getApp() {
  const { connectDatabase } = await import("../../server/config/database");
  const { createApp } = await import("../../server/app");
  await connectDatabase();
  if (!cachedApp) cachedApp = createApp();
  return cachedApp;
}

const METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;
type HttpMethod = (typeof METHODS)[number];

function toMethod(method: string): HttpMethod {
  const m = method.toLowerCase();
  return METHODS.includes(m as HttpMethod) ? (m as HttpMethod) : "get";
}

export async function runExpress(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname + url.search;

  if (path === "/api/health") {
    return Response.json({ status: "ok", service: "shopnix-api" });
  }

  const supertest = (await import("supertest")).default;
  const app = await getApp();
  const method = toMethod(req.method);
  let agent = supertest(app)[method](path);

  for (const [key, value] of req.headers.entries()) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "connection" || lower === "content-length") {
      continue;
    }
    agent = agent.set(key, value);
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        agent = agent.send(Buffer.from(buf).toString("utf8"));
      } else {
        agent = agent.send(Buffer.from(buf));
      }
    }
  }

  const res = await agent;
  const headers = new Headers();
  for (const [key, value] of Object.entries(res.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else {
      headers.set(key, String(value));
    }
  }

  const body = res.text ?? "";
  return body
    ? new Response(body, { status: res.status, headers })
    : new Response(null, { status: res.status, headers });
}
