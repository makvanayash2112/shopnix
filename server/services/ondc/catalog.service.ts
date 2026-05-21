import { Product } from "../../models/Product";
import { Seller } from "../../models/Seller";
import { getPrimarySeller } from "../seller.service";
import type { IProduct } from "../../models/Product";
import type { ISeller } from "../../models/Seller";

function itemDescriptor(product: IProduct, baseUrl: string) {
  const images = product.images.map((url) => ({
    url: url.startsWith("http") ? url : `${baseUrl}${url}`,
  }));

  return {
    id: product.ondcItemId,
    parent_item_id: product.ondcItemId,
    descriptor: {
      name: product.name,
      code: product.sku,
      short_desc: product.description?.slice(0, 120) || product.name,
      long_desc: product.description || product.name,
      images: images.length ? images : undefined,
    },
    price: {
      currency: "INR",
      value: String(product.price),
      maximum_value: String(product.mrp ?? product.price),
    },
    quantity: {
      available: { count: String(product.quantity) },
      maximum: { count: String(Math.max(product.quantity, 99)) },
    },
    category_id: product.categorySlug || product.category,
    "@ondc/org/available_on_cod": false,
    "@ondc/org/cancellable": true,
    "@ondc/org/returnable": true,
    "@ondc/org/time_to_ship": "P1D",
  };
}

export function buildCatalogMessage(
  seller: ISeller,
  products: IProduct[],
  baseUrl: string
) {
  const providerId = seller._id.toString();

  return {
    catalog: {
      "bpp/descriptor": {
        name: seller.storeName,
        symbol: `${baseUrl}/uploads/store-logo.png`,
        short_desc: seller.storeDescription || seller.storeName,
        long_desc: seller.storeDescription || seller.storeName,
        tags: [
          {
            code: "bpp_terms",
            list: [
              { code: "np_type", value: "MSN" },
            ],
          },
        ],
      },
      "bpp/providers": [
        {
          id: providerId,
          descriptor: {
            name: seller.storeName,
            short_desc: seller.storeDescription || seller.storeName,
            long_desc: seller.storeDescription || seller.storeName,
          },
          locations: [
            {
              id: `${providerId}-loc-1`,
              gps: "12.9716,77.5946",
              address: {
                locality: seller.address?.street || "Main Street",
                city: seller.address?.city || "Bengaluru",
                state: seller.address?.state || "KA",
                area_code: seller.address?.pincode || "560001",
              },
            },
          ],
          items: products.map((p) => itemDescriptor(p, baseUrl)),
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
                { code: "location", value: `${providerId}-loc-1` },
                { code: "category", value: "Grocery" },
                { code: "type", value: "12" },
                { code: "val", value: String(seller.fulfillment?.radiusKm ?? 5) },
                { code: "unit", value: "km" },
              ],
            },
          ],
        },
      ],
    },
  };
}

export async function getPublishedCatalog(sellerId?: string) {
  const seller =
    sellerId != null
      ? await Seller.findById(sellerId)
      : await getPrimarySeller();

  if (!seller) {
    return { seller: null, products: [] as IProduct[] };
  }

  const products = await Product.find({
    sellerId: seller._id,
    isPublished: true,
    quantity: { $gt: 0 },
  }).limit(200);

  return { seller, products };
}

export { getDefaultSeller, getPrimarySeller } from "../seller.service";
