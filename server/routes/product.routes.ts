import { Router } from "express";
import { Product } from "../models/Product";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { productUpload } from "../middleware/upload";
import {
  saveProductImage,
  ImageStorageError,
} from "../lib/image-storage";
import { resolveOndcItemId } from "../lib/product-id";
import { sendError, sendSuccess } from "../utils/response";
import { handleProductRouteError } from "../utils/product-errors";
import {
  getCategoryBySlug,
  normalizeCategory,
  PRODUCT_CATEGORIES,
} from "../constants/categories";

function applyCategory(product: InstanceType<typeof Product>, raw?: string) {
  const slug = normalizeCategory(raw);
  const cat = getCategoryBySlug(slug);
  product.categorySlug = slug;
  product.category = cat?.name ?? raw ?? "Other";
}

async function collectProductImages(
  files: Express.Multer.File[]
): Promise<string[]> {
  const fromFiles: string[] = [];
  for (const file of files) {
    fromFiles.push(await saveProductImage(file));
  }
  if (files.length > 0 && fromFiles.length === 0) {
    throw new ImageStorageError(
      "Could not save uploaded files. Vercel needs BLOB_READ_WRITE_TOKEN, or deploy to your own server with writable public/uploads/products.",
      "BLOB_REQUIRED"
    );
  }
  return fromFiles.slice(0, 8);
}

const router = Router();

router.get("/categories/list", (_req, res) => {
  return sendSuccess(res, PRODUCT_CATEGORIES);
});

router.use(requireAuth);

router.get("/", async (req: AuthRequest, res) => {
  const sellerId = req.user!.sellerId;
  if (!sellerId) return sendError(res, "Seller profile not linked", 400);

  const products = await Product.find({ sellerId }).sort({ createdAt: -1 });
  return sendSuccess(res, products);
});

router.get("/:id", async (req: AuthRequest, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!product) return sendError(res, "Product not found", 404);
  return sendSuccess(res, product);
});

router.post(
  "/",
  productUpload.array("images", 8),
  async (req: AuthRequest, res) => {
    try {
      const sellerId = req.user!.sellerId;
      if (!sellerId) return sendError(res, "Seller profile not linked", 400);

      const body = req.body as Record<string, string>;
      const files = (req.files as Express.Multer.File[]) || [];

      const images = await collectProductImages(files);

      const sku = (body.sku || `SKU-${Date.now().toString(36)}`).trim();
      const slug = normalizeCategory(body.categorySlug || body.category);
      const ondcItemId = await resolveOndcItemId(
        sellerId,
        body.ondcItemId,
        sku
      );

      const isPublished = body.isPublished !== "false";
      if (isPublished && images.length === 0) {
        return sendError(
          res,
          "Add at least one product image before publishing on ONDC.",
          400
        );
      }

      const product = await Product.create({
        sellerId,
        name: body.name?.trim(),
        description: body.description,
        category: getCategoryBySlug(slug)?.name ?? "Other",
        categorySlug: slug,
        brand: body.brand,
        sku,
        price: Number(body.price),
        mrp: body.mrp ? Number(body.mrp) : undefined,
        quantity: Number(body.quantity ?? 0),
        unit: body.unit || "unit",
        images,
        isPublished,
        ondcItemId,
        tags: body.tags ? body.tags.split(",").map((t) => t.trim()) : [],
      });

      return sendSuccess(res, product, 201, "Product created");
    } catch (err) {
      return handleProductRouteError(res, err);
    }
  }
);

router.put(
  "/:id",
  productUpload.array("images", 8),
  async (req: AuthRequest, res) => {
    try {
      const product = await Product.findOne({
        _id: req.params.id,
        sellerId: req.user!.sellerId,
      });
      if (!product) return sendError(res, "Product not found", 404);

      const body = req.body as Record<string, string>;
      const files = (req.files as Express.Multer.File[]) || [];

      if (body.name) product.name = body.name.trim();
      if (body.description !== undefined) product.description = body.description;
      if (body.category || body.categorySlug) {
        applyCategory(product, body.categorySlug || body.category);
      }
      if (body.brand !== undefined) product.brand = body.brand;
      if (body.sku) product.sku = body.sku.trim();
      if (body.price) product.price = Number(body.price);
      if (body.mrp) product.mrp = Number(body.mrp);
      if (body.quantity !== undefined) product.quantity = Number(body.quantity);
      if (body.unit) product.unit = body.unit;

      if (body.ondcItemId?.trim() && body.ondcItemId !== product.ondcItemId) {
        const dup = await Product.findOne({
          sellerId: product.sellerId,
          ondcItemId: body.ondcItemId.trim(),
          _id: { $ne: product._id },
        });
        if (dup) {
          return sendError(
            res,
            `ONDC item ID "${body.ondcItemId}" is already used by another product in your store.`,
            409
          );
        }
        product.ondcItemId = body.ondcItemId.trim();
      }

      if (body.isPublished !== undefined) {
        product.isPublished = body.isPublished === "true";
      }

      if (files.length) {
        const added = await collectProductImages(files);
        if (body.replaceImages === "true") {
          product.images = added.slice(0, 8);
        } else {
          product.images = [...product.images, ...added].slice(0, 8);
        }
      }

      if (body.removeImages) {
        const remove = body.removeImages.split(",");
        product.images = product.images.filter((u) => !remove.includes(u));
      }

      if (product.isPublished && product.images.length === 0) {
        return sendError(
          res,
          "Published products need at least one image for ONDC.",
          400
        );
      }

      await product.save();
      return sendSuccess(res, product, 200, "Product updated");
    } catch (err) {
      return handleProductRouteError(res, err);
    }
  }
);

router.patch("/:id/publish", async (req: AuthRequest, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!product) return sendError(res, "Product not found", 404);
  if (product.quantity <= 0) {
    return sendError(res, "Set stock quantity above 0 before publishing.", 400);
  }
  if (!product.images?.length) {
    return sendError(
      res,
      "Add at least one image before publishing on ONDC.",
      400
    );
  }
  product.isPublished = true;
  await product.save();
  return sendSuccess(res, product, 200, "Product published on ONDC catalog");
});

router.patch("/:id/unpublish", async (req: AuthRequest, res) => {
  const product = await Product.findOne({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!product) return sendError(res, "Product not found", 404);
  product.isPublished = false;
  await product.save();
  return sendSuccess(res, product, 200, "Product removed from ONDC catalog");
});

router.delete("/:id", async (req: AuthRequest, res) => {
  const deleted = await Product.findOneAndDelete({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!deleted) return sendError(res, "Product not found", 404);
  return sendSuccess(res, null, 200, "Product deleted");
});

export default router;
