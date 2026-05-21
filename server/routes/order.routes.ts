import { Router } from "express";
import { Order } from "../models/Order";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { sendError, sendSuccess } from "../utils/response";
import {
  ORDER_STATUSES,
  RETURN_POLICY,
  SELLER_STATUS_FLOW,
  normalizeLegacyStatus,
} from "../constants/order-workflow";
import {
  applyStatusUpdate,
  restockOrderItems,
  validateSellerTransition,
} from "../services/order-workflow.service";
import type { OrderStatus } from "../constants/order-workflow";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  const sellerId = req.user!.sellerId;
  if (!sellerId) return sendError(res, "Seller profile not linked", 400);

  const status = req.query.status as string | undefined;
  const filter: Record<string, unknown> = { sellerId };
  if (status) filter.status = status;

  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100);
  return sendSuccess(res, orders);
});

router.get("/workflow", (_req, res) => {
  return sendSuccess(res, {
    statuses: ORDER_STATUSES,
    sellerFlow: SELLER_STATUS_FLOW,
    returnPolicy: RETURN_POLICY,
  });
});

router.get("/:id", async (req: AuthRequest, res) => {
  const order = await Order.findOne({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!order) return sendError(res, "Order not found", 404);

  const current = normalizeLegacyStatus(order.status);
  return sendSuccess(res, {
    order,
    nextStatuses: SELLER_STATUS_FLOW[current] ?? [],
  });
});

router.patch("/:id/status", async (req: AuthRequest, res) => {
  const { status, sellerNote } = req.body as {
    status?: string;
    sellerNote?: string;
  };

  if (!status || !ORDER_STATUSES.includes(status as OrderStatus)) {
    return sendError(res, "Invalid status");
  }

  const order = await Order.findOne({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });

  if (!order) return sendError(res, "Order not found", 404);

  const err = validateSellerTransition(order.status, status as OrderStatus);
  if (err) return sendError(res, err, 400);

  const prev = order.status;
  applyStatusUpdate(order, status as OrderStatus);

  if (status === "Cancelled" && prev !== "Cancelled") {
    await restockOrderItems(order);
  }
  if (status === "Returned") {
    await restockOrderItems(order);
    if (sellerNote) order.returnInfo = { ...order.returnInfo, sellerNote };
  }
  if (status === "Return-Approved" && sellerNote) {
    order.returnInfo = { ...order.returnInfo, sellerNote };
  }

  await order.save();
  return sendSuccess(res, order, 200, `Order updated to ${status}`);
});

export default router;
