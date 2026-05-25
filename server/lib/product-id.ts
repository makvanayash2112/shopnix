import { v4 as uuidv4 } from "uuid";
import type { Types } from "mongoose";
import { Product } from "../models/Product";

export class ProductConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductConflictError";
  }
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 48);
}

/** ONDC item id is unique per seller (multiple sellers may use the same SKU label). */
export async function resolveOndcItemId(
  sellerId: Types.ObjectId,
  requested?: string,
  sku?: string
): Promise<string> {
  const sellerKey = sellerId.toString().slice(-6);

  if (requested?.trim()) {
    const id = requested.trim();
    const dup = await Product.findOne({ sellerId, ondcItemId: id });
    if (dup) {
      throw new ProductConflictError(
        `ONDC item ID "${id}" is already used by another product in your store. Edit that product or leave this field blank to auto-generate.`
      );
    }
    return id;
  }

  const base = sku ? sanitizeIdPart(sku) : "";
  let candidate = base
    ? `${base}-${sellerKey}`
    : `item-${uuidv4().slice(0, 8)}`;

  let suffix = 1;
  while (await Product.findOne({ sellerId, ondcItemId: candidate })) {
    candidate = base
      ? `${base}-${sellerKey}-${suffix++}`
      : `item-${uuidv4()}`;
  }

  return candidate;
}
