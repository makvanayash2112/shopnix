/**
 * Seeds 15 catalog products with images for admin seller.
 * Run: npm run seed:products
 */
import fs from "fs";
import path from "path";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { connectDatabase } from "../config/database";
import { env } from "../config/env";
import { User } from "../models/User";
import { Seller } from "../models/Seller";
import { Product } from "../models/Product";
import { getCategoryBySlug } from "../constants/categories";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shopnix.com";

function picsum(seed: string, variant = 0) {
  return `https://picsum.photos/seed/shopnix-${seed}-v${variant}/800/800`;
}

/** 15 products — spread across 8 categories */
const CATALOG: {
  slug: string;
  name: string;
  brand: string;
  description: string;
  price: number;
  mrp: number;
  quantity: number;
  unit: string;
  imageSeeds: string[];
}[] = [
  {
    slug: "electronics",
    name: "Wireless Bluetooth Earbuds Pro",
    brand: "SoundMax",
    description:
      "Active noise cancellation, 30hr battery with case, IPX5 water resistant. Perfect for music and calls.",
    price: 1299,
    mrp: 2999,
    quantity: 45,
    unit: "piece",
    imageSeeds: ["earbuds", "earbuds-case"],
  },
  {
    slug: "electronics",
    name: "Smart Fitness Watch",
    brand: "FitPulse",
    description:
      "Heart rate, SpO2, sleep tracking, 100+ sport modes. AMOLED display with 7-day battery.",
    price: 2499,
    mrp: 4499,
    quantity: 30,
    unit: "piece",
    imageSeeds: ["smartwatch"],
  },
  {
    slug: "electronics",
    name: "1080p HD Webcam with Mic",
    brand: "ClearView",
    description:
      "Auto-focus webcam for video calls and streaming. Built-in dual microphone.",
    price: 1899,
    mrp: 2799,
    quantity: 25,
    unit: "piece",
    imageSeeds: ["webcam"],
  },
  {
    slug: "grocery",
    name: "Premium Basmati Rice 5kg",
    brand: "GoldenGrain",
    description: "Aged long-grain basmati rice. Aromatic and fluffy after cooking.",
    price: 549,
    mrp: 699,
    quantity: 120,
    unit: "pack",
    imageSeeds: ["basmati-rice"],
  },
  {
    slug: "grocery",
    name: "Extra Virgin Olive Oil 1L",
    brand: "Mediterra",
    description: "Cold-pressed olive oil for cooking and salads. Rich flavour.",
    price: 799,
    mrp: 999,
    quantity: 60,
    unit: "bottle",
    imageSeeds: ["olive-oil"],
  },
  {
    slug: "grocery",
    name: "Mixed Dry Fruits 500g",
    brand: "NutriBlend",
    description: "Almonds, cashews, raisins and walnuts. No added sugar.",
    price: 449,
    mrp: 599,
    quantity: 80,
    unit: "pack",
    imageSeeds: ["dry-fruits"],
  },
  {
    slug: "fashion",
    name: "Men's Cotton Crew Neck T-Shirt",
    brand: "UrbanWear",
    description:
      "100% combed cotton. Breathable fabric for daily wear. Machine washable.",
    price: 399,
    mrp: 799,
    quantity: 90,
    unit: "piece",
    imageSeeds: ["mens-tshirt"],
  },
  {
    slug: "fashion",
    name: "Women's Running Shoes",
    brand: "StrideFlex",
    description: "Lightweight mesh upper, cushioned sole for jogging and gym.",
    price: 1999,
    mrp: 3499,
    quantity: 40,
    unit: "pair",
    imageSeeds: ["womens-shoes", "womens-shoes-side"],
  },
  {
    slug: "home-kitchen",
    name: "Non-Stick Cookware Set 3pc",
    brand: "ChefHome",
    description: "Frying pan, kadai and tawa with induction-compatible base.",
    price: 1299,
    mrp: 1999,
    quantity: 35,
    unit: "set",
    imageSeeds: ["cookware"],
  },
  {
    slug: "home-kitchen",
    name: "LED Desk Lamp Adjustable",
    brand: "BrightDesk",
    description: "3 brightness levels, USB charging port, flexible gooseneck arm.",
    price: 699,
    mrp: 1099,
    quantity: 50,
    unit: "piece",
    imageSeeds: ["desk-lamp"],
  },
  {
    slug: "beauty",
    name: "Vitamin C Face Serum 30ml",
    brand: "GlowSkin",
    description: "Brightening serum with hyaluronic acid. Dermatologically tested.",
    price: 499,
    mrp: 799,
    quantity: 70,
    unit: "bottle",
    imageSeeds: ["face-serum"],
  },
  {
    slug: "beauty",
    name: "Herbal Anti-Dandruff Shampoo 400ml",
    brand: "NatureCare",
    description: "Tea tree and neem extract. Sulphate-free formula for daily use.",
    price: 299,
    mrp: 449,
    quantity: 100,
    unit: "bottle",
    imageSeeds: ["shampoo"],
  },
  {
    slug: "health",
    name: "Whey Protein Powder 1kg Chocolate",
    brand: "PowerFuel",
    description:
      "24g protein per serving. Supports muscle recovery after workouts.",
    price: 1899,
    mrp: 2499,
    quantity: 40,
    unit: "tub",
    imageSeeds: ["protein-powder"],
  },
  {
    slug: "sports",
    name: "Premium Yoga Mat 6mm Anti-Slip",
    brand: "ZenFit",
    description: "Eco-friendly TPE material. Includes carry strap. 183 x 61 cm.",
    price: 899,
    mrp: 1499,
    quantity: 55,
    unit: "piece",
    imageSeeds: ["yoga-mat"],
  },
  {
    slug: "books",
    name: "A4 Ruled Notebook Pack (5 pcs)",
    brand: "StudyPro",
    description: "200 pages each, spiral binding. Ideal for school and office notes.",
    price: 249,
    mrp: 399,
    quantity: 150,
    unit: "pack",
    imageSeeds: ["notebooks"],
  },
];

const uploadDir = path.join(process.cwd(), "public", "uploads", "products");

async function downloadToLocal(
  url: string,
  baseName: string,
  index: number
): Promise<string> {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = ".jpg";
  const filename = `${baseName}-${index}${ext}`;
  const filepath = path.join(uploadDir, filename);

  if (!fs.existsSync(filepath)) {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 45000,
      headers: { "User-Agent": "Shopnix-Seed/1.0" },
    });
    fs.writeFileSync(filepath, Buffer.from(res.data));
  }

  return `${env.apiBaseUrl}/uploads/products/${filename}`;
}

async function getAdminSeller() {
  const user = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
  if (!user?.sellerId) {
    throw new Error(
      `Admin user ${ADMIN_EMAIL} not found. Run: npm run seed:admin`
    );
  }
  const seller = await Seller.findById(user.sellerId);
  if (!seller) throw new Error("Admin seller profile missing");
  return { user, seller };
}

async function seed() {
  await connectDatabase();
  const { seller } = await getAdminSeller();

  console.log(`[seed] Admin seller: ${seller.storeName} (${ADMIN_EMAIL})`);

  const removed = await Product.deleteMany({ sellerId: seller._id });
  console.log(`[seed] Removed ${removed.deletedCount} old products for this seller`);

  let created = 0;

  for (const item of CATALOG) {
    const cat = getCategoryBySlug(item.slug)!;
    const slugBase = item.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);

    const localImages: string[] = [];
    for (let i = 0; i < item.imageSeeds.length; i++) {
      const remoteUrl = picsum(item.imageSeeds[i], i);
      try {
        const url = await downloadToLocal(remoteUrl, slugBase, i);
        localImages.push(url);
        console.log(
          `[seed] Image OK: ${item.name} (${i + 1}/${item.imageSeeds.length})`
        );
      } catch (err) {
        console.warn(`[seed] Image skip ${item.name}:`, (err as Error).message);
      }
    }

    if (localImages.length === 0) {
      const fallback = await downloadToLocal(picsum(item.slug, 0), slugBase, 0);
      localImages.push(fallback);
    }

    await Product.create({
      sellerId: seller._id,
      name: item.name,
      description: item.description,
      brand: item.brand,
      category: cat.name,
      categorySlug: cat.slug,
      sku: `SNX-${cat.slug.toUpperCase().slice(0, 3)}-${uuidv4().slice(0, 6).toUpperCase()}`,
      price: item.price,
      mrp: item.mrp,
      quantity: item.quantity,
      unit: item.unit,
      images: localImages,
      isPublished: true,
      ondcItemId: `item-${uuidv4()}`,
      tags: [cat.slug, item.brand.toLowerCase()],
    });

    created++;
    console.log(`[seed] Product ${created}/15: ${item.name} [${cat.name}]`);
  }

  console.log(`\n[seed] Done — ${created} products with images for ${ADMIN_EMAIL}`);
  console.log("[seed] Buyer shop: http://localhost:3000/shop\n");
  process.exit(0);
}

seed().catch((e) => {
  console.error("[seed] Failed:", e);
  process.exit(1);
});
