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

function resolveSellerContact(seller: ISeller) {
  return {
    name: seller.storeName || "Shopnix Store",
    phone: seller.phone || "9999999999",
    email: seller.email || "support@shopnix.local",
  };
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
          state: {
            descriptor: { code: "Pending" },
          },
          start: {
            contact: sellerContact,
            time: {
              range: {
                start: new Date().toISOString(),
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
  const timestamp = order.createdAt?.toISOString?.() || new Date().toISOString();
  const updatedAt = order.updatedAt?.toISOString?.() || timestamp;
  const paymentAmount = String(order.payment?.amount ?? 0);
  const paymentType = order.payment?.type || "ON-FULFILLMENT";
  const paymentStatus = order.payment?.status || "NOT-PAID";

  return {
    order: {
      id: order.orderId,
      state: order.status,
      ...(providerId
        ? {
            provider: {
              id: providerId,
              locations: [{ id: locationId }],
            },
          }
        : {}),
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
        created_at: timestamp,
        updated_at: updatedAt,
      },
      fulfillments: [
        {
          id: "F1",
          type: order.fulfillment?.type || "Delivery",
          tracking: Boolean(order.fulfillment?.tracking),
          state: {
            descriptor: {
              code: order.fulfillment?.state || "Pending",
            },
          },
          start: {
            location: {
              id: locationId,
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
            location: {
              id: `${locationId}-customer`,
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
        },
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
