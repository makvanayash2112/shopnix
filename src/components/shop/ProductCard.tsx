"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/lib/cart";
import type { Product } from "@/types";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const image = product.images?.[0];
  const discount =
    product.mrp && product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <Link href={`/shop/product/${product._id}`} className="relative aspect-square bg-slate-50">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            className="object-cover transition group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            No image
          </div>
        )}
        {discount > 0 && (
          <span className="absolute left-2 top-2 rounded-md bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
            {discount}% off
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
          {product.category}
        </p>
        <Link href={`/shop/product/${product._id}`}>
          <h3 className="mt-1 line-clamp-2 font-semibold text-slate-900 hover:text-indigo-600">
            {product.name}
          </h3>
        </Link>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold text-slate-900">₹{product.price}</span>
          {product.mrp && product.mrp > product.price && (
            <span className="text-sm text-slate-400 line-through">
              ₹{product.mrp}
            </span>
          )}
        </div>
        <Button
          className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700"
          onClick={() =>
            addItem({
              productId: product._id,
              name: product.name,
              price: product.price,
              image: product.images?.[0],
              maxStock: product.quantity,
            })
          }
        >
          Add to cart
        </Button>
      </div>
    </article>
  );
}
