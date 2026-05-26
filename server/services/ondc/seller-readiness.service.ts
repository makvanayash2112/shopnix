import { Product } from "../../models/Product";
import { Seller } from "../../models/Seller";
import {
  GSTIN_PATTERN,
  INDIAN_PHONE_PATTERN,
  INDIAN_PINCODE_PATTERN,
  PAN_PATTERN,
  normalizePhone,
  normalizeTaxId,
} from "../../lib/seller-validation";

type ProviderIdSource = {
  _id: { toString(): string };
  storeName: string;
};

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

  const gstin = normalizeTaxId(seller.gstin);
  const pan = normalizeTaxId(seller.pan);
  const phone = seller.phone ? normalizePhone(seller.phone) : "";
  const pincode = seller.address?.pincode?.trim() ?? "";
  const hasValidTaxId = Boolean(
    (gstin && GSTIN_PATTERN.test(gstin)) || (pan && PAN_PATTERN.test(pan))
  );

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
      ok: INDIAN_PHONE_PATTERN.test(phone),
      hint: "Required for fulfillment contact on ONDC",
    },
    {
      id: "address",
      label: "Address (street, city, state, pincode)",
      ok: Boolean(
        seller.address?.street &&
          seller.address?.city &&
          seller.address?.state &&
          INDIAN_PINCODE_PATTERN.test(pincode)
      ),
      hint: "Used for provider location on ONDC catalog",
    },
    {
      id: "tax_id",
      label: "GSTIN or PAN",
      ok: hasValidTaxId,
      hint: "GSTIN must be 15 characters; PAN must be 10 characters",
    },
    {
      id: "ondc_active",
      label: "Listed on ONDC network",
      ok: seller.ondc?.isActive !== false,
      hint: "Enabled when the seller is allowed to appear in ONDC search",
    },
    {
      id: "published_products",
      label: "At least 1 published product in stock",
      ok: publishedCount > 0,
      hint: "Publish products with quantity above 0 in Seller Products",
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
      hint: "Auto-set on registration; shown in ONDC settings",
    },
  ];

  const ready = checks.every((c) => c.ok);

  return {
    ready,
    providerId:
      seller.ondcProviderId || `SHOPNIX_${seller._id.toString().slice(-8)}`,
    publishedCount,
    checks,
    networkNote:
      "Seller products appear on ONDC when the seller is active and products are published with stock.",
  };
}

export function assignOndcProviderId(seller: ProviderIdSource): string {
  const base = seller.storeName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_")
    .slice(0, 24);
  return `${base}_${seller._id.toString().slice(-6)}`;
}
