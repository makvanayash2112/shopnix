"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Product } from "@/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    apiFetch<Product[]>("/products").then(setProducts).catch(console.error);
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    await apiFetch(`/products/${id}`, { method: "DELETE" });
    setProducts((p) => p.filter((x) => x._id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-slate-500">Catalog synced to ONDC on search</p>
        </div>
        <Link href="/admin/products/new">
          <Button>Add product</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Card key={p._id} className="overflow-hidden p-0">
            <div className="relative h-40 bg-slate-100">
              {p.images?.[0] ? (
                <Image
                  src={p.images[0]}
                  alt={p.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">
                  No image
                </div>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-sm text-slate-500">
                ₹{p.price} · Stock {p.quantity}
                {p.images?.length > 1 && ` · ${p.images.length} images`}
              </p>
              <p className="text-xs text-slate-400">{p.category}</p>
              <p className="mt-1 truncate text-xs text-slate-400">
                {p.ondcItemId}
              </p>
              <div className="mt-4 flex gap-2">
                <Link href={`/admin/products/${p._id}/edit`}>
                  <Button variant="secondary" className="text-xs">
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="danger"
                  className="text-xs"
                  onClick={() => remove(p._id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {products.length === 0 && (
        <p className="text-center text-slate-500">No products yet.</p>
      )}
    </div>
  );
}
