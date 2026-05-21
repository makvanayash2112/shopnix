import "server-only";
import type { NextRequest } from "next/server";
import { createRequest, createResponse } from "node-mocks-http";
import type { RequestMethod } from "node-mocks-http";
import type { ServerResponse } from "http";
import { createApp } from "../../server/app";
import { connectDatabase } from "../../server/config/database";

type MockResponse = ServerResponse & {
  _getData: () => string | Buffer | object | undefined;
  _getHeaders: () => Record<string, string | number | string[] | undefined>;
};

let cachedApp: ReturnType<typeof createApp> | null = null;

async function getApp() {
  await connectDatabase();
  if (!cachedApp) cachedApp = createApp();
  return cachedApp;
}

function buildFetchResponse(nodeRes: MockResponse): Response {
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
  if (data === undefined || data === null || data === "") {
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

export async function runExpress(req: NextRequest): Promise<Response> {
  const app = await getApp();
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

  const nodeRes = createResponse() as MockResponse;

  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      try {
        resolve(buildFetchResponse(nodeRes));
      } catch (err) {
        reject(err);
      }
    };

    nodeRes.on("finish", done);
    nodeRes.on("close", done);
    nodeRes.on("error", reject);

    try {
      app(nodeReq, nodeRes);
    } catch (err) {
      reject(err);
    }
  });
}
