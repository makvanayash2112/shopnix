// import type {
//   Request,
//   Response,
//   NextFunction,
// } from "express";

// import { OndcLog } from "../models/OndcLog";

// import { buildNackResponse }
//   from "../utils/beckn";

// import {
//   verifyAuthorizationHeader,
// } from "../utils/ondc-crypto";

// export async function logOndcIncoming(
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) {

//   try {

//     // Skip health checks

//     if (
//       req.method === "GET" ||
//       req.method === "HEAD"
//     ) {
//       return next();
//     }

//     const body = req.body as {
//       context?: {
//         action?: string;
//         transaction_id?: string;
//       };
//     };

//     // Validate Beckn Context FIRST

//     if (
//       !body?.context?.action ||
//       !body?.context?.transaction_id
//     ) {

//       console.error(
//         "[ondc] Invalid Beckn context"
//       );

//       return res
//         .status(400)
//         .json(
//           buildNackResponse({
//             message:
//               "Invalid Beckn context",
//           })
//         );
//     }

//     // Verify Signature

//     const authHeader =
//       req.headers.authorization;

//     const verified =
//       // await verifyAuthorizationHeader(
//       //   authHeader,
//       //   req.body
//       // );

//       await verifyAuthorizationHeader(
//         authHeader,
//         (req as any).rawBody
//       );

//     if (!verified) {

//       console.error(
//         "[ondc] Signature verification failed"
//       );

//       return res
//         .status(401)
//         .json(
//           buildNackResponse({
//             message:
//               "Invalid Authorization Signature",
//           })
//         );
//     }

//     // Async logging (NON BLOCKING)

//     OndcLog.create({
//       action: body.context.action,
//       transactionId:
//         body.context.transaction_id,
//       direction: "incoming",
//       payload: body,
//     }).catch((err) => {

//       console.error(
//         "[ondc-log] Failed",
//         err
//       );

//     });

//     next();

//   } catch (err) {

//     console.error(
//       "[ondc middleware] Error",
//       err
//     );

//     return res
//       .status(500)
//       .json(
//         buildNackResponse({
//           message:
//             "Internal Server Error",
//         })
//       );
//   }
// }

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

    // HEALTH CHECK SKIP

    if (
      req.method === "GET" ||
      req.method === "HEAD"
    ) {
      return next();
    }

    console.log("========== INCOMING HEADERS ==========");
    console.log(req.headers);

    // const authHeader =
    //   req.headers.authorization || req.headers.Authorization || req.headers["x-gateway-authorization"];

    // const authHeader =
    //   req.headers.authorization as string;

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

    // VALIDATE BODY

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

    // CHECK AUTH HEADER

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

    // VERIFY SIGNATURE

    const verified =
      await verifyAuthorizationHeader(
        authHeader,
        (req as any).rawBody
      );

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

    // LOG REQUEST

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