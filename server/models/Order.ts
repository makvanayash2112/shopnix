import mongoose, { Schema, type Document, type Model } from "mongoose";
import type { OrderStatus } from "../constants/order-workflow";

export type { OrderStatus };

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  ondcItemId: string;
  name: string;
  quantity: number;
  price: number;
}

export type OrderChannel = "ondc";
export type PaymentMethod = "cash";

export interface IReturnInfo {
  reason?: string;
  requestedAt?: Date;
  approvedAt?: Date;
  completedAt?: Date;
  status?: "pending" | "approved" | "completed" | "rejected";
  sellerNote?: string;
}

export interface IOrder extends Document {
  sellerId: mongoose.Types.ObjectId;
  orderId: string;
  transactionId: string;
  channel: OrderChannel;
  bapOrderId?: string;
  status: OrderStatus | string;
  items: IOrderItem[];
  customer: {
    name?: string;
    email?: string;
    phone?: string;
    // address?: Record<string, string>;
    address?: {
      name?: string;
      building?: string;
      locality?: string;
      city?: string;
      state?: string;
      country?: string;
      area_code?: string;
      gps?: string;
    };
  };
  payment: {
    method: PaymentMethod;
    type?: string;
    status?: string;
    amount: number;
    collected_by?: string;
  };
  fulfillment: {
    type?: string;
    state?: string;
    tracking?: boolean;
    tracking_url?: string;
  };
  deliveredAt?: Date;
  returnInfo?: IReturnInfo;
  becknContext?: Record<string, unknown>;
  locationId?: string;
  gps?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "Seller", required: true },
    orderId: { type: String, required: true, unique: true },
    transactionId: { type: String, required: true, index: true },
    channel: {
      type: String,
      enum: ["ondc"],
      default: "ondc",
    },
    bapOrderId: String,
    status: {
      type: String,
      enum: [
        "Created",
        "Accepted",
        "Packed",
        "Delivering",
        "Delivered",
        "Cancelled",
        "Return-Requested",
        "Return-Approved",
        "Returned",
        "In-progress",
        "Completed",
      ],
      default: "Created",
    },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product" },
        ondcItemId: String,
        name: String,
        quantity: Number,
        price: Number,
      },
    ],
    customer: {
      name: String,
      email: String,
      phone: String,
      address: Schema.Types.Mixed,
    },
    payment: {
      method: { type: String, enum: ["cash"], default: "cash" },
      type: { type: String, default: "ON-FULFILLMENT" },
      status: { type: String, default: "NOT-PAID" },
      amount: { type: Number, default: 0 },
    },
    fulfillment: {
      type: {
        type: String,
        default: "Delivery",
      },
      state: {
        type: String,
        default: "Pending",
      },
      tracking: {
        type: Boolean,
        default: false,
      },
      tracking_url: String,
    },
    deliveredAt: Date,
    returnInfo: {
      reason: String,
      requestedAt: Date,
      approvedAt: Date,
      completedAt: Date,
      status: {
        type: String,
        enum: ["pending", "approved", "completed", "rejected"],
      },
      sellerNote: String,
    },
    locationId: String,
    gps: String,
    becknContext: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);
