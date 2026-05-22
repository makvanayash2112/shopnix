import type { Request, Response, NextFunction } from "express";
import { OndcLog } from "../models/OndcLog";
import { buildNackResponse } from "../utils/beckn";
import { verifyAuthorizationHeader } from "../utils/ondc-crypto";

export async function logOndcIncoming(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.method === "GET" || req.method === "HEAD") {
    return next();
  }

  const authHeader = req.headers.authorization;
  const isVerified = await verifyAuthorizationHeader(authHeader, req.body);
  
  if (!isVerified) {
    return res.status(401).json(buildNackResponse({ message: "Invalid Authorization Signature" }));
  }

  const body = req.body as {
    context?: { action?: string; transaction_id?: string };
  };

  if (body?.context?.action && body?.context?.transaction_id) {
    await OndcLog.create({
      action: body.context.action,
      transactionId: body.context.transaction_id,
      direction: "incoming",
      payload: body,
    }).catch(() => undefined);
  }

  if (!body?.context?.action || !body?.context?.transaction_id) {
    return res.status(400).json(buildNackResponse({ message: "Invalid Beckn context" }));
  }

  next();
}
