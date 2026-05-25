import { Product } from "../models/Product";

let indexesEnsured = false;

/** Drop legacy global ondcItemId unique index; use per-seller compound index. */
export async function ensureProductIndexes(): Promise<void> {
  if (indexesEnsured) return;

  try {
    const indexes = await Product.collection.indexes();
    const legacy = indexes.find(
      (idx) =>
        idx.key &&
        Object.keys(idx.key).length === 1 &&
        "ondcItemId" in idx.key &&
        idx.unique
    );
    if (legacy?.name) {
      await Product.collection.dropIndex(legacy.name);
      console.log(`[db] Dropped legacy index: ${legacy.name}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("index not found") && !msg.includes("ns not found")) {
      console.warn("[db] Legacy index drop:", msg);
    }
  }

  await Product.syncIndexes();
  indexesEnsured = true;
  console.log("[db] Product indexes synced (sellerId + ondcItemId unique per store)");
}
