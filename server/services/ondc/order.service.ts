import { v4 as uuidv4 } from "uuid";
import { Order, type IOrder, type OrderStatus } from "../../models/Order";
import { Product } from "../../models/Product";
import { getPrimarySeller } from "../seller.service";
import type { BecknContext } from "../../utils/beckn";

interface BecknOrderItem {
  id: string;
  quantity?: { count?: number };
}

export async function createOrderFromInit(
  context: BecknContext,
  items: BecknOrderItem[],
  customer?: Record<string, unknown>
): Promise<IOrder> {
  const seller = await getPrimarySeller();
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findOne({ ondcItemId: item.id });
    const qty = Number(item.quantity?.count ?? 1);
    if (product) {
      orderItems.push({
        productId: product._id,
        ondcItemId: product.ondcItemId,
        name: product.name,
        quantity: qty,
        price: product.price,
      });
    }
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
    },
    fulfillment: { type: "Delivery", state: "Pending" },
    becknContext: context as unknown as Record<string, unknown>,
  });

  return order;
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

export function buildOrderMessage(order: IOrder) {
  return {
    order: {
      id: order.orderId,
      state: order.status,
      items: order.items.map((item) => ({
        id: item.ondcItemId,
        quantity: { count: item.quantity },
        fulfillment_id: "F1",
      })),
      billing: {
        name: order.customer?.name || "Customer",
        email: order.customer?.email,
        phone: order.customer?.phone,
        address: order.customer?.address,
      },
      fulfillments: [
        {
          id: "F1",
          type: order.fulfillment?.type || "Delivery",
          state: {
            descriptor: { code: order.fulfillment?.state || "Pending" },
          },
          tracking: order.fulfillment?.tracking,
        },
      ],
      payment: {
        type: order.payment?.type || "ON-ORDER",
        status: order.payment?.status || "NOT-PAID",
        collected_by: "BPP",
        params: { amount: String(order.payment?.amount ?? 0), currency: "INR" },
      },
      quote: {
        price: {
          currency: "INR",
          value: String(order.payment?.amount ?? 0),
        },
      },
    },
  };
}
