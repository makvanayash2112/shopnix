import type { IOrder } from "../../models/Order";
import type { ISeller } from "../../models/Seller";
import type { IProduct } from "../../models/Product";

export function buildSelectMessage(
  seller: ISeller,
  products: IProduct[],
  selectedItems: {
    id: string;
    quantity?: { count?: number };
  }[],
  orderId?: string
) {
  const items = products.map((product) => {
    const selected = selectedItems.find(
      (i) => i.id === product.ondcItemId
    );

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
    const selected = selectedItems.find(
      (i) => i.id === product.ondcItemId
    );

    const qty = Number(selected?.quantity?.count ?? 1);

    return sum + product.price * qty;
  }, 0);

  return {
    order: {
      ...(orderId ? { id: orderId } : {}),

      provider: {
        id:
          seller.ondcProviderId ||
          `SHOPNIX_${seller._id.toString().slice(-8)}`,

        locations: [
          {
            id: "L1",
          },
        ],
      },

      items,

      fulfillments: [
        {
          id: "F1",

          type: "Delivery",

          tracking: false,
        },
      ],

      quote: {
        price: {
          currency: "INR",

          value: String(total),
        },

        breakup: products.map((product) => {
          const selected = selectedItems.find(
            (i) => i.id === product.ondcItemId
          );

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

  return {
    order: {
      id: order.orderId,

      state: order.status,

      provider: {
        id: providerId,

        locations: [
          {
            id: order.locationId || "L1",
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
        name: order.customer?.name || "Customer",

        phone: order.customer?.phone || "9999999999",

        email:
          order.customer?.email || "customer@test.com",

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

        created_at: order.createdAt.toISOString(),

        updated_at: order.updatedAt.toISOString(),
      },

      fulfillments: [
        {
          id: "F1",

          type:
            order.fulfillment?.type || "Delivery",

          tracking:
            order.fulfillment?.tracking || false,

          state: {
            descriptor: {
              code:
                order.fulfillment?.state || "Pending",
            },
          },

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
        },
      ],

      payment: {
        type:
          order.payment?.type || "ON-FULFILLMENT",

        collected_by:
          order.payment?.collected_by || "BPP",

        status:
          order.payment?.status || "NOT-PAID",

        params: {
          amount: String(order.payment?.amount || 0),

          currency: "INR",
        },
      },

      quote: {
        price: {
          currency: "INR",

          value: String(order.payment?.amount || 0),
        },

        breakup: order.items.map((item) => ({
          title: item.name,

          price: {
            currency: "INR",

            value: String(
              item.price * item.quantity
            ),
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