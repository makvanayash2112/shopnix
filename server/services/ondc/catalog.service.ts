import { Product } from "../../models/Product";
import { Seller } from "../../models/Seller";
import { getPrimarySeller } from "../seller.service";
import type { IProduct } from "../../models/Product";
import type { ISeller } from "../../models/Seller";

function itemDescriptor(
  product: IProduct,
  baseUrl: string,
  providerId: string
) {
  const images = product.images.map((url) => ({
    url: url.startsWith("http")
      ? url
      : `${baseUrl}${url}`,
  }));

  return {
    id: product.ondcItemId,

    descriptor: {
      name: product.name,
      short_desc:
        product.description?.slice(0, 120) ||
        product.name,
      long_desc:
        product.description || product.name,
      images,
      symbol: images[0]?.url,
    },

    price: {
      currency: "INR",
      value: String(product.price),
      maximum_value: String(
        product.mrp || product.price
      ),
    },

    category_id:
      product.categorySlug || "grocery",

    fulfillment_ids: ["F1"],

    location_ids: [
      `${providerId}-location`,
    ],

    quantity: {
      available: {
        count: String(product.quantity),
      },
      maximum: {
        count: "10",
      },
    },

    "@ondc/org/cancellable": true,

    "@ondc/org/returnable": true,

    "@ondc/org/available_on_cod": true,

    "@ondc/org/time_to_ship": "PT24H",
  };
}

export function buildCatalogMessage(
  seller: ISeller,
  products: IProduct[],
  baseUrl: string
) {
  // const providerId = seller._id.toString();
  const providerId =
    seller.ondcProviderId || "SHOPNIX_PROVIDER";

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
              id: `${providerId}-location`,

              descriptor: {
                name: seller.storeName,
              },

              // gps: seller.address?.gps ||
              //   "12.9716,77.5946",

              address: {
                locality:
                  seller.address?.street ||
                  "Main Street",

                city:
                  seller.address?.city ||
                  "Bengaluru",

                state:
                  seller.address?.state ||
                  "KA",

                area_code:
                  seller.address?.pincode ||
                  "560001",
              },

              time: {
                label: "enable",
                timestamp: new Date().toISOString(),
              },
            },
          ],
          // items: products.map((p) => itemDescriptor(p, baseUrl)),
          items: products.map((p) =>
            itemDescriptor(
              p,
              baseUrl,
              providerId
            )
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
  }).limit(10);

  return { seller, products };
}

export { getDefaultSeller, getPrimarySeller } from "../seller.service";
