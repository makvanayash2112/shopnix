import { Product } from "../models/Product";
import { Order, type IOrder } from "../models/Order";
import {
  canBuyerCancel,
  canRequestReturn,
  fulfillmentLabel,
  normalizeLegacyStatus,
  SELLER_STATUS_FLOW,
  type OrderStatus,
} from "../constants/order-workflow";

export function applyStatusUpdate(order: IOrder, nextStatus: OrderStatus) {
  order.status = nextStatus;
  order.fulfillment = order.fulfillment ?? { type: "Delivery" };
  order.fulfillment.state = fulfillmentLabel(nextStatus);

  if (nextStatus === "Packed") {
    order.fulfillment.state = "Packed";
  }
  if (nextStatus === "Delivering") {
    order.fulfillment.state = "Out-for-delivery";
    order.fulfillment.tracking =
      order.fulfillment.tracking || `TRK-${order.orderId}`;
  }
  if (nextStatus === "Delivered") {
    order.fulfillment.state = "Delivered";
    order.deliveredAt = new Date();
    if (order.payment?.method === "cash") {
      order.payment.status = "PAID";
    }
  }
  if (nextStatus === "Cancelled") {
    order.fulfillment.state = "Cancelled";
  }
  if (nextStatus === "Return-Requested") {
    order.returnInfo = {
      ...order.returnInfo,
      requestedAt: new Date(),
      status: "pending",
    };
  }
  if (nextStatus === "Return-Approved") {
    order.returnInfo = {
      ...order.returnInfo,
      approvedAt: new Date(),
      status: "approved",
    };
  }
  if (nextStatus === "Returned") {
    order.returnInfo = {
      ...order.returnInfo,
      completedAt: new Date(),
      status: "completed",
    };
  }
}

export async function restockOrderItems(order: IOrder) {
  for (const item of order.items) {
    if (item.productId) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { quantity: item.quantity },
      });
    }
  }
}

export function validateSellerTransition(
  current: string,
  next: OrderStatus
): string | null {
  const cur = normalizeLegacyStatus(current);
  const allowed = SELLER_STATUS_FLOW[cur] ?? [];
  if (!allowed.includes(next)) {
    return `Cannot change from ${cur} to ${next}`;
  }
  return null;
}

export async function cancelOrderByBuyer(order: IOrder): Promise<string | null> {
  if (!canBuyerCancel(order.status)) {
    return "Order cannot be cancelled while out for delivery or after delivery";
  }
  applyStatusUpdate(order, "Cancelled");
  await restockOrderItems(order);
  await order.save();
  return null;
}

export async function requestReturnByBuyer(
  order: IOrder,
  reason: string
): Promise<string | null> {
  const check = canRequestReturn(order.status, order.deliveredAt);
  if (!check.allowed) return check.reason ?? "Return not allowed";

  if (order.returnInfo?.requestedAt) {
    return "Return already requested for this order";
  }

  applyStatusUpdate(order, "Return-Requested");
  order.returnInfo = {
    reason: reason.trim(),
    requestedAt: new Date(),
    status: "pending",
  };
  await order.save();
  return null;
}
