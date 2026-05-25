import type { Request, Response, NextFunction } from "express";
import { OndcLog } from "../models/OndcLog";
import { buildNackResponse } from "../utils/beckn";
import { verifyAuthorizationHeader } from "../utils/ondc-crypto";
import { logOndcEnvConfig, logOndcBpp } from "../utils/ondc-debug";

let envBootLogged = false;

/** Seller (BPP) only — validates Beckn context + gateway signature */
export async function logOndcBppIncoming(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!envBootLogged) {
      envBootLogged = true;
      await logOndcEnvConfig("first-bpp-request");
    }

    if (req.method === "GET" || req.method === "HEAD") {
      return next();
    }

    logOndcBpp(`INCOMING ${req.method} ${req.originalUrl}`);

    const authHeader = (req.headers.authorization ||
      req.headers["authorization"] ||
      req.headers["x-gateway-authorization"] ||
      req.headers["X-Gateway-Authorization"]) as string;

    logOndcBpp("auth header present", Boolean(authHeader));

    const body = req.body as {
      context?: {
        action?: string;
        transaction_id?: string;
        bap_id?: string;
        bpp_id?: string;
      };
    };

    logOndcBpp("context", {
      action: body?.context?.action,
      transaction_id: body?.context?.transaction_id,
      bap_id: body?.context?.bap_id,
      bpp_id: body?.context?.bpp_id,
    });

    if (!body?.context?.action || !body?.context?.transaction_id) {
      logOndcBpp("NACK: Invalid Beckn context");
      return res
        .status(400)
        .json(buildNackResponse({ message: "Invalid Beckn context" }));
    }

    if (!authHeader) {
      logOndcBpp("NACK: Authorization header missing");
      return res
        .status(401)
        .json(buildNackResponse({ message: "Authorization header missing" }));
    }

    const rawBody =
      (req as { rawBody?: string }).rawBody ||
      JSON.stringify(req.body ?? {});

    const verified = await verifyAuthorizationHeader(authHeader, rawBody);

    if (!verified) {
      logOndcBpp("NACK: Invalid Authorization Signature");
      return res
        .status(401)
        .json(buildNackResponse({ message: "Invalid Authorization Signature" }));
    }

    logOndcBpp("signature OK — proceeding", body.context.action);

    OndcLog.create({
      action: body.context.action,
      transactionId: body.context.transaction_id,
      direction: "incoming",
      payload: body,
    }).catch((err) => logOndcBpp("OndcLog save failed", err));

    next();
  } catch (err) {
    logOndcBpp("middleware ERROR", err);
    return res
      .status(500)
      .json(buildNackResponse({ message: "Internal Server Error" }));
  }
}
