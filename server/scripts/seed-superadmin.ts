import bcrypt from "bcryptjs";
import { connectDatabase } from "../config/database";
import { User } from "../models/User";

const SUPERADMIN_EMAIL = (
  process.env.SUPERADMIN_EMAIL ||
  "superadmin@shopnix.com"
).toLowerCase();
const SUPERADMIN_PASSWORD =
  process.env.SUPERADMIN_PASSWORD ||
  "Shopnix@Admin2026";
const SUPERADMIN_NAME =
  process.env.SUPERADMIN_NAME || "Shopnix Superadmin";

async function seedSuperadmin() {
  await connectDatabase();

  const hashed = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
  const existing = await User.findOne({ email: SUPERADMIN_EMAIL }).select(
    "+password"
  );

  if (existing) {
    existing.name = SUPERADMIN_NAME;
    existing.password = hashed;
    existing.role = "superadmin";
    existing.sellerId = undefined;
    await existing.save();
    console.log("[seed] Superadmin user updated");
  } else {
    await User.create({
      name: SUPERADMIN_NAME,
      email: SUPERADMIN_EMAIL,
      password: hashed,
      role: "superadmin",
    });
    console.log("[seed] Superadmin user created");
  }

  console.log("\n--- Superadmin credentials ---");
  console.log("Email:   ", SUPERADMIN_EMAIL);
  console.log("Password:", SUPERADMIN_PASSWORD);
  console.log("Login:   /login\n");
}

seedSuperadmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed] Failed:", err);
    process.exit(1);
  });
