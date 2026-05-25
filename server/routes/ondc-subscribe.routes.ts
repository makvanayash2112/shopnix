import { Router } from "express";
import { buildNackResponse } from "../utils/beckn";
import { logOndcBpp } from "../utils/ondc-debug";
import { env } from "../config/env";

const router = Router();

/**
 * ONDC registry calls this during subscribe.
 * Full challenge decrypt needs X25519 + ONDC encryption keys.
 * Set ONDC_ON_SUBSCRIBE_ANSWER for testing, or use reference on_subscribe utility.
 */
router.post("/on_subscribe", async (req, res) => {
  const body = req.body as {
    subscriber_id?: string;
    challenge?: string;
  };

  logOndcBpp("on_subscribe called", {
    subscriber_id: body?.subscriber_id,
    hasChallenge: Boolean(body?.challenge),
  });

  const manualAnswer = process.env.ONDC_ON_SUBSCRIBE_ANSWER;
  if (manualAnswer) {
    return res.json({
      answer: manualAnswer,
    });
  }

  return res.status(501).json(
    buildNackResponse({
      message:
        "Configure on_subscribe: use ONDC reference utility or set ONDC_ON_SUBSCRIBE_ANSWER after decrypting challenge. See docs/SELLER_ONDC_GUIDE.md",
    })
  );
});

/** Health for registry verification path */
router.get("/on_subscribe", (_req, res) => {
  res.json({
    status: "ok",
    bpp_id: env.ondc.bppId,
    note: "POST challenge from registry",
  });
});

export default router;
