/**
 * Creates default admin user + seller profile.
 * Run: npx tsx server/scripts/seed-admin.ts
 */
import bcrypt from "bcryptjs";
import { connectDatabase } from "../config/database";
import { env } from "../config/env";
import { User } from "../models/User";
import { Seller } from "../models/Seller";
import { assignOndcProviderId } from "../services/ondc/seller-readiness.service";

const ADMIN_EMAIL = "admin@shopnix.com";
const ADMIN_PASSWORD = "Shopnix@Admin2026";
const ADMIN_NAME = "Shopnix Admin";

async function seedAdmin() {
  await connectDatabase();

  let seller = await Seller.findOne({ email: ADMIN_EMAIL });
  if (!seller) {
    seller = await Seller.create({
      storeName: env.defaultStoreName,
      storeDescription: "Shopnix ONDC seller admin store",
      email: ADMIN_EMAIL,
      phone: "9999999999",
      gstin: "29ABCDE1234F1Z5",
      address: {
        street: "MG Road",
        city: "Bengaluru",
        state: "KA",
        pincode: "560001",
        country: "India",
      },
      ondc: {
        bppId: env.ondc.bppId,
        bppUri: env.ondc.bppUri,
        domain: env.ondc.domain,
        city: env.ondc.city,
        isActive: true,
        subscriberId: env.ondc.subscriberId,
      },
    });
    seller.ondcProviderId = assignOndcProviderId(seller);
    await seller.save();
    console.log("[seed] Seller profile created, provider:", seller.ondcProviderId);
  } else {
    if (!seller.ondcProviderId) {
      seller.ondcProviderId = assignOndcProviderId(seller);
      await seller.save();
    }
    console.log("[seed] Seller profile already exists");
  }

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);

  if (existing) {
    existing.password = hashed;
    existing.role = "admin";
    existing.name = ADMIN_NAME;
    existing.sellerId = seller._id;
    await existing.save();
    console.log("[seed] Admin user updated");
  } else {
    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashed,
      role: "admin",
      sellerId: seller._id,
    });
    console.log("[seed] Admin user created");
  }

  console.log("\n--- Admin credentials ---");
  console.log("Email:   ", ADMIN_EMAIL);
  console.log("Password:", ADMIN_PASSWORD);
  console.log("Login:   http://localhost:3000/login\n");

  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
