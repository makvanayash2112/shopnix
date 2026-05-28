// CREATE: models/OndcIssue.ts
import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IOndcIssue extends Document {
  issueId: string;
  transactionId: string;
  orderId?: string;
  bapId: string;
  bppId?: string;
  category: "REFUND" | "REPLACEMENT" | "CANCEL" | "NO_ACTION";
  subCategory?: string;
  issueType?: string;
  status: "OPEN" | "PROCESSING" | "RESOLVED" | "ESCALATED" | "CLOSED";
  description?: string;
  resolution?: string;
  resolutionAction?: string;
  escalationLevel?: number;
  createdAt: Date;
  updatedAt?: Date;
  closedAt?: Date;
  escalatedAt?: Date;
}

const ondcIssueSchema = new Schema<IOndcIssue>(
  {
    issueId: { type: String, required: true, unique: true },
    transactionId: { type: String, required: true, index: true },
    orderId: { type: String },
    bapId: { type: String, required: true },
    bppId: { type: String },
    category: {
      type: String,
      enum: ["REFUND", "REPLACEMENT", "CANCEL", "NO_ACTION"],
      required: true,
    },
    subCategory: { type: String },
    issueType: { type: String },
    status: {
      type: String,
      enum: ["OPEN", "PROCESSING", "RESOLVED", "ESCALATED", "CLOSED"],
      default: "OPEN",
    },
    description: { type: String },
    resolution: { type: String },
    resolutionAction: { type: String },
    escalationLevel: { type: Number, default: 0 },
    closedAt: { type: Date },
    escalatedAt: { type: Date },
  },
  { timestamps: true }
);

export const OndcIssue: Model<IOndcIssue> =
  mongoose.models.OndcIssue ||
  mongoose.model<IOndcIssue>("OndcIssue", ondcIssueSchema);
