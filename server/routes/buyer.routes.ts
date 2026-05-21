import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { PRODUCT_CATEGORIES, getCategoryBySlug } from "../constants/categories";
import { CASH_PAYMENT_LABEL } from "../constants/payment";
import { resolveSellerFromOrderLines } from "../services/seller.service";
import { requireAuth, requireBuyer, type AuthRequest } from "../middleware/auth";
import { sendError, sendSuccess } from "../utils/response";
import {
  RETURN_POLICY,
  canBuyerCancel,
  canRequestReturn,
  normalizeLegacyStatus,
} from "../constants/order-workflow";
import {
  cancelOrderByBuyer,
  requestReturnByBuyer,
} from "../services/order-workflow.service";

const router = Router();

import buyerAuthRoutes from "./buyer-auth.routes";
router.use("/auth", buyerAuthRoutes);

router.get("/categories", (_req, res) => {
  return sendSuccess(res, PRODUCT_CATEGORIES);
});

router.get("/products", async (req, res) => {
  const { category, search, page = "1", limit = "20" } = req.query as Record<
    string,
    string
  >;
  const filter: Record<string, unknown> = {
    isPublished: true,
    quantity: { $gt: 0 },
  };

  if (category) filter.categorySlug = category;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
    ];
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(50, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Product.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    products,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

router.get("/products/:id", async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    isPublished: true,
  });
  if (!product) return sendError(res, "Product not found", 404);

  const related = await Product.find({
    categorySlug: product.categorySlug,
    isPublished: true,
    quantity: { $gt: 0 },
    _id: { $ne: product._id },
  }).limit(4);

  return sendSuccess(res, { product, related });
});

router.get("/return-policy", (_req, res) => {
  return sendSuccess(res, RETURN_POLICY);
});

router.get("/payment-options", (_req, res) => {
  return sendSuccess(res, {
    methods: [{ id: "cash", label: CASH_PAYMENT_LABEL, gateway: false }],
    default: "cash",
  });
});

router.post("/orders", requireAuth, requireBuyer, async (req: AuthRequest, res) => {
  try {
    const buyer = req.user!;
    const { address, items, paymentMethod = "cash" } = req.body as {
      address?: Record<string, string>;
      items?: { productId: string; quantity: number }[];
      paymentMethod?: string;
    };

    if (paymentMethod !== "cash") {
      return sendError(res, "Only cash on delivery is accepted", 400);
    }

    if (!items?.length) {
      return sendError(res, "Cart items are required");
    }

    const shipAddress = address ?? buyer.address ?? {};
    if (!shipAddress.street || !shipAddress.city || !shipAddress.pincode) {
      return sendError(res, "Complete delivery address is required");
    }

    const customer = {
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
      address: shipAddress,
    };

    const resolved = await resolveSellerFromOrderLines(items);
    if (!resolved.ok) {
      return sendError(res, resolved.message, 400);
    }

    const { seller, lines } = resolved;
    const orderItems = [];
    let amount = 0;

    for (const { product, quantity } of lines) {
      orderItems.push({
        productId: product._id,
        ondcItemId: product.ondcItemId,
        name: product.name,
        quantity,
        price: product.price,
      });
      amount += product.price * quantity;
      product.quantity -= quantity;
      await product.save();
    }

    const order = await Order.create({
      sellerId: seller._id,
      buyerId: buyer._id,
      orderId: `SNX-${uuidv4().slice(0, 8).toUpperCase()}`,
      transactionId: uuidv4(),
      channel: "buyer",
      status: "Created",
      items: orderItems,
      customer,
      payment: {
        method: "cash",
        type: "ON-FULFILLMENT",
        status: "NOT-PAID",
        amount,
      },
      fulfillment: { type: "Delivery", state: "Pending" },
    });

    return sendSuccess(res, order, 201, "Order placed — pay cash on delivery");
  } catch (err) {
    console.error(err);
    return sendError(res, "Failed to place order", 500);
  }
});

/** My orders (logged-in buyer) */
router.get("/orders", requireAuth, requireBuyer, async (req: AuthRequest, res) => {
  const orders = await Order.find({ buyerId: req.user!._id })
    .sort({ createdAt: -1 })
    .limit(50);
  return sendSuccess(res, orders);
});

function orderMeta(order: InstanceType<typeof Order>) {
  const status = normalizeLegacyStatus(order.status);
  const returnCheck = canRequestReturn(status, order.deliveredAt);
  return {
    canCancel: canBuyerCancel(order.status),
    canReturn: returnCheck.allowed,
    returnMessage: returnCheck.reason,
    returnDeadline: order.deliveredAt
      ? new Date(
          new Date(order.deliveredAt).getTime() +
            RETURN_POLICY.windowDays * 86400000
        )
      : null,
    returnInfo: order.returnInfo,
    deliveredAt: order.deliveredAt,
  };
}

/** Order status by orderId (must belong to buyer) */
router.get("/orders/track/:orderId", requireAuth, requireBuyer, async (req: AuthRequest, res) => {
  const order = await Order.findOne({
    orderId: req.params.orderId,
    buyerId: req.user!._id,
  });
  if (!order) return sendError(res, "Order not found", 404);
  return sendSuccess(res, {
    orderId: order.orderId,
    status: normalizeLegacyStatus(order.status),
    legacyStatus: order.status,
    payment: order.payment,
    fulfillment: order.fulfillment,
    items: order.items,
    customer: order.customer,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    returnPolicy: RETURN_POLICY,
    ...orderMeta(order),
  });
});

router.post(
  "/orders/:orderId/cancel",
  requireAuth,
  requireBuyer,
  async (req: AuthRequest, res) => {
    const order = await Order.findOne({
      orderId: req.params.orderId,
      buyerId: req.user!._id,
    });
    if (!order) return sendError(res, "Order not found", 404);

    const err = await cancelOrderByBuyer(order);
    if (err) return sendError(res, err, 400);
    return sendSuccess(res, order, 200, "Order cancelled");
  }
);

router.post(
  "/orders/:orderId/return",
  requireAuth,
  requireBuyer,
  async (req: AuthRequest, res) => {
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) {
      return sendError(res, "Return reason is required");
    }

    const order = await Order.findOne({
      orderId: req.params.orderId,
      buyerId: req.user!._id,
    });
    if (!order) return sendError(res, "Order not found", 404);

    const err = await requestReturnByBuyer(order, reason);
    if (err) return sendError(res, err, 400);
    return sendSuccess(res, order, 200, "Return request submitted");
  }
);

router.get("/orders/:id", requireAuth, requireBuyer, async (req: AuthRequest, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    buyerId: req.user!._id,
  });
  if (!order) return sendError(res, "Order not found", 404);
  return sendSuccess(res, order);
});

router.get("/categories/:slug", async (req, res) => {
  const cat = getCategoryBySlug(req.params.slug);
  if (!cat) return sendError(res, "Category not found", 404);

  const products = await Product.find({
    categorySlug: cat.slug,
    isPublished: true,
    quantity: { $gt: 0 },
  }).limit(40);

  return sendSuccess(res, { category: cat, products });
});

export default router;
