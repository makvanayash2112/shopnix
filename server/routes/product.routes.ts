import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { Product } from "../models/Product";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { productUpload } from "../middleware/upload";
import { saveProductImage } from "../lib/image-storage";
import { sendError, sendSuccess } from "../utils/response";
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

      const imageUrls = await Promise.all(
        files.map((f) => saveProductImage(f))
      );

      const sku = body.sku || `SKU-${uuidv4().slice(0, 8)}`;
      const ondcItemId = body.ondcItemId || `item-${uuidv4()}`;
      const slug = normalizeCategory(body.categorySlug || body.category);

      const product = await Product.create({
        sellerId,
        name: body.name,
        description: body.description,
        category: getCategoryBySlug(slug)?.name ?? "Other",
        categorySlug: slug,
        brand: body.brand,
        sku,
        price: Number(body.price),
        mrp: body.mrp ? Number(body.mrp) : undefined,
        quantity: Number(body.quantity ?? 0),
        unit: body.unit || "unit",
        images: imageUrls,
        isPublished: body.isPublished !== "false",
        ondcItemId,
        tags: body.tags ? body.tags.split(",").map((t) => t.trim()) : [],
      });

      return sendSuccess(res, product, 201, "Product created");
    } catch (err) {
      console.error(err);
      return sendError(res, "Failed to create product", 500);
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

      if (body.name) product.name = body.name;
      if (body.description !== undefined) product.description = body.description;
      if (body.category || body.categorySlug) {
        applyCategory(product, body.categorySlug || body.category);
      }
      if (body.brand !== undefined) product.brand = body.brand;
      if (body.price) product.price = Number(body.price);
      if (body.mrp) product.mrp = Number(body.mrp);
      if (body.quantity !== undefined) product.quantity = Number(body.quantity);
      if (body.unit) product.unit = body.unit;
      if (body.isPublished !== undefined) {
        product.isPublished = body.isPublished === "true";
      }

      if (files.length) {
        const newUrls = await Promise.all(
          files.map((f) => saveProductImage(f))
        );
        product.images = [...product.images, ...newUrls].slice(0, 8);
      }

      if (body.removeImages) {
        const remove = body.removeImages.split(",");
        product.images = product.images.filter((u) => !remove.includes(u));
      }

      await product.save();
      return sendSuccess(res, product, 200, "Product updated");
    } catch (err) {
      console.error(err);
      return sendError(res, "Failed to update product", 500);
    }
  }
);

router.delete("/:id", async (req: AuthRequest, res) => {
  const deleted = await Product.findOneAndDelete({
    _id: req.params.id,
    sellerId: req.user!.sellerId,
  });
  if (!deleted) return sendError(res, "Product not found", 404);
  return sendSuccess(res, null, 200, "Product deleted");
});

export default router;
