"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { buyerFetch } from "@/lib/buyer-api";
import { useCart } from "@/lib/cart";
import { ImageGallery } from "@/components/shop/ImageGallery";
import { ProductCard } from "@/components/shop/ProductCard";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/types";

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();

  useEffect(() => {
    buyerFetch<{ product: Product; related: Product[] }>(`/products/${id}`).then(
      (d) => {
        setProduct(d.product);
        setRelated(d.related);
      }
    );
  }, [id]);

  if (!product) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center text-slate-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2">
        <ImageGallery images={product.images} alt={product.name} />
        <div>
          <p className="text-sm font-medium text-indigo-600">{product.category}</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">{product.name}</h1>
          {product.brand && (
            <p className="mt-1 text-slate-500">Brand: {product.brand}</p>
          )}
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold">₹{product.price}</span>
            {product.mrp && product.mrp > product.price && (
              <span className="text-lg text-slate-400 line-through">
                ₹{product.mrp}
              </span>
            )}
          </div>
          <p className="mt-4 text-slate-600">
            {product.description || "No description."}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {product.quantity > 0
              ? `${product.quantity} in stock`
              : "Out of stock"}
          </p>

          <div className="mt-6 flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">Qty</label>
            <input
              type="number"
              min={1}
              max={product.quantity}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="w-20 rounded-lg border border-slate-200 px-3 py-2"
            />
          </div>

          <Button
            className="mt-6 w-full max-w-sm bg-indigo-600 py-3 hover:bg-indigo-700"
            disabled={product.quantity < 1}
            onClick={() => {
              addItem(
                {
                  productId: product._id,
                  name: product.name,
                  price: product.price,
                  image: product.images[0],
                  maxStock: product.quantity,
                },
                qty
              );
            }}
          >
            Add to cart
          </Button>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Cash on delivery only</strong> — pay when your order arrives.
            No card or UPI required.
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold">Related products</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}

      <Link href="/shop" className="mt-8 inline-block text-sm text-indigo-600 hover:underline">
        ← Back to shop
      </Link>
    </main>
  );
}
