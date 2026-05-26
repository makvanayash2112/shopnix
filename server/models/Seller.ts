import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ISeller extends Document {
  storeName: string;
  storeDescription?: string;
  gstin?: string;
  ondcProviderId?: string;
  pan?: string;
  email: string;
  phone?: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  ondc: {
    bppId: string;
    bppUri: string;
    domain: string;
    city: string;
    isActive: boolean;
    subscriberId?: string;
  };
  fulfillment: {
    type: "Delivery" | "Pickup" | "Delivery and Pickup";
    radiusKm?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const sellerSchema = new Schema<ISeller>(
  {
    storeName: { type: String, required: true, trim: true },
    storeDescription: { type: String },
    gstin: { type: String },
    pan: { type: String },
    email: { type: String, required: true },
    phone: { type: String },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      country: { type: String, default: "India" },
    },
    ondc: {
      bppId: { type: String, required: true },
      bppUri: { type: String, required: true },
      domain: { type: String, default: "ONDC:RET10" },
      city: { type: String, default: "std:080" },
      isActive: { type: Boolean, default: true },
      subscriberId: String,

    },
    ondcProviderId: {
      type: String,
      unique: true,
      sparse: true,
    },
    fulfillment: {
      type: {
        type: String,
        enum: ["Delivery", "Pickup", "Delivery and Pickup"],
        default: "Delivery",
      },
      radiusKm: { type: Number, default: 5 },
    },
  },
  { timestamps: true }
);

export const Seller: Model<ISeller> =
  mongoose.models.Seller || mongoose.model<ISeller>("Seller", sellerSchema);
