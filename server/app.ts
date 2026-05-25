import express from "express";
import cors from "cors";
import path from "path";
import apiRoutes from "./routes";
import ondcRoutes from "./routes/ondc.routes";
import ondcSubscribeRoutes from "./routes/ondc-subscribe.routes";
import ondcGuideRoutes from "./routes/ondc-guide.routes";
import ondcBapRoutes from "./routes/ondc-bap.routes";
import { getSiteUrl } from "./lib/site-url";
import { logOndcEnvConfig } from "./utils/ondc-debug";

export function createApp() {
  const app = express();
  const siteUrl = getSiteUrl();
  void logOndcEnvConfig("express-app-create");

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

  // app.use(express.json({ limit: "2mb" }));
  app.use(
    express.json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf.toString("utf8");
      },
      limit: "2mb",
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Global Request & Response Logger (Logs all steps, payloads, success/errors for ALL APIs)
  app.use((req, res, next) => {
    const startTime = Date.now();
    console.log(`\n================== [API REQUEST] ${req.method} ${req.originalUrl} ==================`);
    if (Object.keys(req.body || {}).length > 0) {
      console.log(`[INCOMING PAYLOAD]:\n`, JSON.stringify(req.body, null, 2));
    } else if (Object.keys(req.query || {}).length > 0) {
      console.log(`[INCOMING QUERY]:\n`, JSON.stringify(req.query, null, 2));
    }

    // Intercept response to log it
    const originalSend = res.send;
    res.send = function (body) {
      console.log(`\n[API RESPONSE] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Time: ${Date.now() - startTime}ms`);
      if (res.statusCode >= 400) {
        console.error(`[API ERROR RESPONSE]:`);
      }
      try {
        const parsed = typeof body === "string" ? JSON.parse(body) : body;
        console.log(`[RESPONSE PAYLOAD]:\n`, JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log(`[RESPONSE PAYLOAD]:\n`, body);
      }
      return originalSend.call(this, body);
    };
    next();
  });

  app.use(
    "/uploads",
    express.static(path.join(process.cwd(), "public", "uploads"))
  );

  app.use("/api", apiRoutes);

  /** ONDC registry paths (same domain root — required for Vercel + ONDC portal) */
  /** Seller (BPP) only — buyer BAP routes disabled unless ONDC_ENABLE_BAP=true */
  app.use("/ondc", ondcSubscribeRoutes);
  app.use("/ondc", ondcRoutes);
  app.use("/ondc", ondcGuideRoutes);
  if (process.env.ONDC_ENABLE_BAP === "true") {
    app.use("/ondc-bap", ondcBapRoutes);
    console.log("[ONDC] BAP routes enabled (ONDC_ENABLE_BAP=true)");
  } else {
    console.log("[ONDC] Seller-only mode: /ondc-bap not mounted");
  }

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
