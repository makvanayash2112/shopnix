export const BUYER_ORDER_STEPS = [
  "Created",
  "Accepted",
  "Packed",
  "Agent-assigned",
  "Order-picked-up",
  "Delivering",
  "Delivered",
] as const;

export const STATUSES = [
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

export const STATUS_LABELS: Record<string, string> = {
  Created: "Order placed",
  Accepted: "Confirmed",
  Packed: "Packed",
  "Agent-assigned": "Agent assigned",
  "Order-picked-up": "Order picked up",
  Delivering: "Out for delivery",
  // Delivered: "Delivered",
  Delivered: "Order-delivered",
  Cancelled: "Cancelled",
  "Return-Requested": "Return requested",
  "Return-Approved": "Return approved",
  Returned: "Returned",
  "In-progress": "Packed",
  Completed: "Delivered",
};

export function displayStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function normalizeStatus(status: string): string {
  if (status === "In-progress") return "Packed";
  if (status === "Completed") return "Delivered";
  return status;
}
