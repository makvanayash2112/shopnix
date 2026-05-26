import { v4 as uuidv4 } from "uuid";
import { Order, type IOrder, type OrderStatus } from "../../models/Order";
import { Seller } from "../../models/Seller";
import { Product } from "../../models/Product";
import { resolveSellerFromOndcItemId } from "./catalog.service";
import type { ISeller } from "../../models/Seller";
import type { BecknContext } from "../../utils/beckn";

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

  // If provider ID is specified, use that seller exclusively
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

    // If we haven't determined seller yet, use first resolved seller
    if (!seller && itemSeller) {
      seller = itemSeller;
    }

    // Verify product belongs to the right seller if provider was specified
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
    // payment: {
    //   method: "cash",
    //   amount,
    //   status: "NOT-PAID",
    //   type: "ON-FULFILLMENT",
    // },
    // payment: {
    //   type:
    //     order.payment?.type || "ON-ORDER",

    //   status:
    //     order.payment?.status || "NOT-PAID",

    //   collected_by: "BPP",

    //   params: {
    //     amount: String(order.payment?.amount ?? 0),

    //     currency: "INR",
    //   },
    // },

    payment: {
      method: "cash",

      amount,

      status: "NOT-PAID",

      type: "ON-FULFILLMENT",
    },

    // cancellation_terms: [],
    // tags: [],
    fulfillment: { type: "Delivery", state: "Pending" },
    // becknContext: {
    //   ...(context as unknown as Record<string, unknown>),
    //   providerId:
    //     seller.ondcProviderId || `SHOPNIX_${seller._id.toString().slice(-8)}`,
    // },
    locationId: "L1",

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

export function buildOrderMessage(order: IOrder) {
  const providerId =
    typeof order.becknContext?.providerId === "string"
      ? order.becknContext.providerId
      : undefined;

  return {
    order: {
      id: order.orderId,
      state: order.status,
      ...(providerId ? {
        provider: {
          id: providerId,
          locations: [
            {
              id: order.locationId || "L1",
            },
          ],
        }
      } : {}),
      items: order.items.map((item) => ({
        id: item.ondcItemId,
        quantity: { count: item.quantity },
        fulfillment_id: "F1",
      })),
      // billing: {
      //   name: order.customer?.name || "Customer",
      //   email: order.customer?.email,
      //   phone: order.customer?.phone,
      //   address: order.customer?.address,
      // },
      billing: {
        name: order.customer?.name || "Customer",

        email:
          order.customer?.email || "customer@test.com",

        phone:
          order.customer?.phone || "9999999999",

        address: {
          name:
            order.customer?.address?.name || "Home",

          building:
            order.customer?.address?.building ||
            "123",

          locality:
            order.customer?.address?.locality ||
            "MG Road",

          city:
            order.customer?.address?.city ||
            "Bengaluru",

          state:
            order.customer?.address?.state ||
            "Karnataka",

          country:
            order.customer?.address?.country ||
            "IND",

          area_code:
            order.customer?.address?.area_code ||
            "560001",
        },

        tax_number: "",

        created_at: order.createdAt.toISOString(),

        updated_at: order.updatedAt.toISOString(),
      },
      // fulfillments: [
      //   {
      //     id: "F1",
      //     type: order.fulfillment?.type || "Delivery",
      //     state: {
      //       descriptor: { code: order.fulfillment?.state || "Pending" },
      //     },
      //     tracking: order.fulfillment?.tracking,
      //     tags: [
      //       {
      //         code: "routing",
      //         list: [{ code: "type", value: "P2P" }],
      //       },
      //     ],
      //   },
      // ],
      fulfillments: [
        {
          id: "F1",

          type:
            order.fulfillment?.type || "Delivery",

          state: {
            descriptor: {
              code:
                order.fulfillment?.state || "Pending",
            },
          },

          tracking: false,

          end: {
            contact: {
              phone:
                order.customer?.phone ||
                "9999999999",

              email:
                order.customer?.email ||
                "customer@test.com",
            },

            location: {
              gps:
                order.gps ||
                "12.971599,77.594566",

              address: {
                name:
                  order.customer?.address?.name ||
                  "Home",

                building:
                  order.customer?.address?.building ||
                  "123",

                locality:
                  order.customer?.address?.locality ||
                  "MG Road",

                city:
                  order.customer?.address?.city ||
                  "Bengaluru",

                state:
                  order.customer?.address?.state ||
                  "Karnataka",

                country:
                  order.customer?.address?.country ||
                  "IND",

                area_code:
                  order.customer?.address?.area_code ||
                  "560001",
              },
            },
          },

          tags: [
            {
              code: "routing",

              list: [
                {
                  code: "type",
                  value: "P2P",
                },
              ],
            },
          ],
        },
      ],
      payment: {
        type: order.payment?.type || "ON-ORDER",
        status: order.payment?.status || "NOT-PAID",
        collected_by: "BPP",
        params: { amount: String(order.payment?.amount ?? 0), currency: "INR" },
      },
      // quote: {
      //   price: {
      //     currency: "INR",
      //     value: String(order.payment?.amount ?? 0),
      //   },
      //   breakup: order.items.map((item) => ({
      //     title: item.name,
      //     price: {
      //       currency: "INR",
      //       value: String(item.price * item.quantity),
      //     },
      //     item: { id: item.ondcItemId },
      //   })),
      // },
      quote: {
        price: {
          currency: "INR",

          value: String(order.payment?.amount ?? 0),
        },

        breakup: order.items.map((item) => ({
          title: item.name,

          price: {
            currency: "INR",

            value: String(item.price * item.quantity),
          },

          item: {
            id: item.ondcItemId,
          },
        })),

        ttl: "P1D",
      },
    },
  };
}
