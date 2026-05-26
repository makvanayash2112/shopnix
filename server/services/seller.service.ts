import { env } from "../config/env";
import { Seller } from "../models/Seller";
import { Product } from "../models/Product";
import { User } from "../models/User";

const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || "admin@shopnix.com"
).toLowerCase();

export async function getPrimarySeller() {
  const adminUser = await User.findOne({ email: ADMIN_EMAIL });
  if (adminUser?.sellerId) {
    const seller = await Seller.findById(adminUser.sellerId);
    if (seller) return seller;
  }

  const sellerByEmail = await Seller.findOne({ email: ADMIN_EMAIL });
  if (sellerByEmail) return sellerByEmail;

  const sellerWithProducts = await Product.aggregate([
    { $match: { isPublished: true } },
    { $group: { _id: "$sellerId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]);
  if (sellerWithProducts[0]?._id) {
    const seller = await Seller.findById(sellerWithProducts[0]._id);
    if (seller) return seller;
  }

  let seller = await Seller.findOne().sort({ createdAt: 1 });
  if (!seller) {
    seller = await Seller.create({
      storeName: env.defaultStoreName,
      email: env.defaultStoreEmail,
      ondc: {
        bppId: env.ondc.bppId,
        bppUri: env.ondc.bppUri,
        domain: env.ondc.domain,
        city: env.ondc.city,
        isActive: true,
        subscriberId: env.ondc.subscriberId,
      },
    });
  }
  return seller;
}

export async function getDefaultSeller() {
  return getPrimarySeller();
}
