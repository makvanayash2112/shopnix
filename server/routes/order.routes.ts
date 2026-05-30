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
import { postToBap } from "../services/ondc/callback.service";
import { buildOrderMessage } from "../services/ondc/order.service";
import { replyContext, type BecknContext } from "../utils/beckn";
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
  if (order.becknContext) {
    const context = replyContext(
      order.becknContext as unknown as BecknContext,
      "on_status"
    );
    void postToBap(context, "on_status", buildOrderMessage(order));
  }
  return sendSuccess(res, order, 200, `Order updated to ${status}`);
});

// ADD: Merchant partial cancel — Flow 3A
router.patch("/:id/partial-cancel", async (req: AuthRequest, res) => {
  const { items, reasonId, reasonDesc } = req.body as {
    items?: Array<{ ondcItemId: string; quantity: number }>;
    reasonId?: string;
    reasonDesc?: string;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return sendError(res, "items array is required with ondcItemId and quantity");
  }

  const order = await Order.findOne({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!order) return sendError(res, "Order not found", 404);

  // Only allow partial cancel for Accepted or Packed orders
  if (!["Accepted", "Packed"].includes(order.status as string)) {
    return sendError(res, `Cannot partially cancel order in status: ${order.status}`, 400);
  }

  try {
    const { partialCancelOrder } = await import("../services/ondc/order.service");
    const cancelItems = items.map(i => ({
      ondcItemId: i.ondcItemId,
      quantity: i.quantity,
      reasonId: reasonId || "002",
      reasonDesc: reasonDesc || "Merchant partial cancellation",
    }));

    const updatedOrder = await partialCancelOrder(order.transactionId, cancelItems);
    if (!updatedOrder) return sendError(res, "Failed to partial cancel", 500);

    // Notify BAP
    if (updatedOrder.becknContext) {
      const { replyContext } = await import("../utils/beckn");
      const { postToBap } = await import("../services/ondc/callback.service");
      const { buildOrderMessage } = await import("../services/ondc/order.service");
      const context = replyContext(
        (updatedOrder.becknContext as unknown) as import("../utils/beckn").BecknContext,
        "on_update"
      );
      void postToBap(context, "on_update", buildOrderMessage(updatedOrder));
    }

    return sendSuccess(res, updatedOrder, 200, "Partial cancellation applied");
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "Partial cancel failed", 400);
  }
});

// ADD: Seller resolves IGM issue — Flow 6A-F
router.patch("/:id/igm/:issueId", async (req: AuthRequest, res) => {
  const { status, resolution, resolutionAction } = req.body as {
    status?: "PROCESSING" | "RESOLVED" | "CLOSED";
    resolution?: string;
    resolutionAction?: "REFUND" | "REPLACEMENT" | "CANCEL" | "NO_ACTION";
  };

  const order = await Order.findOne({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!order) return sendError(res, "Order not found", 404);

  const issue = (order.igmIssues ?? []).find(
    i => i.issueId === req.params.issueId
  );
  if (!issue) return sendError(res, "IGM issue not found", 404);

  issue.status = status ?? issue.status;
  issue.resolution = resolution ?? issue.resolution;
  issue.resolutionAction = resolutionAction ?? issue.resolutionAction;
  issue.updatedAt = new Date();
  if (status === "CLOSED") issue.closedAt = new Date();

  order.markModified("igmIssues");
  await order.save();

  // Notify BAP of resolution
  if (order.becknContext) {
    const { replyContext } = await import("../utils/beckn");
    const { postToBap } = await import("../services/ondc/callback.service");
    const context = replyContext(
      (order.becknContext as unknown) as import("../utils/beckn").BecknContext,
      "on_issue_status"
    );
    void postToBap(context, "on_issue_status", {
      issue: {
        id: issue.issueId,
        state: { descriptor: { code: issue.status } },
        resolution: issue.resolution
          ? {
            short_desc: issue.resolution,
            action_triggered: issue.resolutionAction || "NO_ACTION",
          }
          : undefined,
        updated_at: new Date().toISOString(),
      },
    });
  }

  return sendSuccess(res, order, 200, "IGM issue updated");
});

// ADD: Merchant RTO (Return to Origin) cancel — Flow 3B
// Allow cancellation of out-for-delivery orders with RTO tracking
router.patch("/:id/rto-cancel", async (req: AuthRequest, res) => {
  const { reasonId, reasonDesc, trackingId } = req.body as {
    reasonId?: string;
    reasonDesc?: string;
    trackingId?: string;
  };

  const order = await Order.findOne({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!order) return sendError(res, "Order not found", 404);

  // Only allow RTO cancel for out-for-delivery orders
  if (order.fulfillment?.state !== "Out-for-delivery" && order.fulfillment?.state !== "Delivering") {
    return sendError(
      res,
      `Cannot initiate RTO for order in status: ${order.fulfillment?.state}. Only allowed for Out-for-delivery or Delivering orders.`,
      400
    );
  }

  try {
    const { initiateRtoCancel } = await import("../services/ondc/order.service");
    const updatedOrder = await initiateRtoCancel(
      order.transactionId,
      reasonId || "004",
      reasonDesc || "Merchant initiated RTO",
      trackingId
    );

    if (!updatedOrder) return sendError(res, "Failed to initiate RTO", 500);

    // Notify BAP of RTO cancellation
    if (updatedOrder.becknContext) {
      const { replyContext } = await import("../utils/beckn");
      const { postToBap } = await import("../services/ondc/callback.service");
      const { buildOrderMessage } = await import("../services/ondc/order.service");
      const context = replyContext(
        (updatedOrder.becknContext as unknown) as import("../utils/beckn").BecknContext,
        "on_cancel"
      );
      void postToBap(context, "on_cancel", buildOrderMessage(updatedOrder));
    }

    return sendSuccess(res, updatedOrder, 200, "RTO cancellation initiated (Flow 3B)");
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "RTO cancellation failed", 400);
  }
});

// ADD: Update RTO Status — when delivery partner picks up return
router.patch("/:id/rto-status", async (req: AuthRequest, res) => {
  const { status, notes } = req.body as {
    status?: "picked-up" | "delivered-to-origin" | "completed";
    notes?: string;
  };

  if (!status || !["picked-up", "delivered-to-origin", "completed"].includes(status)) {
    return sendError(res, "Invalid RTO status. Must be: picked-up, delivered-to-origin, or completed");
  }

  const order = await Order.findOne({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!order) return sendError(res, "Order not found", 404);

  if (!order.rtoInfo) {
    return sendError(res, "No RTO info found for this order", 404);
  }

  try {
    const { updateRtoStatus } = await import("../services/ondc/order.service");
    const updatedOrder = await updateRtoStatus(order.transactionId, status, notes);
    if (!updatedOrder) return sendError(res, "Failed to update RTO status", 500);

    // Notify BAP of RTO status update
    if (updatedOrder.becknContext) {
      const { replyContext } = await import("../utils/beckn");
      const { postToBap } = await import("../services/ondc/callback.service");
      const { buildOrderMessage } = await import("../services/ondc/order.service");
      const context = replyContext(
        (updatedOrder.becknContext as unknown) as import("../utils/beckn").BecknContext,
        "on_status"
      );
      void postToBap(context, "on_status", buildOrderMessage(updatedOrder));
    }

    return sendSuccess(res, updatedOrder, 200, `RTO status updated to: ${status}`);
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "RTO status update failed", 400);
  }
});

export default router;
