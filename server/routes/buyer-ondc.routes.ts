import { Router } from "express";
import { getNetworkGuide } from "../constants/ondc-network";
import { sendSuccess, sendError } from "../utils/response";
import { sendToBpp } from "../services/ondc/bap.service";
import { getCachedCatalog } from "../services/ondc/bap.service";
import { requireAuth, requireBuyer, type AuthRequest } from "../middleware/auth";

const router = Router();

/** ONDC buyer (BAP) registration info — no auth */
router.get("/info", (_req, res) => {
  const guide = getNetworkGuide();
  return sendSuccess(res, {
    role: "BAP (Buyer App)",
    bapId: guide.config.bapId,
    bapUri: guide.config.bapUri,
    bppUri: guide.config.bppUri,
    registrationSteps: guide.registrationSteps,
    bapEndpoints: guide.bapEndpoints.map((e) => ({
      ...e,
      fullUrl: guide.publicEndpoints.bapEndpoints.find((x) => x.path === e.path)?.fullUrl,
    })),
    portalUrl: guide.portalUrl,
    pramaanUrl: guide.pramaanUrl,
    note: "Shopnix /shop works without ONDC. ONDC BAP connects you to the open network.",
  });
});

/** Trigger search on a BPP (testing / network discovery) */
router.post("/discover", async (req, res) => {
  try {
    const { category, bppUri } = req.body as { category?: string; bppUri?: string };
    const result = await sendToBpp(
      "search",
      {
        intent: {
          category: { id: category || "Grocery" },
          fulfillment: { type: "Delivery" },
        },
      },
      bppUri
    );
    return sendSuccess(res, result, 200, "Search sent to seller BPP");
  } catch (err) {
    return sendError(res, "Failed to reach BPP. Check public URL and bppUri.", 502);
  }
});

router.get("/catalog/:transactionId", (req, res) => {
  const catalog = getCachedCatalog(req.params.transactionId);
  if (!catalog) {
    return sendError(res, "Catalog not ready yet. Wait for on_search callback.", 404);
  }
  return sendSuccess(res, catalog);
});

/** Logged-in buyer: discover own store on ONDC (your BPP) */
router.post(
  "/discover-shopnix",
  requireAuth,
  requireBuyer,
  async (_req: AuthRequest, res) => {
    try {
      const guide = getNetworkGuide();
      const result = await sendToBpp(
        "search",
        {
          intent: {
            category: { id: "Grocery" },
            fulfillment: { type: "Delivery" },
          },
        },
        guide.config.bppUri
      );
      return sendSuccess(
        res,
        { ...result, bppUri: guide.config.bppUri },
        200,
        "Search sent to your Shopnix seller (BPP)"
      );
    } catch {
      return sendError(res, "Could not reach your BPP. Is API public via HTTPS?", 502);
    }
  }
);

export default router;
