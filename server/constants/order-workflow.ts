// export const ORDER_STATUSES = [
//   "Created",
//   "Accepted",
//   "Packed",
//   "Agent-assigned",
//   "Order-picked-up",
//   "Delivering",
//   "Delivered",
//   "Cancelled",
//   "Return-Requested",
//   "Return-Approved",
//   "Returned",
// ] as const;

// REPLACE the entire ORDER_STATUSES const:
export const ORDER_STATUSES = [
  "Created",
  "Accepted",
  "Packed",
  "Agent-assigned",
  "Order-picked-up",
  "Delivering",
  "Delivered",
  "Cancelled",
  "Partial-Cancelled",      // NEW: Flow 3A merchant partial cancel
  "Return-Initiated",       // NEW: Flow 4A/4B buyer initiates return via /update
  "Return-Requested",
  "Return-Approved",
  "Returned",
  "Return-Rejected",        // NEW: seller rejects return
] as const;


export type OrderStatus = (typeof ORDER_STATUSES)[number];

// export const SELLER_STATUS_FLOW: Record<string, OrderStatus[]> = {
//   Created: ["Accepted", "Cancelled"],
//   Accepted: ["Packed", "Cancelled"],
//   Packed: ["Agent-assigned", "Delivering", "Cancelled"],
//   "Agent-assigned": ["Order-picked-up", "Delivering", "Cancelled"],
//   "Order-picked-up": ["Delivering", "Cancelled"],
//   Delivering: ["Delivered"],
//   Delivered: [],
//   "Return-Requested": ["Return-Approved", "Returned"],
//   "Return-Approved": ["Returned"],
//   "In-progress": ["Agent-assigned", "Cancelled"],
//   Completed: [],
//   Cancelled: [],
//   Returned: [],
// };

// REPLACE entire SELLER_STATUS_FLOW:
export const SELLER_STATUS_FLOW: Record<string, OrderStatus[]> = {
  Created: ["Accepted", "Cancelled"],
  Accepted: ["Packed", "Cancelled", "Partial-Cancelled"],
  Packed: ["Agent-assigned", "Delivering", "Cancelled", "Partial-Cancelled"],
  "Agent-assigned": ["Order-picked-up", "Delivering", "Cancelled"],
  "Order-picked-up": ["Delivering", "Cancelled"],
  Delivering: ["Delivered"],
  Delivered: ["Return-Requested"],           // seller can log return after delivery
  "Partial-Cancelled": ["Packed", "Cancelled"],
  "Return-Initiated": ["Return-Approved", "Return-Rejected"],  // buyer initiated
  "Return-Requested": ["Return-Approved", "Return-Rejected", "Returned"],
  "Return-Approved": ["Returned"],
  "Return-Rejected": [],
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
    // ADD these entries to the map inside fulfillmentLabel:
    "Partial-Cancelled": "Partially-Cancelled",
    "Return-Initiated": "Return-Initiated",
    "Return-Rejected": "Return-Rejected",
  };
  return map[status] ?? status;
}


// ADD: ONDC standardized cancellation reason codes
export const CANCELLATION_REASON_CODES: Record<string, string> = {
  "001": "Price of one or more items have changed due to technical error",
  "002": "One or more items in the Order not available",
  "003": "Product available at lower than order price",
  "004": "Order in pending shipment / delivery state for a long time",
  "005": "Merchant rejected the order",
  "006": "Order not shipped after order processing time has expired",
  "007": "Order ready to ship but not picked up by logistics provider",
  "008": "Order picked up but not delivered",
  "009": "No attempt to deliver by logistics provider",
  "010": "Partly delivered",
  "011": "Delivery partner assigned but not reached pickup",
  "012": "Out of delivery area",
  "013": "Buyer not found or cannot be reached",
  "014": "Buyer rejected the package",
  "015": "Buyer not available at location",
  "016": "Accident/Calamity",
  "017": "Order delivery delayed or not possible",
  "018": "Delivery partner reached customer location but customer not reachable",
  "019": "Weather / other conditions preventing delivery",
  "020": "Seller want to cancel the order",
};

// ONDC return reason codes
export const RETURN_REASON_CODES: Record<string, string> = {
  "001": "Wrong item delivered",
  "002": "Physically Damaged",
  "003": "Poor quality",
  "004": "Expired product",
  "005": "Incorrect quantity",
  "006": "Item no longer needed",
};

// Non-cancellable fulfillment states (Flow 7)
export const NON_CANCELLABLE_STATES = [
  "Out-for-delivery",
  "Order-delivered",
  "Delivered",
] as const;

