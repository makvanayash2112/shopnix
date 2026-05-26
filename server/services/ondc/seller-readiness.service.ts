import { Product } from "../../models/Product";
import { Seller } from "../../models/Seller";
import type { ISeller } from "../../models/Seller";

export type OndcReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  hint?: string;
};

export async function getSellerOndcReadiness(sellerId: string) {
  const seller = await Seller.findById(sellerId);
  if (!seller) {
    return { ready: false, checks: [] as OndcReadinessCheck[] };
  }

  const publishedCount = await Product.countDocuments({
    sellerId,
    isPublished: true,
    quantity: { $gt: 0 },
  });

  const publishedProducts = await Product.find({
    sellerId,
    isPublished: true,
    quantity: { $gt: 0 },
  }).select("images");

  const withRealImages = publishedProducts.filter((p) =>
    (p.images ?? []).some(
      (image) =>
        Boolean(image?.trim()) &&
        !image.includes("placehold.co") &&
        !image.includes("localhost")
    )
  ).length;

  const checks: OndcReadinessCheck[] = [
    {
      id: "store_name",
      label: "Store name",
      ok: Boolean(seller.storeName?.trim()),
    },
    {
      id: "phone",
      label: "Phone number",
      ok: Boolean(seller.phone?.trim()),
      hint: "Required for fulfillment contact on ONDC",
    },
    {
      id: "address",
      label: "Address (street, city, state, pincode)",
      ok: Boolean(
        seller.address?.city &&
          seller.address?.state &&
          seller.address?.pincode
      ),
      hint: "Used for provider location on ONDC catalog",
    },
    {
      id: "gstin",
      label: "GSTIN (recommended)",
      ok: Boolean(seller.gstin?.trim()),
      hint: "Often required for retail seller NP on portal",
    },
    {
      id: "ondc_active",
      label: "Listed on ONDC network",
      ok: seller.ondc?.isActive !== false,
      hint: "Toggle in seller profile if you add UI; default true on register",
    },
    {
      id: "published_products",
      label: "At least 1 published product in stock",
      ok: publishedCount > 0,
      hint: "Publish products with quantity > 0 in Admin → Products",
    },
    {
      id: "product_images",
      label: "Published products have images",
      ok: publishedCount === 0 || withRealImages > 0,
      hint:
        "On your own HTTPS domain, uploaded filenames resolve to /uploads/products/{filename}. Vercel needs Blob for persistent upload storage.",
    },
    {
      id: "provider_id",
      label: "ONDC provider ID assigned",
      ok: Boolean(seller.ondcProviderId),
      hint: "Auto-set on registration; shown in ONDC admin",
    },
  ];

  const ready = checks.every((c) =>
    c.id === "gstin" ? true : c.ok
  );

  return {
    ready,
    providerId:
      seller.ondcProviderId || `SHOPNIX_${seller._id.toString().slice(-8)}`,
    publishedCount,
    checks,
    networkNote:
      "Your products appear on ONDC when published. Shopnix BPP (shopnix-nine.vercel.app) aggregates all active sellers for search/on_search.",
  };
}

export function assignOndcProviderId(seller: ISeller): string {
  const base = seller.storeName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .slice(0, 24);
  return `${base}_${seller._id.toString().slice(-6)}`;
}
