import { Seller } from "../models/Seller";
import { Product } from "../models/Product";

export async function getPrimarySeller() {
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

  return Seller.findOne().sort({ createdAt: 1 });
}

export async function getDefaultSeller() {
  return getPrimarySeller();
}
