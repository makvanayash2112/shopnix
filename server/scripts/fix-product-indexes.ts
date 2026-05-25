/**
 * One-time: drop global ondcItemId unique index, sync per-seller compound index.
 * Run: npx tsx server/scripts/fix-product-indexes.ts
 */
import dotenv from "dotenv";
import path from "path";
import { connectDatabase } from "../config/database";
import { ensureProductIndexes } from "../lib/ensure-indexes";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  await connectDatabase();
  await ensureProductIndexes();
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
