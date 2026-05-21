/**
 * Fixes orders with wrong sellerId — sets seller from order line products.
 * Run: npx tsx server/scripts/fix-order-sellers.ts
 */
import { connectDatabase } from "../config/database";
import { Order } from "../models/Order";
import { Product } from "../models/Product";
import { getPrimarySeller } from "../services/seller.service";

async function fix() {
  await connectDatabase();
  const primary = await getPrimarySeller();
  console.log(`[fix] Primary seller: ${primary.storeName} (${primary._id})`);

  const orders = await Order.find({ channel: "buyer" });
  let fixed = 0;

  for (const order of orders) {
    const sellerIds = new Set<string>();

    for (const item of order.items) {
      if (item.productId) {
        const product = await Product.findById(item.productId);
        if (product?.sellerId) {
          sellerIds.add(product.sellerId.toString());
        }
      }
    }

    const correctSellerId =
      sellerIds.size === 1
        ? [...sellerIds][0]
        : primary._id.toString();

    if (order.sellerId.toString() !== correctSellerId) {
      order.sellerId = correctSellerId as unknown as typeof order.sellerId;
      await order.save();
      fixed++;
      console.log(`[fix] ${order.orderId} → seller ${correctSellerId}`);
    }
  }

  console.log(`[fix] Done. Updated ${fixed} of ${orders.length} buyer orders.`);
  process.exit(0);
}

fix().catch((e) => {
  console.error(e);
  process.exit(1);
});
