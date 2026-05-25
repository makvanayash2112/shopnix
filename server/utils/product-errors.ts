import type { Response } from "express";
import { sendError } from "./response";
import { ProductConflictError } from "../lib/product-id";
import { ImageStorageError } from "../lib/image-storage";

export function handleProductRouteError(res: Response, err: unknown) {
  if (err instanceof ProductConflictError) {
    return sendError(res, err.message, 409);
  }
  if (err instanceof ImageStorageError) {
    const status = err.code === "BLOB_REQUIRED" ? 503 : 400;
    return sendError(res, err.message, status, { code: err.code });
  }

  const mongo = err as {
    code?: number;
    keyPattern?: Record<string, number>;
    keyValue?: Record<string, unknown>;
  };

  if (mongo.code === 11000) {
    if (mongo.keyPattern?.sku) {
      return sendError(
        res,
        `SKU "${mongo.keyValue?.sku ?? ""}" is already used in your store. Use a different SKU or edit the existing product.`,
        409
      );
    }
    if (mongo.keyPattern?.ondcItemId) {
      return sendError(
        res,
        `ONDC item ID "${mongo.keyValue?.ondcItemId ?? ""}" is already used in your store.`,
        409
      );
    }
    return sendError(res, "A product with the same identifier already exists in your store.", 409);
  }

  console.error(err);
  return sendError(
    res,
    err instanceof Error ? err.message : "Failed to save product",
    500
  );
}
