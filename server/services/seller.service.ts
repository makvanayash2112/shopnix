import { env } from "../config/env";
import { Seller } from "../models/Seller";
import { Product } from "../models/Product";
import { User } from "../models/User";

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@shopnix.com").toLowerCase();

/**
 * Primary store seller — admin's seller profile (not random findOne()).
 */
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

/** @deprecated Use getPrimarySeller */
export async function getDefaultSeller() {
  return getPrimarySeller();
}

export interface ResolvedOrderLine {
  product: InstanceType<typeof Product>;
  quantity: number;
}

/**
 * Resolve seller from cart lines — order belongs to product owner(s).
 */
export async function resolveSellerFromOrderLines(
  items: { productId: string; quantity: number }[]
): Promise<
  | { ok: true; seller: InstanceType<typeof Seller>; lines: ResolvedOrderLine[] }
  | { ok: false; message: string }
> {
  if (!items.length) {
    return { ok: false, message: "No items in order" };
  }

  const lines: ResolvedOrderLine[] = [];
  const sellerIds = new Set<string>();

  for (const line of items) {
    const product = await Product.findOne({
      _id: line.productId,
      isPublished: true,
    });

    if (!product) {
      return { ok: false, message: `Product not found: ${line.productId}` };
    }

    if (product.quantity < line.quantity) {
      return {
        ok: false,
        message: `Insufficient stock for ${product.name}`,
      };
    }

    sellerIds.add(product.sellerId.toString());
    lines.push({ product, quantity: line.quantity });
  }

  if (sellerIds.size > 1) {
    return {
      ok: false,
      message:
        "Cart has products from multiple stores. Please checkout one store at a time.",
    };
  }

  const sellerId = [...sellerIds][0];
  const seller = await Seller.findById(sellerId);
  if (!seller) {
    return { ok: false, message: "Seller store not found for these products" };
  }

  return { ok: true, seller, lines };
}
