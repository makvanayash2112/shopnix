"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { buyerFetch } from "@/lib/buyer-api";
import { ProductCard } from "@/components/shop/ProductCard";
import type { Category, Product } from "@/types";

export default function CategoryPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    buyerFetch<{ category: Category; products: Product[] }>(
      `/categories/${slug}`
    ).then((d) => {
      setCategory(d.category);
      setProducts(d.products);
    });
  }, [slug]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">
        {category ? (
          <>
            <span className="mr-2">{category.icon}</span>
            {category.name}
          </>
        ) : (
          "Loading…"
        )}
      </h1>
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
      {products.length === 0 && (
        <p className="mt-12 text-center text-slate-500">No products in this category.</p>
      )}
    </main>
  );
}
