import { Router } from "express";
import authRoutes from "./auth.routes";
import productRoutes from "./product.routes";
import orderRoutes from "./order.routes";
import sellerRoutes from "./seller.routes";
import ondcRoutes from "./ondc.routes";
import ondcGuideRoutes from "./ondc-guide.routes";
import { PRODUCT_CATEGORIES } from "../constants/categories";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "shopnix-api" });
});

router.get("/categories", (_req, res) => {
  res.json({ success: true, data: PRODUCT_CATEGORIES });
});

router.use("/auth", authRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/seller", sellerRoutes);
router.use("/ondc", ondcRoutes);
router.use("/ondc", ondcGuideRoutes);
export default router;
