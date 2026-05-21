import type { Request, Response, NextFunction } from "express";
import { OndcLog } from "../models/OndcLog";
import { buildNackResponse } from "../utils/beckn";

export async function logOndcIncoming(
  req: Request,
  res: Response,
  next: NextFunction
) {
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
