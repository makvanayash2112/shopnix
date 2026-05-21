import type { VercelRequest, VercelResponse } from "@vercel/node";
import vercelHandler from "../server/vercel-handler";

export const config = {
  api: { bodyParser: false, externalResolver: true },
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return vercelHandler(
    req as Parameters<typeof vercelHandler>[0],
    res as Parameters<typeof vercelHandler>[1]
  );
}
