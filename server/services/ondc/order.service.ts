import { v4 as uuidv4 } from "uuid";
import { Order, type IOrder, type OrderStatus } from "../../models/Order";
import { Seller } from "../../models/Seller";
import { Product } from "../../models/Product";
import { resolveSellerFromOndcItemId } from "./catalog.service";
import type { ISeller } from "../../models/Seller";
import type { BecknContext } from "../../utils/beckn";

export { buildOrderMessage } from "./order-payload";

interface BecknOrderItem {
  id: string;
  quantity?: { count?: number };
}

export async function createOrderFromInit(
  context: BecknContext,
  items: BecknOrderItem[],
  customer?: any,
  providerId?: string
): Promise<IOrder> {
  const existing = await findOrderByTransaction(context.transaction_id);
  if (existing) return existing;

  let seller: ISeller | null = null;
  const orderItems = [];

  if (providerId) {
    seller = await Seller.findOne({
      ondcProviderId: providerId,
      "ondc.isActive": { $ne: false },
    });
    if (!seller) {
      throw new Error(`Seller not found for provider ID: ${providerId}`);
    }
  }

  for (const item of items) {
    const resolved = await resolveSellerFromOndcItemId(item.id, providerId);
    const product = resolved.product;
    const itemSeller = resolved.seller;
    const qty = Number(item.quantity?.count ?? 1);

    if (!product) {
      throw new Error(`Product not found: ${item.id}`);
    }
    if (!itemSeller?.ondc?.isActive) {
      throw new Error(`Seller is not active for item: ${item.id}`);
    }
    if (qty < 1) {
      throw new Error(`Invalid quantity for item: ${item.id}`);
    }
    if (product.quantity < qty) {
      throw new Error(`Insufficient stock for item: ${item.id}`);
    }

    if (!seller && itemSeller) {
      seller = itemSeller;
    }

    if (providerId && product.sellerId && seller && !product.sellerId.equals(seller._id)) {
      throw new Error(`Product ${item.id} does not belong to provider ${providerId}`);
    }
    if (!providerId && seller && itemSeller && !itemSeller._id.equals(seller._id)) {
      throw new Error("All ONDC order items must belong to the selected provider");
    }

    orderItems.push({
      productId: product._id,
      ondcItemId: product.ondcItemId,
      name: product.name,
      quantity: qty,
      price: product.price,
    });
  }

  if (!seller) {
    throw new Error("No seller found for ONDC order");
  }

  const amount = orderItems.reduce(
    (sum, i) => sum + i.price * i.quantity,
    0
  );

  const order = await Order.create({
    sellerId: seller._id,
    orderId: `ORD-${uuidv4().slice(0, 8).toUpperCase()}`,
    transactionId: context.transaction_id,
    channel: "ondc",
    status: "Created",
    items: orderItems,
    customer: customer ?? {},
    payment: {
      method: "cash",
      amount,
      status: "NOT-PAID",
      type: "ON-FULFILLMENT",
      collected_by: "BAP",
    },
    fulfillment: { type: "Delivery", state: "Pending" },
    locationId: `${seller.ondcProviderId || `SHOPNIX_${seller._id.toString().slice(-8)}`}-location`,
    gps:
      customer?.address?.gps ||
      "12.971599,77.594566",

    becknContext: {
      ...(context as unknown as Record<string, unknown>),

      providerId:
        seller.ondcProviderId ||
        `SHOPNIX_${seller._id.toString().slice(-8)}`,
    },
  });

  return order;
}

export async function reserveOrderInventory(order: IOrder) {
  for (const item of order.items) {
    const product = await Product.findById(item.productId).select("quantity");
    if (!product || product.quantity < item.quantity) {
      throw new Error(`Insufficient stock for ${item.name}`);
    }
  }

  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, {
      $inc: { quantity: -item.quantity },
    });
  }
}

export async function findOrderByTransaction(
  transactionId: string
): Promise<IOrder | null> {
  return Order.findOne({ transactionId }).sort({ createdAt: -1 });
}

export async function updateOrderStatus(
  transactionId: string,
  status: OrderStatus
): Promise<IOrder | null> {
  return Order.findOneAndUpdate(
    { transactionId },
    { status },
    { new: true }
  );
}

// ADD: Flow 3A — Merchant Partial Cancel
export async function partialCancelOrder(
  transactionId: string,
  cancelItems: Array<{ ondcItemId: string; quantity: number; reasonId?: string; reasonDesc?: string }>
): Promise<IOrder | null> {
  const order = await Order.findOne({ transactionId }).sort({ createdAt: -1 });
  if (!order) return null;

  // Validate each item exists and quantity is valid
  for (const ci of cancelItems) {
    const orderItem = order.items.find(i => i.ondcItemId === ci.ondcItemId);
    if (!orderItem) throw new Error(`Item not found in order: ${ci.ondcItemId}`);
    const alreadyCancelled = (order.cancelledItems ?? [])
      .filter(c => c.ondcItemId === ci.ondcItemId)
      .reduce((s, c) => s + c.quantity, 0);
    if (alreadyCancelled + ci.quantity > orderItem.quantity) {
      throw new Error(`Cannot cancel more than ordered qty for: ${ci.ondcItemId}`);
    }
  }

  // Record cancelled items
  const now = new Date();
  order.cancelledItems = order.cancelledItems ?? [];
  for (const ci of cancelItems) {
    const orderItem = order.items.find(i => i.ondcItemId === ci.ondcItemId)!;
    order.cancelledItems.push({
      ondcItemId: ci.ondcItemId,
      name: orderItem.name,
      quantity: ci.quantity,
      price: orderItem.price,
      reason: ci.reasonDesc,
      cancelledAt: now,
    });
    // Restock cancelled qty
    await Product.findOneAndUpdate(
      { ondcItemId: ci.ondcItemId },
      { $inc: { quantity: ci.quantity } }
    );
  }

  // Check if ALL items are cancelled → full cancel
  const totalOrderedQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const totalCancelledQty = order.cancelledItems.reduce((s, i) => s + i.quantity, 0);

  if (totalCancelledQty >= totalOrderedQty) {
    order.status = "Cancelled";
    order.fulfillment.state = "Cancelled";
  } else {
    order.status = "Partial-Cancelled";
    order.fulfillment.state = "Partially-Cancelled";
  }

  order.cancellationReasonId = cancelItems[0]?.reasonId || "002";
  order.cancellationReasonDesc = cancelItems[0]?.reasonDesc || "Cancelled by merchant";
  order.markModified("cancelledItems");
  await order.save();
  return order;
}

// ADD: Flow 3B — Merchant Full Cancel with RTO
export async function merchantFullCancelOrder(
  transactionId: string,
  reasonId: string,
  reasonDesc: string,
  rtoMode = false
): Promise<IOrder | null> {
  const order = await Order.findOne({ transactionId }).sort({ createdAt: -1 });
  if (!order) return null;

  order.status = "Cancelled";
  order.fulfillment.state = "Cancelled";
  order.cancellationReasonId = reasonId;
  order.cancellationReasonDesc = reasonDesc;

  if (rtoMode) {
    // RTO: Add all items as cancelled items
    order.cancelledItems = order.items.map(item => ({
      ondcItemId: item.ondcItemId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      reason: `RTO: ${reasonDesc}`,
      cancelledAt: new Date(),
    }));
    order.markModified("cancelledItems");
  }

  // Restock all items
  for (const item of order.items) {
    if (item.productId) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { quantity: item.quantity },
      });
    }
  }

  await order.save();
  return order;
}

// ADD: Flow 4A/4B — Buyer Initiated Return (triggered by /update from BAP)
export async function processReturnRequest(
  transactionId: string,
  returnItems: Array<{ ondcItemId: string; quantity: number; reasonId?: string; reasonDesc?: string }>,
  returnType: "full" | "partial"
): Promise<IOrder | null> {
  const order = await Order.findOne({ transactionId }).sort({ createdAt: -1 });
  if (!order) return null;

  if (order.status !== "Delivered") {
    throw new Error("Returns can only be initiated for delivered orders");
  }

  order.returnItems = order.returnItems ?? [];
  const now = new Date();

  for (const ri of returnItems) {
    const orderItem = order.items.find(i => i.ondcItemId === ri.ondcItemId);
    if (!orderItem) throw new Error(`Item not found: ${ri.ondcItemId}`);
    order.returnItems.push({
      ondcItemId: ri.ondcItemId,
      name: orderItem.name,
      quantity: ri.quantity,
      price: orderItem.price,
      reason: ri.reasonDesc,
      returnType,
      requestedAt: now,
      status: "pending",
    });
  }

  order.status = "Return-Initiated";
  order.fulfillment.state = "Return-Initiated";
  order.returnInfo = {
    ...order.returnInfo,
    requestedAt: now,
    status: "pending",
    reason: returnItems[0]?.reasonDesc,
  };

  order.markModified("returnItems");
  await order.save();
  return order;
}

// ADD: Flow 5 — Out of Stock error response builder
export function buildOutOfStockError(itemId: string) {
  return {
    error: {
      type: "DOMAIN-ERROR",
      code: "40002",
      path: "message/order/items",
      message: `Item ${itemId} is out of stock`,
    },
  };
}

// ADD: Flow 7 — Non-Cancellable error
export function buildNonCancellableError(orderId: string, fulfillmentState: string) {
  return {
    error: {
      type: "DOMAIN-ERROR",
      code: "40006",
      path: "message/order",
      message: `Order ${orderId} cannot be cancelled in state: ${fulfillmentState}`,
    },
  };
}

// ADD: IGM issue management (Flow 6A-F)
export async function createOrUpdateIgmIssue(
  transactionId: string,
  issueData: {
    issueId: string;
    bapIssueId?: string;
    category: "REFUND" | "REPLACEMENT" | "CANCEL" | "NO_ACTION";
    subCategory?: string;
    description?: string;
    status?: "OPEN" | "PROCESSING" | "RESOLVED" | "ESCALATED" | "CLOSED";
    resolution?: string;
    resolutionAction?: string;
  }
): Promise<IOrder | null> {
  const order = await Order.findOne({ transactionId }).sort({ createdAt: -1 });
  if (!order) return null;

  order.igmIssues = order.igmIssues ?? [];

  const existing = order.igmIssues.find(i => i.issueId === issueData.issueId);
  const now = new Date();

  if (existing) {
    existing.status = issueData.status ?? existing.status;
    existing.resolution = issueData.resolution ?? existing.resolution;
    existing.resolutionAction = issueData.resolutionAction ?? existing.resolutionAction;
    existing.updatedAt = now;
    if (issueData.status === "CLOSED") existing.closedAt = now;
    if (issueData.status === "ESCALATED") existing.escalatedAt = now;
  } else {
    order.igmIssues.push({
      issueId: issueData.issueId,
      bapIssueId: issueData.bapIssueId,
      category: issueData.category,
      subCategory: issueData.subCategory,
      status: issueData.status ?? "OPEN",
      description: issueData.description,
      resolution: issueData.resolution,
      resolutionAction: issueData.resolutionAction,
      createdAt: now,
    });
  }

  order.markModified("igmIssues");
  await order.save();
  return order;
}
