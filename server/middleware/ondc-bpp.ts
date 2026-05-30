// import type { Request, Response, NextFunction } from "express";
// import { OndcLog } from "../models/OndcLog";
// import { buildNackResponse } from "../utils/beckn";
// import { verifyAuthorizationHeader } from "../utils/ondc-crypto";
// import { logOndcEnvConfig, logOndcBpp } from "../utils/ondc-debug";
// import { isPreprodTrustedSearch } from "../utils/ondc-preprod-trust";

// let envBootLogged = false;

// /** Seller (BPP) only — validates Beckn context + gateway signature */
// export async function logOndcBppIncoming(
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) {
//   try {
//     if (!envBootLogged) {
//       envBootLogged = true;
//       await logOndcEnvConfig("first-bpp-request");
//     }

//     if (req.method === "GET" || req.method === "HEAD") {
//       return next();
//     }

//     logOndcBpp(`INCOMING ${req.method} ${req.originalUrl}`);

//     const authHeader = (req.headers.authorization ||
//       req.headers["authorization"]) as string | undefined;
//     const gatewayAuth = (req.headers["x-gateway-authorization"] ||
//       req.headers["X-Gateway-Authorization"]) as string | undefined;

//     logOndcBpp("auth headers", {
//       authorization: Boolean(authHeader),
//       x_gateway_authorization: Boolean(gatewayAuth),
//     });

//     const body = req.body as {
//       context?: {
//         action?: string;
//         transaction_id?: string;
//         bap_id?: string;
//         bpp_id?: string;
//       };
//     };

//     logOndcBpp("context", {
//       action: body?.context?.action,
//       transaction_id: body?.context?.transaction_id,
//       bap_id: body?.context?.bap_id,
//       bpp_id: body?.context?.bpp_id,
//     });

//     if (!body?.context?.action || !body?.context?.transaction_id) {
//       logOndcBpp("NACK: Invalid Beckn context");
//       return res
//         .status(400)
//         .json(buildNackResponse({ message: "Invalid Beckn context" }));
//     }

//     const headerToVerify = authHeader || gatewayAuth;
//     if (!headerToVerify) {
//       logOndcBpp("NACK: Authorization header missing");
//       return res
//         .status(401)
//         .json(buildNackResponse({ message: "Authorization header missing" }));
//     }

//     if (isPreprodTrustedSearch(req)) {
//       OndcLog.create({
//         action: body.context.action,
//         transactionId: body.context.transaction_id,
//         direction: "incoming",
//         payload: body,
//       }).catch((err) => logOndcBpp("OndcLog save failed", err));
//       return next();
//     }

//     const rawBody =
//       (req as { rawBody?: string }).rawBody ||
//       JSON.stringify(req.body ?? {});

//     let verified = false;
//     if (gatewayAuth) {
//       logOndcBpp("verify x-gateway-authorization first");
//       verified = await verifyAuthorizationHeader(gatewayAuth, rawBody);
//     }
//     if (!verified && authHeader && authHeader !== gatewayAuth) {
//       logOndcBpp("verify Authorization header");
//       verified = await verifyAuthorizationHeader(authHeader, rawBody);
//     }

//     if (!verified) {
//       logOndcBpp("NACK: Invalid Authorization Signature");
//       return res
//         .status(401)
//         .json(buildNackResponse({ message: "Invalid Authorization Signature" }));
//     }

//     logOndcBpp("signature OK — proceeding", body.context.action);

//     OndcLog.create({
//       action: body.context.action,
//       transactionId: body.context.transaction_id,
//       direction: "incoming",
//       payload: body,
//     }).catch((err) => logOndcBpp("OndcLog save failed", err));

//     next();
//   } catch (err) {
//     logOndcBpp("middleware ERROR", err);
//     return res
//       .status(500)
//       .json(buildNackResponse({ message: "Internal Server Error" }));
//   }
// }



import type { Request, Response, NextFunction } from "express";
import { OndcLog } from "../models/OndcLog";
import { buildNackResponse } from "../utils/beckn";
import { verifyAuthorizationHeader } from "../utils/ondc-crypto";
import { logOndcEnvConfig, logOndcBpp } from "../utils/ondc-debug";
import { isPreprodTrustedSearch } from "../utils/ondc-preprod-trust";

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
      req.headers["authorization"]) as string | undefined;

    const gatewayAuth = (req.headers["x-gateway-authorization"] ||
      req.headers["X-Gateway-Authorization"]) as string | undefined;

    logOndcBpp("auth headers", {
      authorization: Boolean(authHeader),
      x_gateway_authorization: Boolean(gatewayAuth),
    });

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

    // Allow issue/issue_status actions
    // transaction_id is optional for IGM flows

    const isIgmAction =
      body?.context?.action === "issue" ||
      body?.context?.action === "issue_status";

    if (
      !body?.context?.action ||
      (!body?.context?.transaction_id && !isIgmAction)
    ) {
      logOndcBpp("NACK: Invalid Beckn context");

      return res
        .status(400)
        .json(buildNackResponse({ message: "Invalid Beckn context" }, body?.context));
    }

    const headerToVerify = authHeader || gatewayAuth;

    if (!headerToVerify) {
      logOndcBpp("NACK: Authorization header missing");

      return res
        .status(401)
        .json(
          buildNackResponse({
            message: "Authorization header missing",
          }, body?.context)
        );
    }

    if (isPreprodTrustedSearch(req)) {
      OndcLog.create({
        action: body.context.action,
        transactionId: body.context.transaction_id,
        direction: "incoming",
        payload: body,
      }).catch((err) => logOndcBpp("OndcLog save failed", err));

      return next();
    }

    const rawBody =
      (req as { rawBody?: string }).rawBody ||
      JSON.stringify(req.body ?? {});

    let verified = false;

    if (gatewayAuth) {
      logOndcBpp("verify x-gateway-authorization first");

      verified = await verifyAuthorizationHeader(
        gatewayAuth,
        rawBody
      );
    }

    if (!verified && authHeader && authHeader !== gatewayAuth) {
      logOndcBpp("verify Authorization header");

      verified = await verifyAuthorizationHeader(
        authHeader,
        rawBody
      );
    }

    if (!verified) {
      logOndcBpp("NACK: Invalid Authorization Signature");

      return res
        .status(401)
        .json(
          buildNackResponse({
            message: "Invalid Authorization Signature",
          }, body?.context)
        );
    }

    logOndcBpp(
      "signature OK — proceeding",
      body.context.action
    );

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
      .json(
        buildNackResponse({
          message: "Internal Server Error",
        }, req.body?.context)
      );
  }
}