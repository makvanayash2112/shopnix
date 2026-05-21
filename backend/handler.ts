import type { VercelRequest, VercelResponse } from "@vercel/node";
import vercelHandler from "../server/vercel-handler";

export const config = {
  api: { bodyParser: false, externalResolver: true },
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return vercelHandler(
      req as Parameters<typeof vercelHandler>[0],
      res as Parameters<typeof vercelHandler>[1]
    );
  } catch (err) {
    console.error("[backend]", err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message:
          err instanceof Error
            ? err.message
            : "Server error — check MONGODB_URI on Vercel",
      });
    }
  }
}
