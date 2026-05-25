/**
 * Prepare MongoDB seller + products for live Vercel / Pramaan RET10.
 * - HTTPS picsum images (local /uploads paths 404 on Vercel)
 * - Grocery-only published for ONDC
 * - Seller profile + provider id
 *
 * Run against production DB:
 *   MONGODB_URI="mongodb+srv://..." npx tsx server/scripts/prepare-live-ondc.ts
 */
import dotenv from "dotenv";
import path from "path";
import { connectDatabase } from "../config/database";
import { ensureProductIndexes } from "../lib/ensure-indexes";
import { ondcFallbackImageUrl } from "../constants/ondc-catalog";
import { User } from "../models/User";
import { Seller } from "../models/Seller";
import { Product } from "../models/Product";
import { assignOndcProviderId } from "../services/ondc/seller-readiness.service";
import { env } from "../config/env";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@shopnix.com").toLowerCase();

const GROCERY_IMAGE_SEEDS: Record<string, string> = {
  "premium-basmati-rice-5kg": "basmati-rice",
  "extra-virgin-olive-oil-1l": "olive-oil",
  "mixed-dry-fruits-500g": "dry-fruits",
  "mirinda": "soft-drink",
  "MIRINDA-225L": "soft-drink",
};

function picsumForProduct(product: {
  ondcItemId: string;
  name: string;
  sku: string;
}): string {
  const key =
    Object.entries(GROCERY_IMAGE_SEEDS).find(
      ([k]) =>
        product.ondcItemId.toLowerCase().includes(k.toLowerCase()) ||
        product.name.toLowerCase().includes(k.replace(/-/g, " "))
    )?.[1] ?? product.ondcItemId;
  return ondcFallbackImageUrl(key);
}

async function main() {
  await connectDatabase();
  await ensureProductIndexes();

  const user = await User.findOne({ email: ADMIN_EMAIL });
  if (!user?.sellerId) {
    throw new Error(`Run npm run seed:admin first — no seller for ${ADMIN_EMAIL}`);
  }

  const seller = await Seller.findById(user.sellerId);
  if (!seller) throw new Error("Seller profile missing");

  seller.storeName = seller.storeName || "Shopnix Store";
  seller.storeDescription =
    seller.storeDescription ||
    "Shopnix retail store offering grocery and daily essentials in Bengaluru.";
  seller.phone = seller.phone || "9999999999";
  seller.email = seller.email || ADMIN_EMAIL;
  seller.address = {
    street: seller.address?.street || "Main Street",
    city: seller.address?.city || "Bengaluru",
    state: seller.address?.state || "KA",
    pincode: seller.address?.pincode || "560001",
  };
  seller.fulfillment = {
    type: seller.fulfillment?.type || "Delivery",
    radiusKm: seller.fulfillment?.radiusKm ?? 5,
  };
  seller.ondc = {
    bppId: env.ondc.bppId,
    bppUri: env.ondc.bppUri,
    domain: env.ondc.domain,
    city: env.ondc.city,
    isActive: true,
    subscriberId: env.ondc.subscriberId || env.ondc.bppId,
  };
  if (!seller.ondcProviderId) {
    seller.ondcProviderId = assignOndcProviderId(seller);
  }
  await seller.save();
  console.log(`[prepare] Seller: ${seller.storeName} provider=${seller.ondcProviderId}`);

  const products = await Product.find({ sellerId: seller._id });
  let groceryPublished = 0;

  for (const p of products) {
    const isGrocery = p.categorySlug === "grocery";
    const image = picsumForProduct(p);
    p.images = [image];
    if (isGrocery && p.quantity > 0) {
      p.isPublished = true;
      groceryPublished++;
    } else {
      p.isPublished = false;
    }
    await p.save();
    console.log(
      `[prepare] ${p.isPublished ? "LIVE" : "draft"} ${p.name} (${p.categorySlug}) → ${image}`
    );
  }

  console.log(`\n[prepare] Done. Grocery published on ONDC: ${groceryPublished}`);
  console.log(`[prepare] BPP: ${env.ondc.bppUri}`);
  console.log(`[prepare] Test: ${env.apiBaseUrl}/ondc/test-catalog?mode=pramaan`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[prepare] Failed:", e);
  process.exit(1);
});
