import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IOndcLog extends Document {
  action: string;
  transactionId: string;
  direction: "incoming" | "outgoing";
  payload: Record<string, unknown>;
  createdAt: Date;
}

const ondcLogSchema = new Schema<IOndcLog>(
  {
    action: { type: String, required: true, index: true },
    transactionId: { type: String, required: true, index: true },
    direction: { type: String, enum: ["incoming", "outgoing"], required: true },
    payload: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const OndcLog: Model<IOndcLog> =
  mongoose.models.OndcLog ||
  mongoose.model<IOndcLog>("OndcLog", ondcLogSchema);
