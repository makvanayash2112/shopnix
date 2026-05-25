import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IProduct extends Document {
  sellerId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  category: string;
  categorySlug: string;
  brand?: string;
  sku: string;
  price: number;
  mrp?: number;
  quantity: number;
  unit: string;
  images: string[];
  isPublished: boolean;
  ondcItemId: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: "Seller", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    category: { type: String, required: true, default: "Grocery" },
    categorySlug: { type: String, required: true, default: "grocery", index: true },
    brand: { type: String },
    sku: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, default: "unit" },
    images: [{ type: String }],
    isPublished: { type: Boolean, default: true },
    ondcItemId: { type: String, required: true },
    tags: [String],
  },
  { timestamps: true }
);

productSchema.index({ sellerId: 1, sku: 1 }, { unique: true });
productSchema.index({ sellerId: 1, ondcItemId: 1 }, { unique: true });

export const Product: Model<IProduct> =
  mongoose.models.Product ||
  mongoose.model<IProduct>("Product", productSchema);
