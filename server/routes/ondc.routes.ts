import { Router } from "express";
import {
  buildAckResponse,
  replyContext,
  type BecknContext,
} from "../utils/beckn";
import { logOndcIncoming } from "../middleware/ondc";
import { postToBap } from "../services/ondc/callback.service";
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

router.use(logOndcIncoming);


type BecknBody = {
  context: BecknContext;
  message?: Record<string, unknown>;
};

function ack(res: import("express").Response) {
  return res.status(200).json(buildAckResponse());
}

/** Browser / portal health check — no Beckn body (must be before logOndcIncoming) */
router.get("/", (_req, res) => {
  res.json({
    name: "Shopnix ONDC BPP",
    version: "1.0.0",
    bpp_id: env.ondc.bppId,
    bpp_uri: env.ondc.bppUri,
    status: "active",
    note: "Beckn APIs are POST only — use /ondc/search with JSON body in Postman",
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

  // IMPORTANT: ACK immediately
  ack(res);

  try {
    console.log("========== SEARCH REQUEST ==========");
    console.log(JSON.stringify(body, null, 2));

    const { seller, products } = await getPublishedCatalog();

    console.log("SELLER:", seller);
    console.log("TOTAL PRODUCTS:", products.length);

    if (!seller) {
      console.log("NO SELLER FOUND");
      return;
    }

    const context = replyContext(body.context, "on_search");

    console.log("REPLY CONTEXT:");
    console.log(JSON.stringify(context, null, 2));

    const message = buildCatalogMessage(
      seller,
      products,
      env.apiBaseUrl
    );

    console.log("CATALOG MESSAGE:");
    console.log(JSON.stringify(message, null, 2));

    console.log("CALLING BAP CALLBACK...");

    const response = await postToBap(
      context,
      "on_search",
      message
    );

    console.log("BAP CALLBACK SUCCESS");
    console.log(response);
  } catch (err) {
    console.error("SEARCH ERROR:");
    console.error(err);
  }
});

router.post("/select", async (req, res) => {

  const body = req.body as BecknBody;


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
  ack(res);
});

router.post("/init", async (req, res) => {
  const body = req.body as BecknBody;
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
  ack(res);
});

router.post("/confirm", async (req, res) => {
  const body = req.body as BecknBody;
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
  ack(res);
});

router.post("/status", async (req, res) => {
  const body = req.body as BecknBody;
  try {
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (order) {
      const context = replyContext(body.context, "on_status");
      await postToBap(context, "on_status", buildOrderMessage(order));
    }
  } catch (err) {
    console.error("[status] Error:", err);
  }
  ack(res);
});

router.post("/cancel", async (req, res) => {
  const body = req.body as BecknBody;
  try {
    const order = await updateOrderStatus(
      body.context.transaction_id,
      "Cancelled"
    );
    if (order) {
      const context = replyContext(body.context, "on_cancel");
      await postToBap(context, "on_cancel", buildOrderMessage(order));
    }
  } catch (err) {
    console.error("[cancel] Error:", err);
  }
  ack(res);
});

router.post("/update", async (req, res) => {
  const body = req.body as BecknBody;
  try {
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (order) {
      const context = replyContext(body.context, "on_update");
      await postToBap(context, "on_update", buildOrderMessage(order));
    }
  } catch (err) {
    console.error("[update] Error:", err);
  }
  ack(res);
});

router.post("/track", async (req, res) => {
  const body = req.body as BecknBody;
  try {
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (order) {
      const context = replyContext(body.context, "on_track");
      await postToBap(context, "on_track", {
        tracking: {
          url: order.fulfillment?.tracking || `${env.apiBaseUrl}/track/${order.orderId}`,
          status: order.fulfillment?.state || "Pending",
        },
      });
    }
  } catch (err) {
    console.error("[track] Error:", err);
  }
  ack(res);
});

router.post("/rating", (req, res) => {
  ack(res);
});

router.post("/support", async (req, res) => {
  const body = req.body as BecknBody;
  try {
    const seller = await getPrimarySeller();
    const context = replyContext(body.context, "on_support");
    await postToBap(context, "on_support", {
      support: {
        phone: seller.phone || "9999999999",
        email: seller.email,
        uri: env.apiBaseUrl,
      },
    });
  } catch (err) {
    console.error("[support] Error:", err);
  }
  ack(res);
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
