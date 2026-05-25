import { Router } from "express";
import {
  buildAckResponse,
  replyContext,
  type BecknContext,
} from "../utils/beckn";
import { logOndcBppIncoming } from "../middleware/ondc-bpp";
import { postToBap } from "../services/ondc/callback.service";
import { logOndcBpp, deriveSigningPublicKey } from "../utils/ondc-debug";
import { isPreprodTrustSearchEnabled } from "../utils/ondc-preprod-trust";
import {
  buildCatalogMessage,
  getPublishedCatalog,
} from "../services/ondc/catalog.service";
import { getPrimarySeller } from "../services/seller.service";
import {
  buildOrderMessage,
  createOrderFromInit,
  findOrderByTransaction,
  updateOrderStatus,
} from "../services/ondc/order.service";
import { env } from "../config/env";
import { OndcLog } from "../models/OndcLog";

const router = Router();

type BecknBody = {
  context: BecknContext;
  message?: Record<string, unknown>;
};

function ack(res: import("express").Response) {
  return res.status(200).json(buildAckResponse());
}

/** Browser / portal health check — no Beckn body */
router.get("/", (_req, res) => {
  res.json({
    name: "Shopnix ONDC BPP",
    version: "1.0.0",
    bpp_id: env.ondc.bppId,
    bpp_uri: env.ondc.bppUri,
    subscriber_id: env.ondc.subscriberId || env.ondc.bppId,
    unique_key_id: env.ondc.uniqueKeyId || "(not set)",
    status: "active",
    note: "Beckn APIs are POST only — use /ondc/search with JSON body in Postman",
  });
});

/** Masked env check for Vercel logs / browser */
router.get("/debug-env", async (_req, res) => {
  const derived = env.ondc.signingPrivateKey
    ? await deriveSigningPublicKey(env.ondc.signingPrivateKey)
    : null;
  res.json({
    vercel: Boolean(process.env.VERCEL),
    bpp_id: env.ondc.bppId,
    bpp_uri: env.ondc.bppUri,
    subscriber_id: env.ondc.subscriberId || env.ondc.bppId,
    unique_key_id_set: Boolean(env.ondc.uniqueKeyId),
    unique_key_id: env.ondc.uniqueKeyId || null,
    signing_private_key_set: Boolean(env.ondc.signingPrivateKey),
    derived_public_key: derived,
    env_public_key: process.env.ONDC_SIGNING_PUBLIC_KEY || null,
    portal_expected_public: "VeKKg8tUxcZ00SB1tvkwYDrZ2VnQ0rQ4c/KyzyBVMMY=",
    keys_match_portal: derived === "VeKKg8tUxcZ00SB1tvkwYDrZ2VnQ0rQ4c/KyzyBVMMY=",
    preprod_trust_search: isPreprodTrustSearchEnabled(),
    domain: env.ondc.domain,
    city: env.ondc.city,
    country: env.ondc.country,
  });
});

/** Test endpoint to view your catalog exactly as ONDC sees it */
router.get("/test-catalog", async (req, res) => {
  try {
    const { seller, products } = await getPublishedCatalog();
    if (!seller) {
      return res.json({ error: "No seller found in the database!" });
    }
    const message = buildCatalogMessage(seller, products, env.apiBaseUrl);
    res.json({ success: true, productCount: products.length, catalog: message });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Beckn POST — signature + context validation */
router.use(logOndcBppIncoming);

/** Beckn POST routes require valid context in JSON body */

// router.post("/search", async (req, res) => {
//   const body = req.body as BecknBody;
//   try {
//     const { seller, products } = await getPublishedCatalog();
//     if (seller) {
//       const context = replyContext(body.context, "on_search");
//       const message = buildCatalogMessage(seller, products, env.apiBaseUrl);
//       await postToBap(context, "on_search", message);
//     }
//   } catch (err) {
//     console.error("[search] Error:", err);
//   }
//   ack(res);
// });

router.post("/search", async (req, res) => {
  const body = req.body as BecknBody;

  ack(res);

  try {
    logOndcBpp("search ACK sent — building catalog", {
      transaction_id: body.context?.transaction_id,
      bap_id: body.context?.bap_id,
      bap_uri: body.context?.bap_uri,
    });

    const { seller, products } = await getPublishedCatalog();

    logOndcBpp("catalog source", {
      sellerId: seller?._id?.toString(),
      storeName: seller?.storeName,
      productCount: products.length,
    });

    if (!seller) {
      logOndcBpp("search abort: no seller in DB");
      return;
    }

    const context = replyContext(body.context, "on_search");
    const message = buildCatalogMessage(seller, products, env.apiBaseUrl);

    logOndcBpp("posting on_search to buyer", {
      bap_uri: context.bap_uri,
      bpp_id: context.bpp_id,
      products: products.length,
    });

    await postToBap(context, "on_search", message);
  } catch (err) {
    logOndcBpp("search ERROR", err);
  }
});

router.post("/select", async (req, res) => {


  const body = req.body as BecknBody;

  ack(res);
  try {
    console.log("SELECT REQUEST:");
    console.log(JSON.stringify(body, null, 2));
    const order = await findOrderByTransaction(body.context.transaction_id);
    const { seller, products } = await getPublishedCatalog();
    if (seller) {
      const selectItems =
        (body.message?.order as { items?: { id: string }[] })?.items ?? [];

      const matched = products.filter((p) =>
        selectItems.some((i) => i.id === p.ondcItemId)
      );

      const context = replyContext(body.context, "on_select");
      const quoteValue = matched.reduce((s, p) => s + p.price, 0);

      await postToBap(context, "on_select", {
        order: {
          items: matched.map((p) => ({
            id: p.ondcItemId,
            fulfillment_id: "F1",
            quantity: { count: 1 },
          })),
          provider: { id: seller._id.toString() },
          // provider: {
          //   id: seller.ondcProviderId || "SHOPNIX_PROVIDER"
          // },
          quote: {
            price: { currency: "INR", value: String(quoteValue) },
            breakup: matched.map((p) => ({
              title: p.name,
              price: { currency: "INR", value: String(p.price) },
              item: { id: p.ondcItemId },
            })),
          },
          ...(order ? { id: order.orderId } : {}),
        },
      });
    }
  } catch (err) {
    console.error("[select] Error:", err);
  }
});

router.post("/init", async (req, res) => {
  const body = req.body as BecknBody;
   ack(res);
  try {
    console.log("INIT REQUEST:");
    console.log(JSON.stringify(body, null, 2));
    const orderMsg = body.message?.order as {
      items?: { id: string; quantity?: { count?: number } }[];
      billing?: Record<string, unknown>;
    };

    const order = await createOrderFromInit(
      body.context,
      orderMsg?.items ?? [],
      orderMsg?.billing as Record<string, unknown>
    );

    const context = replyContext(body.context, "on_init");
    await postToBap(context, "on_init", buildOrderMessage(order));
  } catch (err) {
    console.error("[init] Error:", err);
  }
});

router.post("/confirm", async (req, res) => {
  const body = req.body as BecknBody;
   ack(res);
  try {
    console.log("CONFIRM REQUEST:");
    console.log(JSON.stringify(body, null, 2));
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (order) {
      order.status = "Accepted";
      order.fulfillment = order.fulfillment || { type: "Delivery" };
      order.fulfillment.state = "Confirmed";
      order.payment.status = "NOT-PAID";
      order.payment.method = "cash";
      order.bapOrderId = (body.message?.order as { id?: string })?.id;
      await order.save();

      const context = replyContext(body.context, "on_confirm");
      await postToBap(context, "on_confirm", buildOrderMessage(order));
    }
  } catch (err) {
    console.error("[confirm] Error:", err);
  }
});

router.post("/status", async (req, res) => {
  const body = req.body as BecknBody;
  ack(res);
  try {
    console.log("========== STATUS REQUEST ==========");
    console.log(JSON.stringify(body, null, 2));
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (order) {
      console.log(`[status] Found order: ${order.orderId}`);
      const context = replyContext(body.context, "on_status");
      await postToBap(context, "on_status", buildOrderMessage(order));
    } else {
      console.log(`[status] No order found for transaction: ${body.context.transaction_id}`);
    }
  } catch (err) {
    console.error("[status] Error:", err);
  }
});

router.post("/cancel", async (req, res) => {
  const body = req.body as BecknBody;
  ack(res);
  try {
    console.log("========== CANCEL REQUEST ==========");
    console.log(JSON.stringify(body, null, 2));
    const order = await updateOrderStatus(
      body.context.transaction_id,
      "Cancelled"
    );
    if (order) {
      console.log(`[cancel] Order cancelled: ${order.orderId}`);
      const context = replyContext(body.context, "on_cancel");
      await postToBap(context, "on_cancel", buildOrderMessage(order));
    } else {
      console.log(`[cancel] No order found to cancel for transaction: ${body.context.transaction_id}`);
    }
  } catch (err) {
    console.error("[cancel] Error:", err);
  }
});

router.post("/update", async (req, res) => {
  const body = req.body as BecknBody;
  ack(res);
  try {
    console.log("========== UPDATE REQUEST ==========");
    console.log(JSON.stringify(body, null, 2));
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (order) {
      console.log(`[update] Found order: ${order.orderId}`);
      const context = replyContext(body.context, "on_update");
      await postToBap(context, "on_update", buildOrderMessage(order));
    } else {
      console.log(`[update] No order found to update for transaction: ${body.context.transaction_id}`);
    }
  } catch (err) {
    console.error("[update] Error:", err);
  }
});

router.post("/track", async (req, res) => {
  const body = req.body as BecknBody;
  ack(res);
  try {
    console.log("========== TRACK REQUEST ==========");
    console.log(JSON.stringify(body, null, 2));
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (order) {
      console.log(`[track] Tracking details for order: ${order.orderId}`);
      const context = replyContext(body.context, "on_track");
      await postToBap(context, "on_track", {
        tracking: {
          url: order.fulfillment?.tracking || `${env.apiBaseUrl}/track/${order.orderId}`,
          status: order.fulfillment?.state || "Pending",
        },
      });
    } else {
      console.log(`[track] No order found for transaction: ${body.context.transaction_id}`);
    }
  } catch (err) {
    console.error("[track] Error:", err);
  }
});

router.post("/rating", (req, res) => {
  ack(res);
});

router.post("/support", async (req, res) => {
  const body = req.body as BecknBody;
  ack(res);
  try {
    console.log("========== SUPPORT REQUEST ==========");
    console.log(JSON.stringify(body, null, 2));
    const seller = await getPrimarySeller();
    if (seller) {
      console.log(`[support] Found primary seller details`);
      const context = replyContext(body.context, "on_support");
      await postToBap(context, "on_support", {
        support: {
          phone: seller.phone || "9999999999",
          email: seller.email,
          uri: env.apiBaseUrl,
        },
      });
    } else {
      console.log(`[support] No primary seller found!`);
    }
  } catch (err) {
    console.error("[support] Error:", err);
  }
});

/** Admin: view ONDC transaction logs */
router.get("/logs", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const logs = await OndcLog.find()
    .sort({ createdAt: -1 })
    .limit(limit);
  res.json({ success: true, data: logs });
});

export default router;
