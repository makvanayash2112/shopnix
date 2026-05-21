"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buyerFetch } from "@/lib/buyer-api";
import type { Category } from "@/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    buyerFetch<Category[]>("/categories").then(setCategories);
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">All categories</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/shop/category/${c.slug}`}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-400 hover:shadow-md"
          >
            <span className="text-3xl">{c.icon}</span>
            <span className="font-semibold text-slate-900">{c.name}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
