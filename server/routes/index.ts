import { Router } from "express";
import authRoutes from "./auth.routes";
import productRoutes from "./product.routes";
import orderRoutes from "./order.routes";
import sellerRoutes from "./seller.routes";
import ondcRoutes from "./ondc.routes";
import ondcBapRoutes from "./ondc-bap.routes";
import ondcGuideRoutes from "./ondc-guide.routes";
// import buyerRoutes from "./buyer.routes"; // DISABLED: Buyer functionality not needed
// import buyerOndcRoutes from "./buyer-ondc.routes"; // DISABLED: Buyer ONDC functionality not needed
import { PRODUCT_CATEGORIES } from "../constants/categories";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "shopnix-api" });
});

router.get("/categories", (_req, res) => {
  res.json({ success: true, data: PRODUCT_CATEGORIES });
});

router.use("/auth", authRoutes);
// router.use("/buyer", buyerRoutes); // DISABLED: Buyer functionality
// router.use("/buyer/ondc", buyerOndcRoutes); // DISABLED: Buyer ONDC functionality
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/seller", sellerRoutes);
router.use("/ondc", ondcRoutes);
router.use("/ondc", ondcGuideRoutes);
if (process.env.ONDC_ENABLE_BAP === "true") {
  router.use("/ondc-bap", ondcBapRoutes);
}

export default router;
