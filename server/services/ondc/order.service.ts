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
