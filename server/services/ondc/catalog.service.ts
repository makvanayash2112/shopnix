import { Product } from "../../models/Product";
import { Seller } from "../../models/Seller";
import { env } from "../../config/env";
import {
  mapOndcCategory,
  normalizeOndcUnit,
  ondcAvailableCount,
  ondcFallbackImageUrl,
  resolvePublicImageUrl,
} from "../../constants/ondc-catalog";
import type { IProduct } from "../../models/Product";
import type { ISeller } from "../../models/Seller";

const MAX_PRODUCTS_PER_SELLER = 50;
const MAX_SELLERS_ON_NETWORK = 20;

export type CatalogNpType = "SNP" | "MSN";

function isPramaanOrGcrBap(bapId?: string): boolean {
  if (!bapId) return false;
  const id = bapId.toLowerCase();
  return id.includes("pramaan") || id.includes("mock/buyer");
}

/** Pramaan RET10 grocery flows: prefer grocery items; avoid empty catalog. */
export function filterProductsForOndcSearch(
  products: IProduct[],
  bapId?: string,
  domain?: string
): IProduct[] {
  if (domain !== "ONDC:RET10" && !isPramaanOrGcrBap(bapId)) {
    return products;
  }
  const grocery = products.filter((p) => p.categorySlug === "grocery");
  return grocery.length > 0 ? grocery : products.slice(0, 20);
}

function defaultItemCode(product: IProduct): string {
  const digits = product.sku.replace(/\D/g, "").slice(0, 13);
  const ean = digits.padStart(13, "0").slice(0, 13);
  return `1:${ean || "8901030895657"}`;
}

function defaultGps(seller: ISeller): string {
  const pin = seller.address?.pincode || "";
  if (pin.startsWith("56")) return "12.9716,77.5946";
  if (pin.startsWith("11")) return "28.6139,77.2090";
  if (pin.startsWith("40") || pin.startsWith("41")) return "19.0760,72.8777";
  return "12.9716,77.5946";
}

function itemDescriptor(
  product: IProduct,
  baseUrl: string,
  locationId: string
) {
  const { categoryId } = mapOndcCategory(product.categorySlug);
  const imageUrls = (product.images.length
    ? product.images
    : [ondcFallbackImageUrl(product.ondcItemId)]
  ).map((url) => resolvePublicImageUrl(url, baseUrl, product.ondcItemId));
  const images = imageUrls.map((url) => ({ url }));
  const unit = normalizeOndcUnit(product.unit);
  const shortDesc =
    product.description?.slice(0, 120) || product.name;
  const longDesc =
    product.description && product.description.length > shortDesc.length
      ? product.description
      : `${product.name}. ${product.brand ? `Brand: ${product.brand}.` : ""} Available on Shopnix ONDC.`;

  return {
    id: product.ondcItemId,
    descriptor: {
      name: product.name,
      short_desc: shortDesc,
      long_desc: longDesc,
      code: defaultItemCode(product),
      images,
      symbol: images[0]?.url,
    },
    price: {
      currency: "INR",
      value: String(product.price),
      maximum_value: String(product.mrp || product.price),
    },
    category_id: categoryId,
    fulfillment_ids: ["F1"],
    location_ids: [locationId],
    quantity: {
      available: { count: ondcAvailableCount(product.quantity) },
      maximum: { count: "10" },
      unitized: {
        measure: { unit, value: "1" },
      },
    },
    "@ondc/org/cancellable": true,
    "@ondc/org/returnable": true,
    "@ondc/org/return_window": "P7D",
    "@ondc/org/available_on_cod": true,
    "@ondc/org/time_to_ship": "PT24H",
    tags: [
      {
        code: "origin",
        list: [{ code: "country", value: "IND" }],
      },
      ...(product.brand
        ? [
            {
              code: "attribute",
              list: [{ code: "brand", value: product.brand }],
            },
          ]
        : []),
    ],
  };
}

function buildProviderBlock(
  seller: ISeller,
  products: IProduct[],
  baseUrl: string
) {
  const providerId =
    seller.ondcProviderId || `SHOPNIX_${seller._id.toString().slice(-8)}`;
  const locationId = `${providerId}-location`;
  const primaryCategory = mapOndcCategory(
    products[0]?.categorySlug || "grocery"
  );

  const providerShort =
    (seller.storeDescription || seller.storeName).slice(0, 120) || seller.storeName;
  let providerLong =
    seller.storeDescription?.trim() ||
    `${seller.storeName} — retail grocery & essentials on ONDC via Shopnix.`;
  if (providerLong === providerShort) {
    providerLong = `${providerLong} Serving ${seller.address?.city || "Bengaluru"} and nearby areas.`;
  }

  return {
    id: providerId,
    descriptor: {
      name: seller.storeName,
      short_desc: providerShort,
      long_desc: providerLong,
    },
    locations: [
      {
        id: locationId,
        descriptor: { name: seller.storeName },
        gps: defaultGps(seller),
        address: {
          locality: seller.address?.street || "Main Street",
          city: seller.address?.city || "Bengaluru",
          state: seller.address?.state || "KA",
          area_code: seller.address?.pincode || "560001",
        },
        time: {
          label: "enable",
          timestamp: new Date().toISOString(),
        },
      },
    ],
    items: products.map((p) => itemDescriptor(p, baseUrl, locationId)),
    fulfillments: [
      {
        id: "F1",
        type: seller.fulfillment?.type || "Delivery",
        contact: {
          phone: seller.phone || "9999999999",
          email: seller.email,
        },
      },
    ],
    tags: [
      {
        code: "serviceability",
        list: [
          { code: "location", value: locationId },
          {
            code: "category",
            value: primaryCategory.serviceabilityCategory,
          },
          { code: "type", value: "12" },
          { code: "val", value: String(seller.fulfillment?.radiusKm ?? 5) },
          { code: "unit", value: "km" },
        ],
      },
    ],
  };
}

function bppDescriptor(
  name: string,
  shortDesc: string,
  longDesc: string,
  baseUrl: string,
  npType: CatalogNpType
) {
  const symbol = ondcFallbackImageUrl(name.replace(/\s+/g, "-").toLowerCase());
  return {
    name,
    short_desc: shortDesc,
    long_desc: longDesc,
    symbol,
    images: [{ url: symbol }],
    tags: [
      {
        code: "bpp_terms",
        list: [{ code: "np_type", value: npType }],
      },
    ],
  };
}

/** Single seller catalog — default for Seller NP / Pramaan (SNP, one provider). */
export function buildCatalogMessage(
  seller: ISeller,
  products: IProduct[],
  baseUrl: string,
  npType: CatalogNpType = "SNP"
) {
  return buildMultiSellerCatalogMessage(
    [{ seller, products }],
    baseUrl,
    seller.storeName,
    npType
  );
}

/** MSN = multi-provider; SNP = single-provider (Pramaan Seller NP). */
export function buildMultiSellerCatalogMessage(
  entries: { seller: ISeller; products: IProduct[] }[],
  baseUrl: string,
  networkName?: string,
  npType: CatalogNpType = "MSN"
) {
  const providers = entries
    .filter((e) => e.products.length > 0)
    .map((e) => buildProviderBlock(e.seller, e.products, baseUrl));

  const name =
    networkName || env.defaultStoreName || "Shopnix Marketplace";
  const isSnP = npType === "SNP";

  return {
    catalog: {
      "bpp/descriptor": bppDescriptor(
        name,
        isSnP
          ? `${name} — retail on ONDC`
          : "Multi-seller grocery & retail on ONDC",
        isSnP
          ? sellerLongDesc(entries[0]?.seller, name)
          : "Products from verified Shopnix sellers",
        baseUrl,
        npType
      ),
      "bpp/providers": providers,
      payments: [
        { id: "1", type: "PRE-FULFILLMENT", collected_by: "BPP" },
        { id: "2", type: "ON-FULFILLMENT", collected_by: "BPP" },
        { id: "3", type: "POST-FULFILLMENT", collected_by: "BPP" },
      ],
    },
  };
}

function sellerLongDesc(seller: ISeller | undefined, fallback: string): string {
  const d = seller?.storeDescription?.trim();
  if (d && d !== seller?.storeName) return d;
  return `${fallback} on ONDC via Shopnix`;
}

export function useMsnCatalog(): boolean {
  return process.env.ONDC_MSN_CATALOG === "true";
}

export async function getPublishedCatalog(sellerId?: string) {
  if (sellerId != null) {
    const seller = await Seller.findById(sellerId);
    if (!seller) return { seller: null, products: [] as IProduct[] };
    const products = await Product.find({
      sellerId: seller._id,
      isPublished: true,
      quantity: { $gt: 0 },
    }).limit(MAX_PRODUCTS_PER_SELLER);
    return { seller, products };
  }

  const seller = await Seller.findOne().sort({ createdAt: 1 });
  if (!seller) return { seller: null, products: [] as IProduct[] };
  const products = await Product.find({
    sellerId: seller._id,
    isPublished: true,
    quantity: { $gt: 0 },
  }).limit(MAX_PRODUCTS_PER_SELLER);
  return { seller, products };
}

/** All sellers eligible for ONDC network catalog */
export async function getNetworkCatalogEntries() {
  const sellers = await Seller.find({
    "ondc.isActive": { $ne: false },
  })
    .sort({ updatedAt: -1 })
    .limit(MAX_SELLERS_ON_NETWORK);

  const entries: { seller: ISeller; products: IProduct[] }[] = [];

  for (const seller of sellers) {
    const products = await Product.find({
      sellerId: seller._id,
      isPublished: true,
      quantity: { $gt: 0 },
    }).limit(MAX_PRODUCTS_PER_SELLER);

    if (products.length > 0) {
      entries.push({ seller, products });
    }
  }

  return entries;
}

export async function getNetworkCatalogMessage(baseUrl: string) {
  const entries = await getNetworkCatalogEntries();
  return buildMultiSellerCatalogMessage(entries, baseUrl);
}

export async function resolveSellerFromOndcItemId(
  ondcItemId: string,
  providerId?: string
) {
  if (providerId) {
    const seller = await Seller.findOne({ ondcProviderId: providerId });
    if (seller) {
      const product = await Product.findOne({
        sellerId: seller._id,
        ondcItemId,
      });
      if (product) return { seller, product };
    }
  }

  const product = await Product.findOne({ ondcItemId });
  if (!product) return { seller: null, product: null };
  const seller = await Seller.findById(product.sellerId);
  return { seller: seller ?? null, product };
}

export { getDefaultSeller, getPrimarySeller } from "../seller.service";
