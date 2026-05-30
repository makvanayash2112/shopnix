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

// function normalizeBecknOrderState(status?: string, fulfillmentState?: string): string {
//   const fState = fulfillmentState || "Pending";
//   if (
//     fState === "Packed" ||
//     fState === "Agent-assigned" ||
//     fState === "Order-picked-up" ||
//     fState === "Out-for-delivery" ||
//     fState === "Delivering"
//   ) {
//     return "In-progress";
//   }
//   if (fState === "Order-delivered") {
//     return "Completed";
//   }
//   switch (status) {
//     case "Created": return "Created";
//     case "Accepted": return "Accepted";
//     case "In-progress": return "In-progress";
//     case "Completed": return "Completed";
//     case "Cancelled": return "Cancelled";
//     case "Return-Requested":
//     case "Return-Approved": return "Completed";
//     default: return "Created";
//   }
// }

// REPLACE the function:


function normalizeBecknOrderState(status?: string, fulfillmentState?: string): string {
  const fState = fulfillmentState || "Pending";
  if (
    fState === "Packed" ||
    fState === "Agent-assigned" ||
    fState === "Order-picked-up" ||
    fState === "Out-for-delivery" ||
    fState === "Delivering"
  ) {
    return "In-progress";
  }
  if (fState === "Order-delivered") return "Completed";
  if (fState === "Cancelled") return "Cancelled";
  if (fState === "Partially-Cancelled") return "In-progress"; // partial cancel still active

  switch (status) {
    case "Created": return "Created";
    case "Accepted": return "Accepted";
    case "In-progress": return "In-progress";
    case "Completed": return "Completed";
    case "Cancelled": return "Cancelled";
    case "Partial-Cancelled": return "In-progress";
    case "Return-Requested":
    case "Return-Initiated":
    case "Return-Approved": return "Completed";
    case "Returned": return "Completed";
    default: return "Created";
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
        breakup: [
          ...products.map((product) => {
            const selected = selectedItems.find((i) => i.id === product.ondcItemId);
            const qty = Number(selected?.quantity?.count ?? 1);
            return {
              "@ondc/org/item_id": product.ondcItemId,
              "@ondc/org/item_quantity": { count: qty },
              "@ondc/org/title_type": "item",
              title: product.name,
              price: {
                currency: "INR",
                value: String(product.price * qty),
              },
              item: {
                id: product.ondcItemId,
                quantity: {
                  count: qty,
                  available: { count: String(qty) },
                  maximum: { count: String(qty) },
                },
                price: {
                  currency: "INR",
                  value: String(product.price * qty),
                },
              },
            };
          }),
          {
            "@ondc/org/item_id": products[0]?.ondcItemId || "item",
            "@ondc/org/title_type": "delivery",
            title: "Delivery Charges",
            price: { currency: "INR", value: "0" },
            item: { id: products[0]?.ondcItemId || "item" },
          },
          {
            "@ondc/org/item_id": products[0]?.ondcItemId || "item",
            "@ondc/org/title_type": "tax",
            title: "Tax",
            price: { currency: "INR", value: "0" },
            item: { id: products[0]?.ondcItemId || "item" },
          },
        ],

        ttl: "P1D",
      },
    },
  };
}

// export function buildOrderMessage(order: IOrder) {
//   const providerId =
//     typeof order.becknContext?.providerId === "string"
//       ? order.becknContext.providerId
//       : undefined;
//   const resolvedProviderId = providerId || "SHOPNIX";
//   const locationId = order.locationId || resolveLocationId(resolvedProviderId);
//   const address = resolveBillingAddress(order);
//   const contact = resolveCustomerContact(order);
//   const sellerContact = {
//     name: "Shopnix Store",
//     phone: "9999999999",
//     email: "support@shopnix.local",
//   };
//   const timestamp = order.createdAt?.toISOString?.() || new Date().toISOString();
//   const updatedAt = order.updatedAt?.toISOString?.() || timestamp;
//   const paymentAmount = String(order.payment?.amount ?? 0);
//   const paymentType = order.payment?.type || "ON-FULFILLMENT";
//   const paymentStatus = order.payment?.status || "NOT-PAID";
//   const taxNumber = resolveTaxNumber(order);
//   const billingCreatedAt = typeof order.becknContext?.billing_created_at === "string"
//     ? order.becknContext.billing_created_at : (order.createdAt?.toISOString?.() || new Date().toISOString());
//   const billingUpdatedAt = typeof order.becknContext?.billing_updated_at === "string"
//     ? order.becknContext.billing_updated_at : billingCreatedAt;

//   const orderCreatedAt = typeof order.becknContext?.confirm_order_created_at === "string"
//     ? order.becknContext.confirm_order_created_at
//     : (typeof order.becknContext?.init_order_created_at === "string" ? order.becknContext.init_order_created_at : billingCreatedAt);

//   const orderUpdatedAt = typeof order.becknContext?.confirm_order_updated_at === "string"
//     ? order.becknContext.confirm_order_updated_at
//     : (typeof order.becknContext?.init_order_updated_at === "string" ? order.becknContext.init_order_updated_at : billingUpdatedAt);

//   return {
//     order: {
//       id: order.orderId,
//       state: normalizeBecknOrderState(order.status, order.fulfillment?.state),
//       provider: {
//         id: resolvedProviderId,
//         locations: [{ id: locationId }],
//         tags: [
//           {
//             code: "selection",
//             list: [{ code: "seller_id", value: resolvedProviderId }],
//           },
//         ],
//       },
//       items: order.items.map((item) => ({
//         id: item.ondcItemId,
//         fulfillment_id: "F1",
//         quantity: {
//           count: item.quantity,
//         },
//       })),
//       billing: {
//         name: contact.name,
//         phone: contact.phone,
//         email: contact.email,
//         address,
//         tax_number: taxNumber,
//         created_at: billingCreatedAt,
//         updated_at: billingUpdatedAt,
//       },
//       cancellation_terms: [
//         {
//           fulfillment_state: {
//             descriptor: {
//               code: "Pending",
//               short_desc: "Pending"
//             }
//           },
//           refund_eligible: true,
//           reason_required: false,
//           cancellation_fee: {
//             amount: {
//               currency: "INR",
//               value: "0"
//             },
//             percentage: "0"
//           }
//         }
//       ],
//       tags: [
//         {
//           code: "bpp_terms",
//           list: [
//             { code: "np_type", value: "MSN" },
//             { code: "tax_number", value: taxNumber }
//           ],
//         },
//       ],
//       created_at: orderCreatedAt,
//       updated_at: orderUpdatedAt,
//       fulfillments: [
//         {
//           id: "F1",
//           type: order.fulfillment?.type || "Delivery",
//           tracking: Boolean(order.fulfillment?.tracking),
//           "@ondc/org/provider_name": resolvedProviderId,
//           "@ondc/org/TAT": "PT24H",
//           state: {
//             descriptor: {
//               code: order.fulfillment?.state || "Pending",
//             },
//           },
//           start: {
//             contact: sellerContact,
//             person: {
//               name: sellerContact.name,
//             },
//             time: {
//               timestamp: orderCreatedAt,
//               range: {
//                 start: orderCreatedAt,
//                 end: orderCreatedAt,
//               },
//             },
//             location: {
//               id: locationId,
//               descriptor: {
//                 name: "Store",
//               },
//               gps: order.gps || "12.971599,77.594566",
//               address,
//             },
//           },
//           end: {
//             contact: {
//               name: contact.name,
//               phone: contact.phone,
//               email: contact.email,
//             },
//             person: {
//               name: contact.name,
//             },
//             time: {
//               timestamp: orderCreatedAt,
//               range: {
//                 start: orderCreatedAt,
//                 end: orderCreatedAt,
//               },
//             },
//             location: {
//               id: `${locationId}-customer`,
//               descriptor: {
//                 name: "Customer",
//               },
//               gps: order.gps || "12.971599,77.594566",
//               address,
//             },
//           },
//           tags: [
//             {
//               code: "routing",
//               list: [{ code: "type", value: "P2P" }],
//             },
//           ],
//         },
//       ],
//       payment: {
//         type: paymentType,
//         status: paymentStatus,
//         collected_by: "BPP",
//         params: {
//           amount: paymentAmount,
//           currency: "INR",
//           transaction_id: String(order.transactionId || order.orderId),
//         },
//         "@ondc/org/buyer_app_finder_fee_type": "percent",
//         "@ondc/org/buyer_app_finder_fee_amount": "0",
//         "@ondc/org/settlement_basis": "delivery",
//         "@ondc/org/settlement_window": "P1D",
//         "@ondc/org/withholding_amount": "0",
//         "@ondc/org/settlement_details": [
//           {
//             settlement_counterparty: "seller-app",
//             settlement_phase: "sale-amount",
//             settlement_type: "upi",
//             upi_address: "shopnix@upi",
//             settlement_bank_account_no: "1234567890",
//             settlement_ifsc_code: "IFSC0001234",
//             beneficiary_name: "Shopnix Seller",
//             bank_name: "Test Bank",
//             branch_name: "Test Branch"
//           }
//         ],
//       },
//       quote: {
//         price: {
//           currency: "INR",
//           value: paymentAmount,
//         },
//         breakup: order.items.map((item) => ({
//           title: item.name,
//           price: {
//             currency: "INR",
//             value: String(item.price * item.quantity),
//           },
//           item: {
//             id: item.ondcItemId,
//           },
//         })),
//         ttl: "P1D",
//       },
//     },
//   };
// }

// REPLACE the entire buildOrderMessage function:



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

  const paymentType = order.payment?.type || "ON-FULFILLMENT";
  const paymentStatus = order.payment?.status || "NOT-PAID";
  const taxNumber = resolveTaxNumber(order);

  const billingCreatedAt = typeof order.becknContext?.init_order_created_at === "string"
    ? order.becknContext.init_order_created_at
    : (typeof order.becknContext?.billing_created_at === "string"
      ? order.becknContext.billing_created_at
      : (order.createdAt?.toISOString?.() || new Date().toISOString()));
  const billingUpdatedAt = typeof order.becknContext?.init_order_updated_at === "string"
    ? order.becknContext.init_order_updated_at
    : (typeof order.becknContext?.billing_updated_at === "string"
      ? order.becknContext.billing_updated_at
      : billingCreatedAt);

  const orderCreatedAt = typeof order.becknContext?.confirm_order_created_at === "string"
    ? order.becknContext.confirm_order_created_at
    : (typeof order.becknContext?.init_order_created_at === "string"
      ? order.becknContext.init_order_created_at
      : billingCreatedAt);

  const orderUpdatedAt = typeof order.becknContext?.confirm_order_updated_at === "string"
    ? order.becknContext.confirm_order_updated_at
    : (typeof order.becknContext?.init_order_updated_at === "string"
      ? order.becknContext.init_order_updated_at
      : billingUpdatedAt);

  // Active items: subtract cancelled items for partial cancel
  const cancelledItemIds = (order.cancelledItems ?? []).map(ci => ci.ondcItemId);
  const cancelledQtyMap: Record<string, number> = {};
  (order.cancelledItems ?? []).forEach(ci => {
    cancelledQtyMap[ci.ondcItemId] = (cancelledQtyMap[ci.ondcItemId] || 0) + ci.quantity;
  });

  const returnItemIds = (order.returnItems ?? []).map(ri => ri.ondcItemId);
  const returnQtyMap: Record<string, number> = {};
  (order.returnItems ?? []).forEach(ri => {
    returnQtyMap[ri.ondcItemId] = (returnQtyMap[ri.ondcItemId] || 0) + ri.quantity;
  });

  // Build items array — only include active quantities, keep cancellation metadata in fulfillments and quote
  const activeItems = order.items.flatMap((item) => {
    const cancelledQty = cancelledQtyMap[item.ondcItemId] || 0;
    const returnQty = returnQtyMap[item.ondcItemId] || 0;
    const activeQty = item.quantity - cancelledQty - returnQty;
    if (activeQty <= 0) return [];
    return [{
      id: item.ondcItemId,
      fulfillment_id: "F1",
      quantity: { count: activeQty },
      ...(cancelledQty > 0 ? {
        tags: [
          {
            code: "type",
            list: [{ code: "type", value: "item" }],
          },
          {
            code: "cancellation",
            list: [
              { code: "cancel_reason_id", value: order.cancellationReasonId || "002" },
              { code: "cancelled_qty", value: String(cancelledQty) },
            ],
          },
        ],
      } : {}),
    }];
  });

  // Cancellation terms per fulfillment state — required for Flow 3A/3B/3C/7
  const cancellationTerms = [
    {
      fulfillment_state: {
        descriptor: { code: "Pending", short_desc: "Pending" }
      },
      refund_eligible: true,
      reason_required: false,
      cancellation_fee: { amount: { currency: "INR", value: "0" }, percentage: "0" }
    },
    {
      fulfillment_state: {
        descriptor: { code: "Packed", short_desc: "Packed" }
      },
      refund_eligible: true,
      reason_required: true,
      cancellation_fee: { amount: { currency: "INR", value: "0" }, percentage: "0" }
    },
    {
      fulfillment_state: {
        descriptor: { code: "Agent-assigned", short_desc: "Agent Assigned" }
      },
      refund_eligible: true,
      reason_required: true,
      cancellation_fee: { amount: { currency: "INR", value: "0" }, percentage: "0" }
    },
    {
      fulfillment_state: {
        descriptor: { code: "Order-picked-up", short_desc: "Order Picked Up" }
      },
      refund_eligible: true,
      reason_required: true,
      cancellation_fee: { amount: { currency: "INR", value: "0" }, percentage: "0" }
    },
    {
      fulfillment_state: {
        descriptor: { code: "Out-for-delivery", short_desc: "Out for Delivery" }
      },
      refund_eligible: false,
      reason_required: true,
      cancellation_fee: { amount: { currency: "INR", value: "0" }, percentage: "0" }
    },
  ];

  // Quote — recalculate for partial cancel
  const totalAmount = order.items.reduce((sum, item) => {
    const cancelledQty = cancelledQtyMap[item.ondcItemId] || 0;
    const returnQty = returnQtyMap[item.ondcItemId] || 0;
    const activeQty = item.quantity - cancelledQty - returnQty;
    return sum + item.price * Math.max(0, activeQty);
  }, 0);

  const primaryItemId = order.items[0]?.ondcItemId || "item";

  // Build quote breakup with item + delivery + refund breakdown
  const quoteBreakup: Array<{
    "@ondc/org/item_id"?: string;
    "@ondc/org/item_quantity"?: { count: number };
    "@ondc/org/title_type": string;
    title: string;
    price: { currency: string; value: string };
    item?: {
      id: string;
      quantity?: {
        count?: number;
        available?: { count: string };
        maximum?: { count: string };
      };
      price?: { currency: string; value: string };
    };
  }> = [];

  order.items.forEach((item) => {
    const cancelledQty = cancelledQtyMap[item.ondcItemId] || 0;
    const returnQty = returnQtyMap[item.ondcItemId] || 0;
    const activeQty = item.quantity - cancelledQty - returnQty;

    quoteBreakup.push({
      "@ondc/org/item_id": item.ondcItemId,
      "@ondc/org/item_quantity": { count: Math.max(0, activeQty) },
      "@ondc/org/title_type": "item",
      title: item.name,
      price: { currency: "INR", value: String(item.price * Math.max(0, activeQty)) },
      item: {
        id: item.ondcItemId,
        quantity: {
          count: Math.max(0, activeQty),
          available: { count: String(Math.max(0, activeQty)) },
          maximum: { count: String(Math.max(0, activeQty)) },
        },
        price: { currency: "INR", value: String(item.price * Math.max(0, activeQty)) },
      },
    });

    if (cancelledQty > 0) {
      quoteBreakup.push({
        "@ondc/org/item_id": item.ondcItemId,
        "@ondc/org/item_quantity": { count: cancelledQty },
        "@ondc/org/title_type": "cancellation_charges",
        title: `Cancellation charges for ${item.name}`,
        price: { currency: "INR", value: "0" },
        item: {
          id: item.ondcItemId,
          quantity: { count: cancelledQty },
          price: { currency: "INR", value: "0" },
        },
      });
    }

    if (returnQty > 0) {
      quoteBreakup.push({
        "@ondc/org/item_id": item.ondcItemId,
        "@ondc/org/item_quantity": { count: returnQty },
        "@ondc/org/title_type": "refund",
        title: `Refund for ${item.name}`,
        price: { currency: "INR", value: String(-(item.price * returnQty)) },
        item: {
          id: item.ondcItemId,
          quantity: { count: returnQty },
          price: { currency: "INR", value: String(-(item.price * returnQty)) },
        },
      });
    }
  });

  // Add delivery and tax charges to quote breakup
  quoteBreakup.push(
    {
      "@ondc/org/item_id": primaryItemId,
      "@ondc/org/title_type": "delivery",
      title: "Delivery Charges",
      price: { currency: "INR", value: "0" },
      item: {
        id: primaryItemId,
        quantity: { count: 0 },
      },
    },
    {
      "@ondc/org/item_id": primaryItemId,
      "@ondc/org/title_type": "tax",
      title: "Tax",
      price: { currency: "INR", value: "0" },
      item: {
        id: primaryItemId,
        quantity: { count: 0 },
      },
    }
  );

  // Build fulfillments array — add F1 (active) and optionally C1 (cancelled items)
  const fulfillments: unknown[] = [
    {
      id: "F1",
      type: order.fulfillment?.type || "Delivery",
      tracking: Boolean(order.fulfillment?.tracking),
      "@ondc/org/provider_name": resolvedProviderId,
      "@ondc/org/TAT": "PT24H",
      state: {
        descriptor: {
          code: order.fulfillment?.state || "Pending",
          short_desc: order.fulfillment?.state || "Pending",
        },
      },
      start: {
        contact: sellerContact,
        person: { name: sellerContact.name },
        instructions: {
          code: "pickup",
          name: "Pickup",
          short_desc: "Seller will hand over the order to the delivery partner",
          long_desc: "Please pickup the order from the seller location and deliver to the customer",
        },
        time: {
          timestamp: orderCreatedAt,
          range: { start: orderCreatedAt, end: orderCreatedAt },
        },
        location: {
          id: locationId,
          descriptor: { name: "Store" },
          gps: order.gps || "12.971599,77.594566",
          address,
        },
      },
      end: {
        contact: { name: contact.name, phone: contact.phone, email: contact.email },
        person: { name: contact.name },
        time: {
          timestamp: orderCreatedAt,
          range: { start: orderCreatedAt, end: orderCreatedAt },
        },
        location: {
          id: `${locationId}-customer`,
          descriptor: { name: "Customer" },
          gps: order.gps || "12.971599,77.594566",
          address,
        },
      },
      tags: [
        { code: "routing", list: [{ code: "type", value: "P2P" }] },
      ],
    },
  ];

  // Add cancelled fulfillment C1 for partial/full cancel flows
  if (cancelledItemIds.length > 0 || order.status === "Cancelled" || order.status === "Partial-Cancelled") {
    fulfillments.push({
      id: "C1",
      type: "Cancel",
      tracking: false,
      state: {
        descriptor: {
          code: "Cancelled",
          short_desc: order.cancellationReasonDesc || "Cancelled by merchant",
        },
      },
      tags: [
        {
          code: "cancel_request",
          list: [
            { code: "reason_id", value: order.cancellationReasonId || "002" },
            { code: "initiated_by", value: resolvedProviderId },
          ],
        },
      ],
    });
  }

  // Add RTO (Return to Origin) fulfillment for Flow 3B
  if (order.rtoInfo && order.rtoInfo.status) {
    const rtoStateMap: Record<string, string> = {
      "initiated": "Initiated",
      "picked-up": "Picked-up",
      "delivered-to-origin": "Delivered-at-origin",
      "completed": "Returned",
    };
    fulfillments.push({
      id: "RTO1",
      type: "Return",
      tracking: Boolean(order.rtoInfo.trackingId),
      "@ondc/org/TAT": "PT72H",
      state: {
        descriptor: {
          code: rtoStateMap[order.rtoInfo.status] || "Initiated",
          short_desc: `Return to Origin: ${order.rtoInfo.reason || "Merchant initiated RTO"}`,
        },
      },
      start: {
        contact: { name: contact.name, phone: contact.phone, email: contact.email },
        person: { name: contact.name },
        time: {
          timestamp: order.rtoInfo.initiatedAt?.toISOString?.() || new Date().toISOString(),
        },
        location: {
          id: `${locationId}-customer`,
          descriptor: { name: "Customer Location (RTO Pickup)" },
          gps: order.gps || "12.971599,77.594566",
          address,
        },
      },
      end: {
        contact: sellerContact,
        person: { name: sellerContact.name },
        time: {
          timestamp: order.rtoInfo.deliveredToOriginAt?.toISOString?.() || new Date().toISOString(),
        },
        location: {
          id: locationId,
          descriptor: { name: "Store (RTO Delivery)" },
          gps: order.gps || "12.971599,77.594566",
          address,
        },
      },
      tags: [
        {
          code: "rto_request",
          list: [
            { code: "id", value: order.rtoInfo.trackingId || `RTO-${order.orderId}` },
            { code: "reason", value: order.rtoInfo.reason || "Merchant initiated" },
            { code: "initiated_by", value: resolvedProviderId },
          ],
        },
      ],
    });
  }

  // Add return fulfillment R1 for return flows
  if (returnItemIds.length > 0 || order.status === "Return-Initiated" || order.status === "Return-Requested" || order.status === "Return-Approved" || order.status === "Returned") {
    fulfillments.push({
      id: "R1",
      type: "Return",
      tracking: false,
      state: {
        descriptor: {
          code: order.status === "Returned" ? "Return-Delivered" : "Return-Initiated",
          short_desc: order.status,
        },
      },
      tags: [
        {
          code: "return_request",
          list: [
            { code: "id", value: `RET-${order.orderId}` },
            { code: "reason_id", value: order.returnInfo?.reason || "001" },
            { code: "initiated_by", value: order.becknContext?.bap_id as string || "buyer" },
          ],
        },
      ],
    });
  }

  const orderMessage: Record<string, unknown> = {
    order: {
      id: order.orderId,
      state: normalizeBecknOrderState(order.status, order.fulfillment?.state),
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
      items: activeItems,
      billing: {
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        address,
        tax_number: taxNumber,
        created_at: billingCreatedAt,
        updated_at: billingUpdatedAt,
      },
      cancellation_terms: cancellationTerms,
      tags: [
        {
          code: "bpp_terms",
          list: [
            { code: "np_type", value: "MSN" },
            { code: "tax_number", value: taxNumber },
          ],
        },
      ],
      created_at: orderCreatedAt,
      updated_at: orderUpdatedAt,
      fulfillments,
      payment: {
        type: paymentType,
        status: paymentStatus,
        collected_by: "BPP",
        params: {
          amount: String(totalAmount),
          currency: "INR",
          transaction_id: String(order.transactionId || order.orderId),
        },
        "@ondc/org/buyer_app_finder_fee_type": "percent",
        "@ondc/org/buyer_app_finder_fee_amount": "0",
        "@ondc/org/settlement_basis": "delivery",
        "@ondc/org/settlement_window": "P1D",
        "@ondc/org/withholding_amount": "0",
        "@ondc/org/settlement_details": [
          {
            settlement_counterparty: "seller-app",
            settlement_phase: "sale-amount",
            settlement_type: "upi",
            upi_address: "shopnix@upi",
            settlement_bank_account_no: "1234567890",
            settlement_ifsc_code: "IFSC0001234",
            beneficiary_name: "Shopnix Seller",
            bank_name: "Test Bank",
            branch_name: "Test Branch",
          },
        ],
      },
      quote: {
        price: { currency: "INR", value: String(totalAmount) },
        breakup: quoteBreakup,
        ttl: "P1D",
      },
    },
  };

  return orderMessage;
}