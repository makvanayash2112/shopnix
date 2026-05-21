import "server-only";
import type { NextRequest } from "next/server";
import { createRequest, createResponse } from "node-mocks-http";
import type { RequestMethod } from "node-mocks-http";

export async function runExpress(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  let body: Buffer | undefined;

  if (req.method !== "GET" && req.method !== "HEAD") {
    const buf = await req.arrayBuffer();
    if (buf.byteLength > 0) body = Buffer.from(buf);
  }

  const nodeReq = createRequest({
    method: req.method as RequestMethod,
    url: url.pathname + url.search,
    headers: Object.fromEntries(req.headers.entries()),
    body,
  });

  const nodeRes = createResponse();

  const { default: vercelHandler } = await import("../../server/vercel-handler");
  await vercelHandler(
    nodeReq as Parameters<typeof vercelHandler>[0],
    nodeRes as Parameters<typeof vercelHandler>[1]
  );

  const status = nodeRes.statusCode || 200;
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeRes.getHeaders())) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, String(v)));
    } else {
      headers.set(key, String(value));
    }
  }

  const data = nodeRes._getData();
  if (data === undefined || data === null) {
    return new Response(null, { status, headers });
  }
  if (Buffer.isBuffer(data)) {
    return new Response(new Uint8Array(data), { status, headers });
  }
  if (typeof data === "object") {
    return Response.json(data, { status, headers });
  }
  return new Response(String(data), { status, headers });
}
