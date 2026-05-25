import { Product } from "../../models/Product";
import { Seller } from "../../models/Seller";
import { env } from "../../config/env";
import type { IProduct } from "../../models/Product";
import type { ISeller } from "../../models/Seller";

const MAX_PRODUCTS_PER_SELLER = 50;
const MAX_SELLERS_ON_NETWORK = 20;

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
  providerId: string,
  locationId: string
) {
  const images = product.images.map((url) => ({
    url: url.startsWith("http") ? url : `${baseUrl}${url}`,
  }));

  return {
    id: product.ondcItemId,
    descriptor: {
      name: product.name,
      short_desc: product.description?.slice(0, 120) || product.name,
      long_desc: product.description || product.name,
      images,
      symbol: images[0]?.url,
    },
    price: {
      currency: "INR",
      value: String(product.price),
      maximum_value: String(product.mrp || product.price),
    },
    category_id: product.categorySlug || "grocery",
    fulfillment_ids: ["F1"],
    location_ids: [locationId],
    quantity: {
      available: { count: String(product.quantity) },
      maximum: { count: "10" },
    },
    "@ondc/org/cancellable": true,
    "@ondc/org/returnable": true,
    "@ondc/org/available_on_cod": true,
    "@ondc/org/time_to_ship": "PT24H",
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

  return {
    id: providerId,
    descriptor: {
      name: seller.storeName,
      short_desc: seller.storeDescription || seller.storeName,
      long_desc: seller.storeDescription || seller.storeName,
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
    items: products.map((p) =>
      itemDescriptor(p, baseUrl, providerId, locationId)
    ),
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
          { code: "category", value: "Grocery" },
          { code: "type", value: "12" },
          { code: "val", value: String(seller.fulfillment?.radiusKm ?? 5) },
          { code: "unit", value: "km" },
        ],
      },
    ],
  };
}

/** Single seller catalog (legacy / test-catalog) */
export function buildCatalogMessage(
  seller: ISeller,
  products: IProduct[],
  baseUrl: string
) {
  return buildMultiSellerCatalogMessage(
    [{ seller, products }],
    baseUrl,
    seller.storeName
  );
}

/** MSN-style catalog: all active sellers with published products */
export function buildMultiSellerCatalogMessage(
  entries: { seller: ISeller; products: IProduct[] }[],
  baseUrl: string,
  networkName?: string
) {
  const providers = entries
    .filter((e) => e.products.length > 0)
    .map((e) => buildProviderBlock(e.seller, e.products, baseUrl));

  const name =
    networkName || env.defaultStoreName || "Shopnix Marketplace";

  return {
    catalog: {
      "bpp/descriptor": {
        name,
        short_desc: "Multi-seller grocery & retail on ONDC",
        long_desc: "Products from verified Shopnix sellers",
        tags: [
          {
            code: "bpp_terms",
            list: [{ code: "np_type", value: "MSN" }],
          },
        ],
      },
      "bpp/providers": providers,
    },
  };
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

export async function resolveSellerFromOndcItemId(ondcItemId: string) {
  const product = await Product.findOne({ ondcItemId });
  if (!product) return { seller: null, product: null };
  const seller = await Seller.findById(product.sellerId);
  return { seller: seller ?? null, product };
}

export { getDefaultSeller, getPrimarySeller } from "../seller.service";
