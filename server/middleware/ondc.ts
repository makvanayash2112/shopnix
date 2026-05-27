import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { OndcLog } from "../models/OndcLog";

import { buildNackResponse }
  from "../utils/beckn";

import {
  verifyAuthorizationHeader,
} from "../utils/ondc-crypto";

export async function logOndcIncoming(
  req: Request,
  res: Response,
  next: NextFunction
) {

  try {

    if (
      req.method === "GET" ||
      req.method === "HEAD"
    ) {
      return next();
    }

    console.log("========== INCOMING HEADERS ==========");
    console.log(req.headers);

    const authHeader =
      (req.headers.authorization ||
        req.headers["authorization"] || req.headers["X-Gateway-Authorization"] || req.headers.Authorization || req.headers["x-gateway-authorization"]) as string;

    console.log("AUTH HEADER:");
    console.log(authHeader);

    const body = req.body as {
      context?: {
        action?: string;
        transaction_id?: string;
      };
    };

    if (
      !body?.context?.action ||
      !body?.context?.transaction_id
    ) {

      console.error(
        "[ondc] Invalid Beckn context"
      );

      return res
        .status(400)
        .json(
          buildNackResponse({
            message:
              "Invalid Beckn context",
          })
        );
    }

    if (!authHeader) {

      console.error(
        "[ondc] Authorization header missing"
      );

      return res
        .status(401)
        .json(
          buildNackResponse({
            message:
              "Authorization header missing",
          })
        );
    }

    const rawBody =
      (req as { rawBody?: string }).rawBody ||
      JSON.stringify(req.body ?? {});

    const verified = await verifyAuthorizationHeader(authHeader, rawBody);

    if (!verified) {

      console.error(
        "[ondc] Signature verification failed"
      );

      return res
        .status(401)
        .json(
          buildNackResponse({
            message:
              "Invalid Authorization Signature",
          })
        );
    }

    OndcLog.create({
      action: body.context.action,
      transactionId:
        body.context.transaction_id,
      direction: "incoming",
      payload: body,
    }).catch((err) => {

      console.error(
        "[ondc-log] Failed",
        err
      );

    });

    next();

  } catch (err) {

    console.error(
      "[ondc middleware] Error",
      err
    );

    return res
      .status(500)
      .json(
        buildNackResponse({
          message:
            "Internal Server Error",
        })
      );
  }
}
