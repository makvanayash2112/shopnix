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
  cancelledItems?: ICancelledItem[];       // For Flow 3A partial cancel
  returnItems?: IReturnItem[];             // For Flow 4A/4B return items
  cancellationReasonId?: string;           // ONDC reason code e.g. "002"
  cancellationReasonDesc?: string;         // Human readable
  nonCancellable?: boolean;                // For Flow 7
  igmIssues?: IIgmIssue[];                 // For Flow 6A-F
  settlementInfo?: Record<string, unknown>; // For Flow 11A/11B
  incrementalPushSeq?: number;             // For Flow 8C incremental push

  becknContext?: Record<string, unknown>;
  locationId?: string;
  gps?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ADD these new interface types BEFORE IOrder interface (around line 22):

export interface ICancelledItem {
  ondcItemId: string;
  name: string;
  quantity: number;
  price: number;
  reason?: string;
  cancelledAt?: Date;
}

export interface IReturnItem {
  ondcItemId: string;
  name: string;
  quantity: number;
  price: number;
  reason?: string;
  returnType?: "full" | "partial";
  requestedAt?: Date;
  approvedAt?: Date;
  completedAt?: Date;
  status?: "pending" | "approved" | "completed" | "rejected";
}

export interface IIgmIssue {
  issueId: string;
  bapIssueId?: string;
  category: "REFUND" | "REPLACEMENT" | "CANCEL" | "NO_ACTION";
  subCategory?: string;
  status: "OPEN" | "PROCESSING" | "RESOLVED" | "ESCALATED" | "CLOSED";
  description?: string;
  resolution?: string;
  resolutionAction?: string;
  createdAt: Date;
  updatedAt?: Date;
  closedAt?: Date;
  escalatedAt?: Date;
  remarksByBnp?: string;
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
        "Agent-assigned",
        "Order-picked-up",
        "Delivering",
        "Delivered",
        "Cancelled",
        "Partial-Cancelled",
        "Return-Initiated",
        "Return-Requested",
        "Return-Approved",
        "Returned",
        "Return-Rejected",
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
    cancelledItems: [
      {
        ondcItemId: { type: String },
        name: { type: String },
        quantity: { type: Number },
        price: { type: Number },
        reason: { type: String },
        cancelledAt: { type: Date },
      },
    ],
    returnItems: [
      {
        ondcItemId: { type: String },
        name: { type: String },
        quantity: { type: Number },
        price: { type: Number },
        reason: { type: String },
        returnType: { type: String, enum: ["full", "partial"] },
        requestedAt: { type: Date },
        approvedAt: { type: Date },
        completedAt: { type: Date },
        status: {
          type: String,
          enum: ["pending", "approved", "completed", "rejected"],
        },
      },
    ],
    cancellationReasonId: { type: String },
    cancellationReasonDesc: { type: String },
    nonCancellable: { type: Boolean, default: false },
    igmIssues: [
      {
        issueId: { type: String, required: true },
        bapIssueId: { type: String },
        category: {
          type: String,
          enum: ["REFUND", "REPLACEMENT", "CANCEL", "NO_ACTION"],
        },
        subCategory: { type: String },
        status: {
          type: String,
          enum: ["OPEN", "PROCESSING", "RESOLVED", "ESCALATED", "CLOSED"],
          default: "OPEN",
        },
        description: { type: String },
        resolution: { type: String },
        resolutionAction: { type: String },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date },
        closedAt: { type: Date },
        escalatedAt: { type: Date },
        remarksByBnp: { type: String },
      },
    ],
    settlementInfo: { type: Schema.Types.Mixed },
    incrementalPushSeq: { type: Number, default: 0 },
    locationId: String,
    gps: String,
    becknContext: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);
