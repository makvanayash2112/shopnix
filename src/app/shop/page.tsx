"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buyerFetch } from "@/lib/buyer-api";
import { ProductCard } from "@/components/shop/ProductCard";
import type { Category, Product } from "@/types";

export default function ShopHomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buyerFetch<Category[]>("/categories").then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}&limit=24` : "?limit=24";
    buyerFetch<{ products: Product[] }>(`/products${q}`)
      .then((d) => setProducts(d.products))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <section className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-12 text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">
          Shop electronics, grocery & more
        </h1>
        <p className="mt-3 max-w-xl text-indigo-100">
          Cash on delivery only — no online payment needed. Browse categories and
          order from ONDC-ready sellers.
        </p>
        <div className="mt-6 flex max-w-lg gap-2">
          <input
            type="search"
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border-0 px-4 py-2.5 text-slate-900"
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Categories</h2>
          <Link href="/shop/categories" className="text-sm text-indigo-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {categories.slice(0, 6).map((c) => (
            <Link
              key={c.slug}
              href={`/shop/category/${c.slug}`}
              className="rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:border-indigo-300 hover:shadow-sm"
            >
              <span className="text-2xl">{c.icon}</span>
              <p className="mt-2 text-sm font-medium text-slate-800">{c.name}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">
          {search ? `Results for “${search}”` : "Featured products"}
        </h2>
        {loading ? (
          <p className="mt-8 text-slate-500">Loading products…</p>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
        {!loading && products.length === 0 && (
          <p className="mt-8 text-center text-slate-500">
            No products yet. Seller can add items from admin.
          </p>
        )}
      </section>
    </main>
  );
}
