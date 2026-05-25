import type { IncomingMessage, ServerResponse } from "http";
import serverless from "serverless-http";
import { createApp } from "./app";
import { connectDatabase } from "./config/database";
import { logOndcEnvConfig } from "./utils/ondc-debug";

type ServerlessHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<unknown>;

declare global {
  // eslint-disable-next-line no-var
  var __shopnixServerless: ServerlessHandler | undefined;
}

export async function getServerlessHandler(): Promise<ServerlessHandler> {
  await connectDatabase();
  await logOndcEnvConfig("vercel-cold-start");

  if (!global.__shopnixServerless) {
    const app = createApp();
    global.__shopnixServerless = serverless(app, {
      binary: ["image/*", "multipart/form-data"],
    }) as ServerlessHandler;
  }

  return global.__shopnixServerless;
}

export default async function vercelHandler(
  req: IncomingMessage,
  res: ServerResponse
) {
  const handler = await getServerlessHandler();
  return handler(req, res);
}
