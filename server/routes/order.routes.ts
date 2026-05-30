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
    void postToBap(context, "on_status", buildOrderMessage(order, { action: "on_status" }));
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
      void postToBap(context, "on_update", buildOrderMessage(updatedOrder, { action: "on_update", flow: "partial-cancel" }));
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
  const { reasonId, reasonDesc, trackingId, finalState } = req.body as {
    reasonId?: string;
    reasonDesc?: string;
    trackingId?: string;
    finalState?: string; // optional fulfillment state e.g., "RTO-Delivered" or "RTO-Disposed"
  };

  const order = await Order.findOne({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!order) return sendError(res, "Order not found", 404);

  // Only allow RTO cancel for out-for-delivery orders and ensure order is not already returned or cancelled
  if (
    (order.fulfillment?.state !== "Out-for-delivery" && order.fulfillment?.state !== "Delivering") ||
    ["Cancelled", "Returned", "Return completed"].includes(order.status)
  ) {
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

    // Set final cancelled status and fulfillment state
    updatedOrder.status = "Cancelled";
    updatedOrder.fulfillment = updatedOrder.fulfillment || {} as any;
    updatedOrder.fulfillment.state = finalState ?? "RTO-Delivered";

    // Notify BAP of RTO cancellation (on_cancel)
    if (updatedOrder.becknContext) {
      const { replyContext } = await import("../utils/beckn");
      const { postToBap } = await import("../services/ondc/callback.service");
      const { buildOrderMessage } = await import("../services/ondc/order.service");
      const cancelContext = replyContext(
        (updatedOrder.becknContext as unknown) as import("../utils/beckn").BecknContext,
        "on_cancel"
      );
      void postToBap(cancelContext, "on_cancel", buildOrderMessage(updatedOrder, { action: "on_cancel", flow: "rto" }));
    }

    // Immediately send final on_status after cancellation
    if (updatedOrder.becknContext) {
      const { replyContext } = await import("../utils/beckn");
      const { postToBap } = await import("../services/ondc/callback.service");
      const { buildOrderMessage } = await import("../services/ondc/order.service");
      const statusContext = replyContext(
        (updatedOrder.becknContext as unknown) as import("../utils/beckn").BecknContext,
        "on_status"
      );
      void postToBap(statusContext, "on_status", buildOrderMessage(updatedOrder, { action: "on_status", flow: "rto" }));
    }

    return sendSuccess(res, updatedOrder, 200, "RTO cancellation initiated with final status (Flow 3B)");
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "RTO cancellation failed", 400);
  }
});

// ADD: Update RTO Status — when delivery partner picks up
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

  // Update RTO status via service
  const { updateRtoStatus } = await import("../services/ondc/order.service");
  const updatedOrder = await updateRtoStatus(order.transactionId, status, notes);
  if (!updatedOrder) return sendError(res, "Failed to update RTO status", 500);

  // If RTO completed, set order status and fulfillment state
  if (status === "completed") {
    order.status = "Cancelled";
    order.fulfillment = order.fulfillment || {} as any;
    // Use notes as fulfillment state if provided, otherwise default to RTO-Delivered
    order.fulfillment.state = notes ?? "RTO-Delivered";
  }

  // Persist changes
  await order.save();

  // Send unsolicited on_status to BAP
  if (order.becknContext) {
    const { replyContext } = await import("../utils/beckn");
    const { postToBap } = await import("../services/ondc/callback.service");
    const { buildOrderMessage } = await import("../services/ondc/order.service");
    const context = replyContext(
      (order.becknContext as unknown) as import("../utils/beckn").BecknContext,
      "on_status"
    );
    void postToBap(context, "on_status", buildOrderMessage(order, { action: "on_status", flow: "rto" }));
  }

  return sendSuccess(res, order, 200, `RTO status updated to: ${status}`);
});

// ADD: Update Return Status — Flow 4A/4B (Return_Initiated -> Return_Approved -> Return_Picked -> Return_Delivered)
router.patch("/:id/return-status", async (req: AuthRequest, res) => {
  const { status, sellerNote } = req.body as {
    status?: "approved" | "picked-up" | "completed";
    sellerNote?: string;
  };

  if (!status || !["approved", "picked-up", "completed"].includes(status)) {
    return sendError(res, "Invalid return status. Must be: approved, picked-up, or completed");
  }

  const order = await Order.findOne({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!order) return sendError(res, "Order not found", 404);

  if (!order.returnItems || order.returnItems.length === 0) {
    return sendError(res, "No return items found for this order", 404);
  }

  try {
    const now = new Date();
    order.returnInfo = order.returnInfo || {};
    order.returnInfo.status = status;
    if (sellerNote) order.returnInfo.sellerNote = sellerNote;

    if (status === "approved") {
      order.status = "Return-Approved";
    } else if (status === "completed") {
      order.status = "Returned";
      order.returnInfo.completedAt = now;
      // Restock returned items
      const { restockOrderItems } = await import("../services/order-workflow.service");
      await restockOrderItems(order);
    }

    // Update individual return items
    order.returnItems.forEach(ri => {
      ri.status = status;
      if (status === "approved") ri.approvedAt = now;
      if (status === "completed") ri.completedAt = now;
    });

    order.markModified("returnInfo");
    order.markModified("returnItems");
    await order.save();

    // Notify BAP of status update
    if (order.becknContext) {
      const { replyContext } = await import("../utils/beckn");
      const { postToBap } = await import("../services/ondc/callback.service");
      const { buildOrderMessage } = await import("../services/ondc/order.service");
      const context = replyContext(
        (order.becknContext as unknown) as import("../utils/beckn").BecknContext,
        "on_update"
      );
      void postToBap(context, "on_update", buildOrderMessage(order, { action: "on_update", flow: "return" }));
    }

    return sendSuccess(res, order, 200, `Return status updated to: ${status}`);
  } catch (err) {
    return sendError(res, err instanceof Error ? err.message : "Return status update failed", 400);
  }
});

export default router;
