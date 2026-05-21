import { Router } from "express";
import {
  buildBapAck,
  cacheOnSearch,
  getCachedCatalog,
  sendToBpp,
} from "../services/ondc/bap.service";
import { logOndcIncoming } from "../middleware/ondc";
import { env } from "../config/env";
import type { BecknContext } from "../utils/beckn";
import { sendSuccess } from "../utils/response";

const router = Router();

type BecknBody = {
  context: BecknContext;
  message?: Record<string, unknown>;
};

router.get("/", (_req, res) => {
  res.json({
    name: "Shopnix ONDC BAP (Buyer)",
    bap_id: env.ondc.bapId,
    bap_uri: env.ondc.bapUri,
    bpp_uri: env.ondc.bppUri,
    payment: "cash-on-delivery only",
  });
});

router.use(logOndcIncoming);

function ack(res: import("express").Response) {
  return res.status(200).json(buildBapAck());
}

/** BAP receives callbacks from BPP / network */
router.post("/on_search", (req, res) => {
  ack(res);
  const body = req.body as BecknBody;
  if (body.message) {
    cacheOnSearch(body.context.transaction_id, body.message);
  }
});

router.post("/on_select", (req, res) => ack(res));
router.post("/on_init", (req, res) => ack(res));
router.post("/on_confirm", (req, res) => ack(res));
router.post("/on_status", (req, res) => ack(res));
router.post("/on_cancel", (req, res) => ack(res));
router.post("/on_track", (req, res) => ack(res));

export default router;
