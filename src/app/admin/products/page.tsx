"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StorageBanner } from "@/components/admin/StorageBanner";
import type { OndcReadiness, Product } from "@/types";

function imageSrc(image: string) {
  if (image.startsWith("http") || image.startsWith("/")) return image;
  return `/uploads/products/${image}`;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [readiness, setReadiness] = useState<OndcReadiness | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    apiFetch<Product[]>("/products").then(setProducts).catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to load products");
    });
    apiFetch<OndcReadiness>("/seller/ondc-readiness").then(setReadiness).catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    try {
      await apiFetch(`/products/${id}`, { method: "DELETE" });
      setProducts((p) => p.filter((x) => x._id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function togglePublish(p: Product) {
    try {
      const path = p.isPublished
        ? `/products/${p._id}/unpublish`
        : `/products/${p._id}/publish`;
      const updated = await apiFetch<Product>(path, { method: "PATCH" });
      setProducts((list) =>
        list.map((x) => (x._id === updated._id ? updated : x))
      );
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not update publish status");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-slate-500">
            Published items appear in your ONDC catalog on search
            {readiness?.providerId && (
              <>
                {" "}
                · Provider{" "}
                <code className="text-xs">{readiness.providerId}</code>
              </>
            )}
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button>Add product</Button>
        </Link>
      </div>

      <StorageBanner />

      {readiness && !readiness.ready && (
        <Card className="border-amber-200 bg-amber-50/80">
          <p className="text-sm font-medium text-amber-900">ONDC not ready yet</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {readiness.checks
              ?.filter((c) => !c.ok && c.id !== "gstin")
              .map((c) => (
                <li key={c.id}>
                  ○ {c.label}
                  {c.hint && (
                    <span className="block text-xs text-amber-700">{c.hint}</span>
                  )}
                </li>
              ))}
          </ul>
          <Link href="/admin/settings" className="mt-3 inline-block text-sm text-emerald-700 hover:underline">
            Complete store profile →
          </Link>
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <Card key={p._id} className="overflow-hidden p-0">
            <div className="relative h-40 bg-slate-100">
              {p.images?.[0] ? (
                <Image
                  src={imageSrc(p.images[0])}
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
              <span
                className={`absolute left-2 top-2 rounded px-2 py-0.5 text-xs font-medium ${
                  p.isPublished
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-600 text-white"
                }`}
              >
                {p.isPublished ? "ONDC live" : "Draft"}
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-semibold">{p.name}</h3>
              <p className="text-sm text-slate-500">
                ₹{p.price} · Stock {p.quantity}
                {p.images?.length > 1 && ` · ${p.images.length} images`}
              </p>
              <p className="text-xs text-slate-400">{p.category}</p>
              <p className="mt-1 truncate font-mono text-xs text-slate-400">
                {p.ondcItemId}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="text-xs"
                  onClick={() => togglePublish(p)}
                >
                  {p.isPublished ? "Unpublish" : "Publish ONDC"}
                </Button>
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
