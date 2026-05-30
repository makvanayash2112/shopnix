import { Router } from "express";
import {
  buildAckResponse,
  replyContext,
  type BecknContext,
} from "../utils/beckn";
import { logOndcBppIncoming } from "../middleware/ondc-bpp";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { postToBap } from "../services/ondc/callback.service";
import { logOndcBpp, deriveSigningPublicKey } from "../utils/ondc-debug";
import { isPreprodTrustSearchEnabled } from "../utils/ondc-preprod-trust";
import { ackAfterWork } from "../utils/ondc-async";
import {
  buildSelectMessage,
  buildOrderMessage,
} from "../services/ondc/order-payload";
import {
  buildCatalogMessage,
  getNetworkCatalogEntries,
  buildMultiSellerCatalogMessage,
  filterProductsForOndcSearch,
  getPublishedCatalog,
  useMsnCatalog,
} from "../services/ondc/catalog.service";
import { getPrimarySeller } from "../services/seller.service";
import { Product } from "../models/Product";
import { Seller } from "../models/Seller";
import {
  createOrderFromInit,
  findOrderByTransaction,
  reserveOrderInventory,
  partialCancelOrder,
  merchantFullCancelOrder,
  processReturnRequest,
  createOrUpdateIgmIssue,
} from "../services/ondc/order.service";
import { env } from "../config/env";
import { OndcLog } from "../models/OndcLog";

const router = Router();

type BecknBody = {
  context: BecknContext;
  message?: Record<string, unknown>;
};

type BecknSelectedItem = {
  id: string;
  quantity?: { count?: number };
};

type BecknOrderMessage = {
  billing?: {
    created_at?: string;
    updated_at?: string;
  };
  created_at?: string;
  updated_at?: string;
};

function selectedQuantity(item: BecknSelectedItem): number {
  return Math.max(1, Number(item.quantity?.count ?? 1));
}

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

/** Pramaan health: GET /ondc/search is not Beckn — use POST */
router.get("/search", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "ONDC search is POST only. Pramaan sends POST /ondc/search with Beckn JSON body.",
    bpp_uri: env.ondc.bppUri,
    method: "POST",
  });
});

/** Preview catalog (add ?mode=pramaan for grocery-only like live search) */
router.get("/test-catalog", async (req, res) => {
  try {
    const pramaanMode = req.query.mode === "pramaan";
    const msn = useMsnCatalog();
    let resolved: Awaited<ReturnType<typeof getNetworkCatalogEntries>> = [];
    if (msn) {
      resolved = await getNetworkCatalogEntries();
    } else {
      const seller = await getPrimarySeller();
      if (seller) {
        let { products } = await getPublishedCatalog(seller._id.toString());
        if (pramaanMode) {
          products = filterProductsForOndcSearch(
            products,
            "pramaan.ondc.org/beta/preprod/mock/buyer",
            "ONDC:RET10"
          );
        }
        resolved = [{ seller, products }];
      }
    }
    if (pramaanMode && msn) {
      resolved = resolved
        .map((e) => ({
          seller: e.seller,
          products: filterProductsForOndcSearch(
            e.products,
            "pramaan.ondc.org/beta/preprod/mock/buyer",
            "ONDC:RET10"
          ),
        }))
        .filter((e) => e.products.length > 0);
    }
    const message = msn
      ? buildMultiSellerCatalogMessage(resolved, env.apiBaseUrl, undefined, "MSN")
      : resolved[0]
        ? buildCatalogMessage(
          resolved[0].seller,
          resolved[0].products,
          env.apiBaseUrl,
          "SNP"
        )
        : { catalog: {} };
    const totalProducts = resolved.reduce((n, e) => n + e.products.length, 0);
    res.json({
      success: true,
      catalogMode: msn ? "MSN" : "SNP",
      pramaanMode,
      sellerCount: resolved.length,
      productCount: totalProducts,
      note: "Pramaan on_search uses same message_id as search — fixed in replyContext",
      catalog: message,
    });
  } catch (err: unknown) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "catalog error",
    });
  }
});

// ADD after the /test-catalog route but BEFORE router.use(logOndcBppIncoming):
router.get("/catalog/incremental", async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 3600000);
    const { products } = await getPublishedCatalog();
    const updatedProducts = products
      ? (products as import("../models/Product").IProduct[]).filter(
        p => p.updatedAt > since
      )
      : [];
    res.json({
      success: true,
      count: updatedProducts.length,
      since: since.toISOString(),
      products: updatedProducts,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Flow 8C: Incremental Push — BPP proactively pushes updated catalog to gateway
router.post("/catalog/push", async (req, res) => {
  try {
    const seller = await getPrimarySeller();
    if (!seller) return res.status(404).json({ error: "No seller" });

    const { products } = await getPublishedCatalog(seller._id.toString());

    // Increment push sequence
    // In production you'd push to gateway subscribers
    const seq = Date.now();
    res.json({
      success: true,
      message: "Catalog push triggered",
      sequence: seq,
      productCount: products.length,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});


/** Beckn POST — signature + context validation */
router.use(logOndcBppIncoming);

router.post("/search", async (req, res) => {
  const body = req.body as BecknBody;

  await ackAfterWork(res, "search", async () => {
    logOndcBpp("search — building catalog", {
      transaction_id: body.context?.transaction_id,
      bap_id: body.context?.bap_id,
      bap_uri: body.context?.bap_uri,
    });

    const msn = useMsnCatalog();
    let entries: Awaited<ReturnType<typeof getNetworkCatalogEntries>>;
    const npType: "SNP" | "MSN" = msn ? "MSN" : "SNP";

    if (msn) {
      entries = await getNetworkCatalogEntries();
    } else {
      const seller = await getPrimarySeller();
      if (!seller) {
        logOndcBpp("search abort: no primary seller");
        return;
      }
      const { products: raw } = await getPublishedCatalog(seller._id.toString());
      const products = filterProductsForOndcSearch(
        raw,
        body.context?.bap_id,
        body.context?.domain
      );
      entries = [{ seller, products }];
    }

    entries = entries
      .map((e) => ({
        seller: e.seller,
        products: filterProductsForOndcSearch(
          e.products,
          body.context?.bap_id,
          body.context?.domain
        ),
      }))
      .filter((e) => e.products.length > 0);

    const totalProducts = entries.reduce((n, e) => n + e.products.length, 0);

    logOndcBpp("network catalog", {
      mode: npType,
      sellers: entries.map((e) => ({
        store: e.seller.storeName,
        providerId: e.seller.ondcProviderId,
        products: e.products.length,
      })),
      totalProducts,
    });

    if (entries.length === 0 || totalProducts === 0) {
      logOndcBpp(
        "search abort: no published products — sellers must register and publish products"
      );
      return;
    }

    const context = replyContext(body.context, "on_search");
    logOndcBpp("on_search context ids", {
      transaction_id: context.transaction_id,
      message_id: context.message_id,
      search_message_id: body.context?.message_id,
      ids_match: context.message_id === body.context?.message_id,
    });
    const message = msn
      ? buildMultiSellerCatalogMessage(entries, env.apiBaseUrl, undefined, "MSN")
      : buildCatalogMessage(
        entries[0].seller,
        entries[0].products,
        env.apiBaseUrl,
        "SNP"
      );

    logOndcBpp("posting on_search", {
      url: `${context.bap_uri?.replace(/\/$/, "")}/on_search`,
      bpp_id: context.bpp_id,
      np_type: npType,
      sellers: entries.length,
      products: totalProducts,
    });

    const result = await postToBap(context, "on_search", message);
    if (!result) {
      throw new Error("on_search POST failed — check Vercel logs for outgoing on_search FAILED");
    }
  });
});

router.post("/select", async (req, res) => {
  const body = req.body as BecknBody;

  await ackAfterWork(res, "select", async () => {
    const providerId =
      (body.message?.order as {
        provider?: { id?: string };
      })?.provider?.id;

    const selectItems =
      (body.message?.order as {
        items?: BecknSelectedItem[];
      })?.items || [];

    if (!providerId) {
      throw new Error("provider.id is required");
    }

    const seller = await Seller.findOne({
      ondcProviderId: providerId,
      "ondc.isActive": true,
    });

    if (!seller) {
      throw new Error(
        `Seller not found: ${providerId}`
      );
    }

    const products = await Product.find({
      sellerId: seller._id,
      isPublished: true,
      quantity: { $gt: 0 },
    });

    const matched = products.filter((p) =>
      selectItems.some(
        (i) => i.id === p.ondcItemId
      )
    );

    if (matched.length !== selectItems.length) {
      throw new Error(
        "Some selected items not found"
      );
    }

    for (const product of matched) {
      const selected = selectItems.find(
        (i) => i.id === product.ondcItemId
      )!;

      const qty = selectedQuantity(selected);

      // if (product.quantity < qty) {
      //   throw new Error(
      //     `Insufficient stock for ${product.name}`
      //   );
      // }
      // INSIDE the select handler, REPLACE the "Insufficient stock" throw with:
      if (product.quantity < qty) {
        // Flow 5: Out of Stock — post on_select with error, then ACK
        const context = replyContext(body.context, "on_select");
        await postToBap(context, "on_select", {
          order: {
            provider: { id: providerId },
            items: [],
            error: {
              type: "DOMAIN-ERROR",
              code: "40002",
              path: `message/order/items/${product.ondcItemId}`,
              message: `${product.name} is out of stock`,
            },
          },
        });
        throw new Error(`Out of stock: ${product.name} — on_select error sent`);
      }

    }

    const context = replyContext(
      body.context,
      "on_select"
    );

    const existingOrder =
      await findOrderByTransaction(
        body.context.transaction_id
      );

    const message = buildSelectMessage(
      seller,
      matched,
      selectItems,
      existingOrder?.orderId
    );

    await postToBap(
      context,
      "on_select",
      message
    );
  });
});

router.post("/init", async (req, res) => {
  const body = req.body as BecknBody;

  await ackAfterWork(res, "init", async () => {
    const orderMsg = body.message?.order as {
      provider?: { id?: string };

      items?: {
        id: string;
        quantity?: { count?: number };
      }[];

      billing?: Record<string, unknown>;
    };

    const order = await createOrderFromInit(
      body.context,
      orderMsg?.items || [],
      orderMsg?.billing,
      orderMsg?.provider?.id
    );

    const msgOrder = body.message?.order as BecknOrderMessage;
    if (msgOrder) {
      const rawBillingCreated = msgOrder.billing?.created_at;
      const rawBillingUpdated = msgOrder.billing?.updated_at;

      function normalizeTs(raw: unknown): string | undefined {
        if (!raw) return undefined;
        if (typeof raw === "string") return raw;
        if (raw instanceof Date) return raw.toISOString();
        if (typeof raw === "object") {
          const r = raw as Record<string, unknown>;
          const ts = r["timestamp"];
          if (typeof ts === "string") return ts;
          const iso = r["iso"];
          if (typeof iso === "string") return iso;
          const val = r["value"];
          if (typeof val === "string") return val;
        }
        if (typeof raw === "number") return new Date(raw).toISOString();
        return String(raw);
      }

      order.becknContext = {
        ...(order.becknContext || {}),
        billing_created_at: normalizeTs(rawBillingCreated) ?? order.createdAt?.toISOString?.(),
        billing_updated_at:
          normalizeTs(rawBillingUpdated) ?? normalizeTs(rawBillingCreated) ?? order.createdAt?.toISOString?.(),
        init_order_created_at:
          typeof msgOrder.created_at === "string"
            ? msgOrder.created_at
            : normalizeTs((msgOrder as unknown as Record<string, unknown>).created_at),
        init_order_updated_at:
          typeof msgOrder.updated_at === "string"
            ? msgOrder.updated_at
            : normalizeTs((msgOrder as unknown as Record<string, unknown>).updated_at),
      };
      order.markModified("becknContext");
      await order.save();
    }

    const context = replyContext(
      body.context,
      "on_init"
    );

    await postToBap(
      context,
      "on_init",
      buildOrderMessage(order)
    );
  });
});

router.post("/confirm", async (req, res) => {
  const body = req.body as BecknBody;

  await ackAfterWork(res, "confirm", async () => {
    const order =
      await findOrderByTransaction(
        body.context.transaction_id
      );

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === "Created") {
      await reserveOrderInventory(order);
    }

    order.status = "Accepted";

    order.fulfillment.state = "Pending";

    order.payment.status = "PAID";

    order.bapOrderId =
      (body.message?.order as { id?: string })
        ?.id;

    const msgOrder = body.message?.order as BecknOrderMessage;
    if (msgOrder) {
      function normalizeTs(raw: unknown): string | undefined {
        if (!raw) return undefined;
        if (typeof raw === "string") return raw;
        if (raw instanceof Date) return raw.toISOString();
        if (typeof raw === "object" && raw !== null) {
          const r = raw as Record<string, unknown>;
          const ts = r["timestamp"] ?? r["iso"] ?? r["value"];
          if (typeof ts === "string") return ts;
        }
        if (typeof raw === "number") return new Date(raw).toISOString();
        return String(raw);
      }

      order.becknContext = {
        ...(order.becknContext || {}),
        confirm_order_created_at: normalizeTs(msgOrder.created_at),
        confirm_order_updated_at: normalizeTs(msgOrder.updated_at),
      };
      order.markModified("becknContext");
    }

    await order.save();

    const context = replyContext(
      body.context,
      "on_confirm"
    );

    await postToBap(
      context,
      "on_confirm",
      buildOrderMessage(order)
    );
  });
});

// router.post("/status", async (req, res) => {
//   const body = req.body as BecknBody;
//   ack(res);
//   try {
//     console.log("========== STATUS REQUEST ==========");
//     console.log(JSON.stringify(body, null, 2));
//     const order = await findOrderByTransaction(body.context.transaction_id);
//     if (order) {
//       console.log(`[status] Found order: ${order.orderId}`);
//       const context = replyContext(body.context, "on_status");
//       await postToBap(context, "on_status", buildOrderMessage(order));
//     } else {
//       console.log(`[status] No order found for transaction: ${body.context.transaction_id}`);
//     }
//   } catch (err) {
//     console.error("[status] Error:", err);
//   }
// });

// REPLACE router.post("/status", ...) with:
router.post("/status", async (req, res) => {
  const body = req.body as BecknBody;
  await ackAfterWork(res, "status", async () => {
    console.log("========== STATUS REQUEST ==========");
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (order) {
      console.log(`[status] Found order: ${order.orderId}, state: ${order.fulfillment?.state}`);
      const context = replyContext(body.context, "on_status");
      await postToBap(context, "on_status", buildOrderMessage(order));
    } else {
      console.log(`[status] No order found for transaction: ${body.context.transaction_id}`);
    }
  });
});


// router.post("/cancel", async (req, res) => {
//   const body = req.body as BecknBody;
//   ack(res);
//   try {
//     console.log("========== CANCEL REQUEST ==========");
//     console.log(JSON.stringify(body, null, 2));
//     const order = await updateOrderStatus(
//       body.context.transaction_id,
//       "Cancelled"
//     );
//     if (order) {
//       console.log(`[cancel] Order cancelled: ${order.orderId}`);
//       const context = replyContext(body.context, "on_cancel");
//       await postToBap(context, "on_cancel", buildOrderMessage(order));
//     } else {
//       console.log(`[cancel] No order found to cancel for transaction: ${body.context.transaction_id}`);
//     }
//   } catch (err) {
//     console.error("[cancel] Error:", err);
//   }
// });


// REPLACE router.post("/cancel", ...) with:
router.post("/cancel", async (req, res) => {
  const body = req.body as BecknBody;
  ack(res);
  try {
    console.log("========== CANCEL REQUEST ==========");
    console.log(JSON.stringify(body, null, 2));

    const order = await findOrderByTransaction(body.context.transaction_id);
    if (!order) {
      console.log(`[cancel] No order found for transaction: ${body.context.transaction_id}`);
      return;
    }

    const cancelMsg = body.message as {
      order_id?: string;
      cancellation_reason_id?: string;
      descriptor?: { short_desc?: string };
    };

    const reasonId = cancelMsg?.cancellation_reason_id || "004";
    const reasonDesc = cancelMsg?.descriptor?.short_desc || "Cancelled";

    // Flow 7: Non-Cancellable — only AFTER delivery (Order-delivered, Delivered)
    // Allow Flow 3B RTO cancellation for Out-for-delivery state
    const nonCancellableStates = ["Order-delivered", "Delivered"];
    if (nonCancellableStates.includes(order.fulfillment?.state || "")) {
      console.log(`[cancel] NON-CANCELLABLE: Order ${order.orderId} in state ${order.fulfillment?.state}`);
      const context = replyContext(body.context, "on_cancel");
      await postToBap(context, "on_cancel", {
        ...buildOrderMessage(order),
        error: {
          type: "DOMAIN-ERROR",
          code: "40006",
          path: "message/order",
          message: `Order cannot be cancelled in state: ${order.fulfillment?.state}`,
        },
      });
      return;
    }

    // Flow 3B: Merchant Full Cancel with RTO (Return to Origin)
    // When order is out-for-delivery, cancellation triggers RTO flow
    const isRtoCancel = order.fulfillment?.state === "Out-for-delivery";
    if (isRtoCancel) {
      console.log(`[cancel] Flow 3B RTO: Initiating Return to Origin for order ${order.orderId}`);
      order.rtoInfo = {
        reason: reasonDesc,
        initiatedAt: new Date(),
        status: "initiated",
        notes: `Merchant initiated RTO cancel: ${reasonDesc}`,
      };
      order.status = "Cancelled";
      order.fulfillment.state = "Return-in-progress"; // RTO fulfillment state
      order.cancellationReasonId = reasonId;
      order.cancellationReasonDesc = reasonDesc;
      order.markModified("rtoInfo");
    } else {
      // Standard full cancel (before out-for-delivery)
      order.status = "Cancelled";
      order.fulfillment.state = "Cancelled";
      order.cancellationReasonId = reasonId;
      order.cancellationReasonDesc = reasonDesc;
    }

    // Restock all items on cancellation
    for (const item of order.items) {
      if (item.productId) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: item.quantity },
        });
      }
    }

    await order.save();
    console.log(`[cancel] Order cancelled: ${order.orderId}, reason: ${reasonId}, RTO: ${isRtoCancel}`);
    const context = replyContext(body.context, "on_cancel");
    await postToBap(context, "on_cancel", buildOrderMessage(order));
  } catch (err) {
    console.error("[cancel] Error:", err);
  }
});



// router.post("/update", async (req, res) => {
//   const body = req.body as BecknBody;
//   ack(res);
//   try {
//     console.log("========== UPDATE REQUEST ==========");
//     console.log(JSON.stringify(body, null, 2));
//     const order = await findOrderByTransaction(body.context.transaction_id);
//     if (order) {
//       console.log(`[update] Found order: ${order.orderId}`);
//       const context = replyContext(body.context, "on_update");
//       await postToBap(context, "on_update", buildOrderMessage(order));
//     } else {
//       console.log(`[update] No order found to update for transaction: ${body.context.transaction_id}`);
//     }
//   } catch (err) {
//     console.error("[update] Error:", err);
//   }
// });


// REPLACE router.post("/update", ...) with:
router.post("/update", async (req, res) => {
  const body = req.body as BecknBody;
  ack(res);
  try {
    console.log("========== UPDATE REQUEST ==========");
    console.log(JSON.stringify(body, null, 2));

    const order = await findOrderByTransaction(body.context.transaction_id);
    if (!order) {
      console.log(`[update] No order found for transaction: ${body.context.transaction_id}`);
      return;
    }

    const updateMsg = body.message as {
      update_target?: string;
      order?: {
        id?: string;
        state?: string;
        items?: Array<{
          id: string;
          quantity?: { count?: number };
          tags?: Array<{ code: string; list?: Array<{ code: string; value: string }> }>;
        }>;
        fulfillments?: Array<{
          id?: string;
          type?: string;
          state?: { descriptor?: { code?: string } };
          tags?: Array<{ code: string; list?: Array<{ code: string; value: string }> }>;
        }>;
        payment?: Record<string, unknown>;
      };
    };

    const updateTarget = updateMsg?.update_target || "";
    const context = replyContext(body.context, "on_update");

    // --- Flow 3A: Merchant Partial Cancel ---
    // update_target = "items" with cancellation tags
    if (updateTarget === "items") {
      const items = updateMsg?.order?.items ?? [];
      const cancelItems: Array<{ ondcItemId: string; quantity: number; reasonId?: string; reasonDesc?: string }> = [];

      for (const item of items) {
        const cancelTag = item.tags?.find(t => t.code === "cancel_request" || t.code === "cancellation");
        if (cancelTag) {
          const reasonId = cancelTag.list?.find(l => l.code === "reason_id")?.value || "002";
          const reasonDesc = cancelTag.list?.find(l => l.code === "reason_desc")?.value || "Item cancelled by merchant";
          const qty = Number(item.quantity?.count ?? 1);
          cancelItems.push({ ondcItemId: item.id, quantity: qty, reasonId, reasonDesc });
        }
      }

      if (cancelItems.length > 0) {
        try {
          const updatedOrder = await partialCancelOrder(body.context.transaction_id, cancelItems);
          if (updatedOrder) {
            console.log(`[update] Partial cancel done for order: ${updatedOrder.orderId}`);
            await postToBap(context, "on_update", buildOrderMessage(updatedOrder));
          }
        } catch (err) {
          console.error("[update] Partial cancel error:", err);
        }
        return;
      }
    }

    // --- Flow 4A/4B: Buyer Initiated Return ---
    // update_target = "fulfillments" with return fulfillment
    if (updateTarget === "fulfillments") {
      const fulfillments = updateMsg?.order?.fulfillments ?? [];
      const returnFulfillment = fulfillments.find(
        f => f.type === "Return" || (f.state?.descriptor?.code || "").includes("Return")
      );

      if (returnFulfillment) {
        const returnTag = returnFulfillment.tags?.find(t => t.code === "return_request");
        const reasonId = returnTag?.list?.find(l => l.code === "reason_id")?.value || "001";
        const reasonDesc = returnTag?.list?.find(l => l.code === "reason_desc")?.value || "Buyer return request";

        // Get items from order to determine full vs partial return
        const returnItemsFromBody = updateMsg?.order?.items ?? [];
        let returnType: "full" | "partial" = "full";
        let returnItemsToProcess: Array<{ ondcItemId: string; quantity: number; reasonId?: string; reasonDesc?: string }>;

        if (returnItemsFromBody.length > 0 && returnItemsFromBody.length < order.items.length) {
          returnType = "partial";
          returnItemsToProcess = returnItemsFromBody.map(i => ({
            ondcItemId: i.id,
            quantity: Number(i.quantity?.count ?? 1),
            reasonId,
            reasonDesc,
          }));
        } else if (returnItemsFromBody.length > 0) {
          // Check if quantities are partial
          const hasPartialQty = returnItemsFromBody.some(ri => {
            const orderItem = order.items.find(i => i.ondcItemId === ri.id);
            return orderItem && Number(ri.quantity?.count ?? orderItem.quantity) < orderItem.quantity;
          });
          returnType = hasPartialQty ? "partial" : "full";
          returnItemsToProcess = returnItemsFromBody.map(i => ({
            ondcItemId: i.id,
            quantity: Number(i.quantity?.count ?? 1),
            reasonId,
            reasonDesc,
          }));
        } else {
          // Return all items
          returnItemsToProcess = order.items.map(i => ({
            ondcItemId: i.ondcItemId,
            quantity: i.quantity,
            reasonId,
            reasonDesc,
          }));
        }

        try {
          const updatedOrder = await processReturnRequest(
            body.context.transaction_id,
            returnItemsToProcess,
            returnType
          );
          if (updatedOrder) {
            console.log(`[update] Return initiated for order: ${updatedOrder.orderId}, type: ${returnType}`);
            await postToBap(context, "on_update", buildOrderMessage(updatedOrder));
          }
        } catch (err) {
          console.error("[update] Return processing error:", err);
        }
        return;
      }

      const cancelFulfillment = fulfillments.find(
        f => f.type === "Cancel" || f.tags?.some(t => t.code === "cancel_request" || t.code === "cancellation") );
      if (cancelFulfillment) {
        const cancelTag = cancelFulfillment.tags?.find(t => t.code === "cancel_request" || t.code === "cancellation");
        const reasonId = cancelTag?.list?.find(l => l.code === "reason_id")?.value || "002";
        const reasonDesc = cancelTag?.list?.find(l => l.code === "reason_desc")?.value || "Merchant cancelled order";
        try {
          const updatedOrder = await merchantFullCancelOrder(body.context.transaction_id, reasonId, reasonDesc, true);
          if (updatedOrder) {
            console.log(`[update] Full cancel done for order: ${updatedOrder.orderId}`);
            await postToBap(context, "on_update", buildOrderMessage(updatedOrder));
          }
        } catch (err) {
          console.error("[update] Merchant full cancel error:", err);
        }
        return;
      }
    }

    // Default: echo back current order state
    await postToBap(context, "on_update", buildOrderMessage(order));
  } catch (err) {
    console.error("[update] Error:", err);
  }
});



// router.post("/track", async (req, res) => {
//   const body = req.body as BecknBody;
//   ack(res);
//   try {
//     console.log("========== TRACK REQUEST ==========");
//     console.log(JSON.stringify(body, null, 2));
//     const order = await findOrderByTransaction(body.context.transaction_id);
//     if (order) {
//       console.log(`[track] Tracking details for order: ${order.orderId}`);
//       const context = replyContext(body.context, "on_track");
//       await postToBap(context, "on_track", {
//         tracking: {
//           url: order.fulfillment?.tracking || `${env.apiBaseUrl}/track/${order.orderId}`,
//           status: order.fulfillment?.state || "Pending",
//         },
//       });
//     } else {
//       console.log(`[track] No order found for transaction: ${body.context.transaction_id}`);
//     }
//   } catch (err) {
//     console.error("[track] Error:", err);
//   }
// });


// REPLACE router.post("/track", ...) with:
router.post("/track", async (req, res) => {
  const body = req.body as BecknBody;
  await ackAfterWork(res, "track", async () => {
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (order) {
      const context = replyContext(body.context, "on_track");
      await postToBap(context, "on_track", {
        tracking: {
          url: order.fulfillment?.tracking_url || `${env.apiBaseUrl}/track/${order.orderId}`,
          status: order.fulfillment?.state || "Pending",
        },
      });
    }
  });
});



router.post("/info", async (req, res) => {
  const body = req.body as BecknBody;
  await ackAfterWork(res, "info", async () => {
    const order = await findOrderByTransaction(body.context.transaction_id);
    if (!order) {
      console.log(`[info] No order found for transaction: ${body.context.transaction_id}`);
      return;
    }
    const context = replyContext(body.context, "on_info");
    await postToBap(context, "on_info", buildOrderMessage(order));
  });
});

router.post("/catalog/rejection", async (req, res) => {
  ack(res);
  try {
    const body = req.body as BecknBody;
    console.log("========== CATALOG REJECTION ==========");
    console.log(JSON.stringify(body, null, 2));
  } catch (err) {
    console.error("[catalog/rejection] Error:", err);
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

// ADD these routes after the /support handler:

// Flow 6A-F: Issue and Grievance Management
router.post("/issue", async (req, res) => {
  const body = req.body as BecknBody & {
    message?: {
      issue?: {
        id?: string;
        category?: string;
        sub_category?: string;
        issue_type?: string;
        order_details?: { id?: string };
        description?: { short_desc?: string; long_desc?: string };
        resolution_required_by?: string;
      };
    };
  };
  ack(res);
  try {
    console.log("========== IGM ISSUE REQUEST ==========");
    console.log(JSON.stringify(body, null, 2));

    const issue = body.message?.issue;
    if (!issue?.id) {
      console.log("[issue] No issue ID found");
      return;
    }

    const order = await findOrderByTransaction(body.context.transaction_id);
    if (!order) {
      console.log(`[issue] No order found for transaction: ${body.context.transaction_id}`);
      return;
    }

    const category = (issue.category || "NO_ACTION").toUpperCase() as "REFUND" | "REPLACEMENT" | "CANCEL" | "NO_ACTION";
    await createOrUpdateIgmIssue(body.context.transaction_id, {
      issueId: issue.id,
      category,
      subCategory: issue.sub_category,
      description: issue.description?.short_desc,
      status: "OPEN",
    });

    const context = replyContext(body.context, "on_issue");
    await postToBap(context, "on_issue", {
      issue: {
        id: issue.id,
        category,
        issue_type: issue.issue_type || "ISSUE",
        order_details: { id: order.orderId },
        state: {
          descriptor: { code: "OPEN" }
        },
        resolution_provider: {
          respondent_info: {
            type: "SELLER-APP",
            resolution_support: {
              contact: {
                phone: "9999999999",
                email: "support@shopnix.local",
              },
            },
          },
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[issue] Error:", err);
  }
});

// IGM Issue Status
router.post("/issue_status", async (req, res) => {
  const body = req.body as BecknBody & {
    message?: { issue_id?: string };
  };
  ack(res);
  try {
    console.log("========== IGM ISSUE STATUS ==========");
    const issueId = body.message?.issue_id;
    const order = await findOrderByTransaction(body.context.transaction_id);

    if (!order || !issueId) return;

    const issue = (order.igmIssues ?? []).find(i => i.issueId === issueId);

    const context = replyContext(body.context, "on_issue_status");
    await postToBap(context, "on_issue_status", {
      issue: {
        id: issueId,
        state: { descriptor: { code: issue?.status ?? "OPEN" } },
        resolution: issue?.resolution
          ? {
            short_desc: issue.resolution,
            action_triggered: issue.resolutionAction || "NO_ACTION",
          }
          : undefined,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[issue_status] Error:", err);
  }
});


// Flow 11A: RSF 2.0 - Collector (receiver_recon)
router.post("/receiver_recon", async (req, res) => {
  const body = req.body as BecknBody & {
    message?: {
      orderbook?: {
        orders?: Array<{
          id: string;
          invoice_no?: string;
          collector_app_id?: string;
          receiver_app_id?: string;
          order_recon_status?: string;
          transaction_id?: string;
          settlement_id?: string;
          settlement_reference_no?: string;
          counterparty_recon_status?: string;
          counterparty_diff_amount?: { currency: string; value: string };
          message?: { name: string; code: string };
        }>;
      };
    };
  };
  ack(res);
  try {
    console.log("========== RECEIVER RECON ==========");
    const orders = body.message?.orderbook?.orders ?? [];
    
    for (const reconOrder of orders) {
      if (reconOrder.id) {
        await import("../models/Order").then(m => m.Order).then(async (Order) => {
          await Order.findOneAndUpdate(
            { orderId: reconOrder.id },
            { 
              settlementInfo: {
                ...reconOrder,
                recon_status: "01",
              } 
            }
          );
        });
      }
    }

    const context = replyContext(body.context, "on_receiver_recon");
    await postToBap(context, "on_receiver_recon", {
      orderbook: {
        orders: orders.map(o => ({
          id: o.id,
          invoice_no: o.invoice_no,
          collector_app_id: o.collector_app_id,
          receiver_app_id: o.receiver_app_id,
          order_recon_status: "02",
          transaction_id: o.transaction_id,
          settlement_id: o.settlement_id,
          settlement_reference_no: o.settlement_reference_no,
          counterparty_recon_status: "01",
          counterparty_diff_amount: { currency: "INR", value: "0" },
          message: { name: "Equal amount", code: "equal" }
        }))
      }
    });
  } catch (err) {
    console.error("[receiver_recon] Error:", err);
  }
});

// Flow 11B: RSF 2.0 - Receiver (settlement)
router.post("/settlement", async (req, res) => {
  const body = req.body as BecknBody & {
    message?: {
      settlement?: {
        settlements?: Array<{
          id: string;
          settlement_type?: string;
          settlement_amount?: { currency: string; value: string };
          settlement_status?: string;
          settlement_reference_no?: string;
          settlement_timestamp?: string;
        }>;
      };
    };
  };
  ack(res);
  try {
    console.log("========== SETTLEMENT ==========");
    const settlements = body.message?.settlement?.settlements ?? [];
    
    const context = replyContext(body.context, "on_settlement");
    await postToBap(context, "on_settlement", {
      settlement: {
        settlements: settlements.map(s => ({
          id: s.id,
          settlement_type: s.settlement_type,
          settlement_amount: s.settlement_amount,
          settlement_status: "SETTLED",
          settlement_reference_no: s.settlement_reference_no || `REF-${Date.now()}`,
          settlement_timestamp: new Date().toISOString()
        }))
      }
    });
  } catch (err) {
    console.error("[settlement] Error:", err);
  }
});

/** Superadmin sees all logs; sellers see logs related to their provider/items. */
router.get("/logs", requireAuth, async (req: AuthRequest, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const logs = await OndcLog.find()
    .sort({ createdAt: -1 })
    .limit(limit);

  if (req.user?.role === "superadmin") {
    return res.json({ success: true, data: logs });
  }

  const sellerId = req.user?.sellerId;
  if (!sellerId) {
    return res.json({ success: true, data: [] });
  }

  const seller = await Seller.findById(sellerId);
  const products = await Product.find({ sellerId }).select("ondcItemId");
  const needles = [
    seller?.ondcProviderId,
    ...products.map((product) => product.ondcItemId),
  ].filter(Boolean) as string[];

  const sellerLogs = logs.filter((log) => {
    const payload = JSON.stringify(log.payload);
    return needles.some((needle) => payload.includes(needle));
  });

  return res.json({ success: true, data: sellerLogs });
});

export default router;
