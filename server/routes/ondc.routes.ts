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
import { Product, type IProduct } from "../models/Product";
import { Seller } from "../models/Seller";
import {
  // buildOrderMessage,
  createOrderFromInit,
  findOrderByTransaction,
  reserveOrderInventory,
  updateOrderStatus,
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

      if (product.quantity < qty) {
        throw new Error(
          `Insufficient stock for ${product.name}`
        );
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

    order.fulfillment.state = "Packed";

    order.payment.status = "PAID";

    order.bapOrderId =
      (body.message?.order as { id?: string })
        ?.id;

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
