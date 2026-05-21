import express from "express";
import cors from "cors";
import path from "path";
import apiRoutes from "./routes";
import ondcRoutes from "./routes/ondc.routes";
import ondcGuideRoutes from "./routes/ondc-guide.routes";
import ondcBapRoutes from "./routes/ondc-bap.routes";
import { getSiteUrl } from "./lib/site-url";

export function createApp() {
  const app = express();
  const siteUrl = getSiteUrl();

  const allowedOrigins = [
    "http://localhost:3000",
    siteUrl,
    process.env.NEXT_PUBLIC_APP_URL || "",
    process.env.NEXT_PUBLIC_API_URL || "",
  ].filter(Boolean);

  if (process.env.VERCEL_URL) {
    allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
  }

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use(
    "/uploads",
    express.static(path.join(process.cwd(), "public", "uploads"))
  );

  app.use("/api", apiRoutes);

  /** ONDC registry paths (same domain root — required for Vercel + ONDC portal) */
  app.use("/ondc", ondcRoutes);
  app.use("/ondc", ondcGuideRoutes);
  app.use("/ondc-bap", ondcBapRoutes);

  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("[api error]", err.message);
      res.status(500).json({ success: false, message: err.message });
    }
  );

  return app;
}
