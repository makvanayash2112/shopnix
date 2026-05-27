import type { IOrder } from "../../models/Order";
import type { ISeller } from "../../models/Seller";
import type { IProduct } from "../../models/Product";

function resolveProviderId(seller: ISeller): string {
  return seller.ondcProviderId || `SHOPNIX_${seller._id.toString().slice(-8)}`;
}

function resolveLocationId(providerId: string): string {
  return `${providerId}-location`;
}

function resolveBillingAddress(order: IOrder) {
  return {
    name: order.customer?.address?.name || order.customer?.name || "Home",
    building: order.customer?.address?.building || "123",
    locality: order.customer?.address?.locality || "MG Road",
    city: order.customer?.address?.city || "Bengaluru",
    state: order.customer?.address?.state || "Karnataka",
    country: order.customer?.address?.country || "IND",
    area_code: order.customer?.address?.area_code || "560001",
  };
}

function resolveCustomerContact(order: IOrder) {
  return {
    name: order.customer?.name || "Customer",
    phone: order.customer?.phone || "9999999999",
    email: order.customer?.email || "customer@test.com",
  };
}

function normalizeBecknOrderState(state?: string): string {
  switch (state) {
    case "Created":
      return "Created";
    case "Accepted":
    case "In-progress":
    case "Packed":
    case "Agent-assigned":
    case "Order-picked-up":
    case "Delivering":
      return "Accepted";
    case "Delivered":
    case "Completed":
      return "Completed";
    case "Cancelled":
      return "Cancelled";
    case "Return-Requested":
    case "Return-Approved":
    case "Returned":
      return "Accepted";
    default:
      return "Created";
  }
}

function resolveSellerContact(seller: ISeller) {
  return {
    name: seller.storeName || "Shopnix Store",
    phone: seller.phone || "9999999999",
    email: seller.email || "support@shopnix.local",
  };
}

function resolveTaxNumber(order: IOrder): string {
  return (
    order.customer?.address?.area_code ||
    order.customer?.phone ||
    "NA"
  );
}

function resolveContextTimestamp(order: IOrder, fallback: string): string {
  return typeof order.becknContext?.timestamp === "string"
    ? order.becknContext.timestamp
    : fallback;
}

function resolveOrderTimestamp(order: IOrder, fallback?: string): string {
  return typeof order.becknContext?.timestamp === "string"
    ? order.becknContext.timestamp
    : (order.createdAt?.toISOString?.() || fallback || new Date().toISOString());
}

export function buildSelectMessage(
  seller: ISeller,
  products: IProduct[],
  selectedItems: {
    id: string;
    quantity?: { count?: number };
  }[],
  orderId?: string
) {
  const providerId = resolveProviderId(seller);
  const locationId = resolveLocationId(providerId);
  const sellerContact = resolveSellerContact(seller);
  const timestamp = new Date().toISOString();

  const items = products.map((product) => {
    const selected = selectedItems.find((i) => i.id === product.ondcItemId);
    const qty = Number(selected?.quantity?.count ?? 1);

    return {
      id: product.ondcItemId,
      fulfillment_id: "F1",
      quantity: {
        count: qty,
      },
    };
  });

  const total = products.reduce((sum, product) => {
    const selected = selectedItems.find((i) => i.id === product.ondcItemId);
    const qty = Number(selected?.quantity?.count ?? 1);
    return sum + product.price * qty;
  }, 0);

  return {
    order: {
      ...(orderId ? { id: orderId } : {}),
      provider: {
        id: providerId,
        locations: [{ id: locationId }],
      },
      items,
      fulfillments: [
        {
          id: "F1",
          type: "Delivery",
          tracking: false,
          "@ondc/org/provider_name": seller.storeName || "Shopnix Store",
          "@ondc/org/category": "home-delivery",
          "@ondc/org/TAT": "PT24H",
          state: {
            descriptor: { code: "Pending" },
          },
          start: {
            contact: sellerContact,
            time: {
              range: {
                start: timestamp,
                end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              },
            },
            location: {
              id: locationId,
              descriptor: { name: seller.storeName || "Shopnix Store" },
              gps: "12.971599,77.594566",
              address: {
                name: seller.storeName || "Shopnix Store",
                building: seller.address?.street || "Store",
                locality: seller.address?.city || "MG Road",
                city: seller.address?.city || "Bengaluru",
                state: seller.address?.state || "Karnataka",
                country: "IND",
                area_code: seller.address?.pincode || "560001",
              },
            },
          },
          end: {
            contact: {
              name: "Customer",
              phone: "9999999999",
              email: "customer@test.com",
            },
            location: {
              id: "customer-location",
              gps: "12.971599,77.594566",
              address: {
                name: "Home",
                building: "123",
                locality: "MG Road",
                city: "Bengaluru",
                state: "Karnataka",
                country: "IND",
                area_code: "560001",
              },
            },
          },
        },
      ],
      quote: {
        price: {
          currency: "INR",
          value: String(total),
        },
        breakup: products.map((product) => {
          const selected = selectedItems.find((i) => i.id === product.ondcItemId);
          const qty = Number(selected?.quantity?.count ?? 1);
          return {
            title: product.name,
            price: {
              currency: "INR",
              value: String(product.price * qty),
            },
            item: {
              id: product.ondcItemId,
            },
          };
        }),
        ttl: "P1D",
      },
    },
  };
}

export function buildOrderMessage(order: IOrder) {
  const providerId =
    typeof order.becknContext?.providerId === "string"
      ? order.becknContext.providerId
      : undefined;
  const resolvedProviderId = providerId || "SHOPNIX";
  const locationId = order.locationId || resolveLocationId(resolvedProviderId);
  const address = resolveBillingAddress(order);
  const contact = resolveCustomerContact(order);
  const sellerContact = {
    name: "Shopnix Store",
    phone: "9999999999",
    email: "support@shopnix.local",
  };
  const timestamp = order.createdAt?.toISOString?.() || new Date().toISOString();
  const updatedAt = order.updatedAt?.toISOString?.() || timestamp;
  const paymentAmount = String(order.payment?.amount ?? 0);
  const paymentType = order.payment?.type || "ON-FULFILLMENT";
  const paymentStatus = order.payment?.status || "NOT-PAID";
  const taxNumber = resolveTaxNumber(order);
  const createdAt = resolveOrderTimestamp(
    order,
    resolveContextTimestamp(order, timestamp)
  );
  const updatedAtOrder = order.updatedAt?.toISOString?.() || createdAt;

  return {
    order: {
      id: order.orderId,
      state: normalizeBecknOrderState(order.status),
      provider: {
        id: resolvedProviderId,
        locations: [{ id: locationId }],
        tags: [
          {
            code: "selection",
            list: [{ code: "seller_id", value: resolvedProviderId }],
          },
        ],
      },
      items: order.items.map((item) => ({
        id: item.ondcItemId,
        fulfillment_id: "F1",
        quantity: {
          count: item.quantity,
        },
      })),
      billing: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        address,
        tax_number: taxNumber,
        created_at: createdAt,
        updated_at: createdAt,
      },
      cancellation_terms: [],
      tags: [
        {
          code: "order_type",
          list: [{ code: "type", value: "B2C" }],
        },
      ],
      created_at: createdAt,
      updated_at: updatedAtOrder,
      fulfillments: [
        {
          id: "F1",
          type: order.fulfillment?.type || "Delivery",
          tracking: Boolean(order.fulfillment?.tracking),
          "@ondc/org/provider_name": resolvedProviderId,
          "@ondc/org/TAT": "PT24H",
          state: {
            descriptor: {
              code: order.fulfillment?.state || "Pending",
            },
          },
          start: {
            contact: sellerContact,
            person: {
              name: sellerContact.name,
            },
            time: {
              timestamp: createdAt,
              range: {
                start: createdAt,
                end: updatedAtOrder,
              },
            },
            location: {
              id: locationId,
              descriptor: {
                name: "Store",
              },
              gps: order.gps || "12.971599,77.594566",
              address,
            },
          },
          end: {
            contact: {
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
            },
            person: {
              name: contact.name,
            },
            time: {
              timestamp: updatedAtOrder,
              range: {
                start: createdAt,
                end: updatedAtOrder,
              },
            },
            location: {
              id: `${locationId}-customer`,
              descriptor: {
                name: "Customer",
              },
              gps: order.gps || "12.971599,77.594566",
              address,
            },
          },
          tags: [
            {
              code: "routing",
              list: [{ code: "type", value: "P2P" }],
            },
          ],
        },
      ],
      payment: {
        type: paymentType,
        status: paymentStatus,
        collected_by: "BPP",
        params: {
          amount: paymentAmount,
          currency: "INR",
          transaction_id: String(order.transactionId || order.orderId),
        },
        "@ondc/org/buyer_app_finder_fee_type": "percent",
        "@ondc/org/buyer_app_finder_fee_amount": "0",
        "@ondc/org/settlement_basis": "delivery",
        "@ondc/org/settlement_window": "P1D",
        "@ondc/org/withholding_amount": "0",
        "@ondc/org/settlement_details": [],
      },
      quote: {
        price: {
          currency: "INR",
          value: paymentAmount,
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
