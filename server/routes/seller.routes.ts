import { Router } from "express";
import { Seller } from "../models/Seller";
import {
  requireAuth,
  requireSuperAdmin,
  type AuthRequest,
} from "../middleware/auth";
import { sendError, sendSuccess } from "../utils/response";
import {
  getSellerOndcReadiness,
  assignOndcProviderId,
} from "../services/ondc/seller-readiness.service";
import { getImageStorageStatus } from "../lib/image-storage";

const router = Router();

router.use(requireAuth);

router.get("/all", requireSuperAdmin, async (_req: AuthRequest, res) => {
  const sellers = await Seller.find().sort({ createdAt: -1 });
  return sendSuccess(res, sellers);
});

router.patch(
  "/:id/ondc-active",
  requireSuperAdmin,
  async (req: AuthRequest, res) => {
    const seller = await Seller.findById(req.params.id);
    if (!seller) return sendError(res, "Seller not found", 404);
    seller.ondc.isActive = Boolean(req.body.isActive);
    await seller.save();
    return sendSuccess(res, seller, 200, "Seller ONDC status updated");
  }
);

router.get("/profile", async (req: AuthRequest, res) => {
  const seller = await Seller.findById(req.user!.sellerId);
  if (!seller) return sendError(res, "Seller profile not found", 404);
  if (!seller.ondcProviderId) {
    seller.ondcProviderId = assignOndcProviderId(seller);
    await seller.save();
  }
  return sendSuccess(res, seller);
});

router.get("/storage-status", (_req, res) => {
  return sendSuccess(res, getImageStorageStatus());
});

router.get("/ondc-readiness", async (req: AuthRequest, res) => {
  const sellerId = req.user!.sellerId?.toString();
  if (!sellerId) return sendError(res, "Seller profile not linked", 400);
  const readiness = await getSellerOndcReadiness(sellerId);
  return sendSuccess(res, readiness);
});

router.put("/profile", async (req: AuthRequest, res) => {
  const seller = await Seller.findById(req.user!.sellerId);
  if (!seller) return sendError(res, "Seller profile not found", 404);

  const body = req.body as Partial<{
    storeName: string;
    storeDescription: string;
    gstin: string;
    pan: string;
    phone: string;
    email: string;
    address: Record<string, string>;
    fulfillment: { type: string; radiusKm: number };
    ondc: Partial<{
      bppId: string;
      bppUri: string;
      domain: string;
      city: string;
      isActive: boolean;
      subscriberId: string;
    }>;
    ondcProviderId: string;
  }>;

  if (body.storeName) seller.storeName = body.storeName;
  if (body.storeDescription !== undefined) seller.storeDescription = body.storeDescription;
  if (body.gstin !== undefined) seller.gstin = body.gstin;
  if (body.pan !== undefined) seller.pan = body.pan;
  if (body.phone) seller.phone = body.phone;
  if (body.email) seller.email = body.email;
  if (body.address) seller.address = { ...seller.address, ...body.address };
  if (body.fulfillment) {
    const f = body.fulfillment;
    if (f.type) {
      seller.fulfillment.type = f.type as
        | "Delivery"
        | "Pickup"
        | "Delivery and Pickup";
    }
    if (f.radiusKm != null) seller.fulfillment.radiusKm = f.radiusKm;
  }
  if (body.ondc) {
    seller.ondc = { ...seller.ondc, ...body.ondc };
  }
  if (body.ondcProviderId) {
    seller.ondcProviderId = body.ondcProviderId;
  }
  if (!seller.ondcProviderId) {
    seller.ondcProviderId = assignOndcProviderId(seller);
  }

  await seller.save();
  return sendSuccess(res, seller, 200, "Profile updated");
});

router.get("/stats", async (req: AuthRequest, res) => {
  const sellerId = req.user!.sellerId;
  if (!sellerId) return sendError(res, "Seller profile not linked", 400);

  const { Product } = await import("../models/Product");
  const { Order } = await import("../models/Order");

  const [productCount, publishedCount, orderCount, pendingOrders, revenue] =
    await Promise.all([
      Product.countDocuments({ sellerId }),
      Product.countDocuments({ sellerId, isPublished: true }),
      Order.countDocuments({ sellerId }),
      Order.countDocuments({ sellerId, status: { $in: ["Created", "Accepted"] } }),
      Order.aggregate([
        { $match: { sellerId, status: "Completed" } },
        { $group: { _id: null, total: { $sum: "$payment.amount" } } },
      ]),
    ]);

  return sendSuccess(res, {
    productCount,
    publishedCount,
    orderCount,
    pendingOrders,
    revenue: revenue[0]?.total ?? 0,
  });
});

export default router;
