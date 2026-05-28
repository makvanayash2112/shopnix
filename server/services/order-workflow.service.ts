import type { IOrder } from "../models/Order";
import { Product } from "../models/Product";
import {
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
  if (nextStatus === "Agent-assigned") {
    order.fulfillment.state = "Agent-assigned";
  }
  if (nextStatus === "Order-picked-up") {
    order.fulfillment.state = "Order-picked-up";
  }
  // if (nextStatus === "Delivering") {
  //   order.fulfillment.state = "Out-for-delivery";
  //   order.fulfillment.tracking =
  //     order.fulfillment.tracking || `TRK-${order.orderId}`;
  // }
  if (nextStatus === "Delivering") {
    order.fulfillment.state = "Out-for-delivery";

    order.fulfillment.tracking = false;
    order.fulfillment.tracking_url = `https://shopnix-nine.vercel.app/track/${order.orderId}`;

    // order.fulfillment.tracking_url =
    //   order.fulfillment.tracking_url ||
    //   `https://shopnix-nine.vercel.app/track/${order.orderId}`; 
  }
  if (nextStatus === "Delivered") {
    order.fulfillment.state = "Order-delivered";
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
  // ADD these cases inside applyStatusUpdate, after the "Returned" block:

  if (nextStatus === "Partial-Cancelled") {
    order.fulfillment.state = "Partially-Cancelled";
  }

  if (nextStatus === "Return-Initiated") {
    order.fulfillment.state = "Return-Initiated";
    order.returnInfo = {
      ...order.returnInfo,
      requestedAt: new Date(),
      status: "pending",
    };
  }

  if (nextStatus === "Return-Rejected") {
    order.returnInfo = {
      ...order.returnInfo,
      status: "rejected",
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
