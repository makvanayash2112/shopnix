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

/** ONDC health / subscriber verification */
router.get("/", (_req, res) => {
  res.json({
    name: "Shopnix ONDC BPP",
    version: "1.0.0",
    bpp_id: env.ondc.bppId,
    bpp_uri: env.ondc.bppUri,
    status: "active",
  });
});

router.post("/search", (req, res) => {
  ack(res);
  const body = req.body as BecknBody;
  setImmediate(async () => {
    const { seller, products } = await getPublishedCatalog();
    if (!seller) return;

    const context = replyContext(body.context, "on_search");
    const message = buildCatalogMessage(seller, products, env.apiBaseUrl);
    await postToBap(context, "on_search", message);
  });
});

router.post("/select", (req, res) => {
  ack(res);
  const body = req.body as BecknBody;
  setImmediate(async () => {
    const order = await findOrderByTransaction(body.context.transaction_id);
    const { seller, products } = await getPublishedCatalog();
    if (!seller) return;

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
  });
});

router.post("/init", (req, res) => {
  ack(res);
  const body = req.body as BecknBody;
  setImmediate(async () => {
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
  });
});

router.post("/confirm", (req, res) => {
  ack(res);
  const body = req.body as BecknBody;
  setImmediate(async () => {
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (!order) return;

    order.status = "Accepted";
    order.fulfillment = order.fulfillment || { type: "Delivery" };
    order.fulfillment.state = "Confirmed";
    order.payment.status = "NOT-PAID";
    order.payment.method = "cash";
    order.bapOrderId = (body.message?.order as { id?: string })?.id;
    await order.save();

    const context = replyContext(body.context, "on_confirm");
    await postToBap(context, "on_confirm", buildOrderMessage(order));
  });
});

router.post("/status", (req, res) => {
  ack(res);
  const body = req.body as BecknBody;
  setImmediate(async () => {
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (!order) return;

    const context = replyContext(body.context, "on_status");
    await postToBap(context, "on_status", buildOrderMessage(order));
  });
});

router.post("/cancel", (req, res) => {
  ack(res);
  const body = req.body as BecknBody;
  setImmediate(async () => {
    const order = await updateOrderStatus(
      body.context.transaction_id,
      "Cancelled"
    );
    if (!order) return;

    const context = replyContext(body.context, "on_cancel");
    await postToBap(context, "on_cancel", buildOrderMessage(order));
  });
});

router.post("/update", (req, res) => {
  ack(res);
  const body = req.body as BecknBody;
  setImmediate(async () => {
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (!order) return;

    const context = replyContext(body.context, "on_update");
    await postToBap(context, "on_update", buildOrderMessage(order));
  });
});

router.post("/track", (req, res) => {
  ack(res);
  const body = req.body as BecknBody;
  setImmediate(async () => {
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (!order) return;

    const context = replyContext(body.context, "on_track");
    await postToBap(context, "on_track", {
      tracking: {
        url: order.fulfillment?.tracking || `${env.apiBaseUrl}/track/${order.orderId}`,
        status: order.fulfillment?.state || "Pending",
      },
    });
  });
});

router.post("/rating", (req, res) => {
  ack(res);
});

router.post("/support", (req, res) => {
  ack(res);
  const body = req.body as BecknBody;
  setImmediate(async () => {
    const seller = await getPrimarySeller();
    const context = replyContext(body.context, "on_support");
    await postToBap(context, "on_support", {
      support: {
        phone: seller.phone || "9999999999",
        email: seller.email,
        uri: env.apiBaseUrl,
      },
    });
  });
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
