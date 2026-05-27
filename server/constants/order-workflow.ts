export const ORDER_STATUSES = [
  "Created",
  "Accepted",
  "Packed",
  "Agent-assigned",
  "Order-picked-up",
  "Delivering",
  "Delivered",
  "Cancelled",
  "Return-Requested",
  "Return-Approved",
  "Returned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const SELLER_STATUS_FLOW: Record<string, OrderStatus[]> = {
  Created: ["Accepted", "Cancelled"],
  Accepted: ["Packed", "Cancelled"],
  Packed: ["Agent-assigned", "Cancelled"],
  "Agent-assigned": ["Order-picked-up", "Cancelled"],
  "Order-picked-up": ["Delivering", "Cancelled"],
  Delivering: ["Delivered"],
  Delivered: [],
  "Return-Requested": ["Return-Approved", "Returned"],
  "Return-Approved": ["Returned"],
  "In-progress": ["Agent-assigned", "Cancelled"],
  Completed: [],
  Cancelled: [],
  Returned: [],
};

export const RETURN_WINDOW_DAYS = 7;

export const RETURN_POLICY = {
  windowDays: RETURN_WINDOW_DAYS,
  title: "7-Day Return Policy",
  summary:
    "Returns can be handled by the seller within 7 calendar days after delivery.",
  rules: [
    "Return window starts when order status is Delivered.",
    "Cash refunds are processed after seller approves the return.",
    "Orders cannot be cancelled once status is Delivering or Delivered.",
    "Return is not available for Cancelled or already Returned orders.",
  ],
};

export function normalizeLegacyStatus(status: string): OrderStatus {
  if (status === "In-progress") return "Packed";
  if (status === "Completed") return "Delivered";
  return status as OrderStatus;
}

export function fulfillmentLabel(status: string): string {
  const map: Record<string, string> = {
    Created: "Order placed",
    Accepted: "Confirmed by seller",
    Packed: "Packed and ready to ship",
    "Agent-assigned": "Agent-assigned",
    "Order-picked-up": "Order-picked-up",
    Delivering: "Out for delivery",
    // Delivered: "Delivered",
    Delivered: "Order-delivered",
    Cancelled: "Cancelled",
    "Return-Requested": "Return requested",
    "Return-Approved": "Return approved",
    Returned: "Return completed",
    "In-progress": "Packed and ready to ship",
    Completed: "Order-delivered",
  };
  return map[status] ?? status;
}
