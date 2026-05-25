"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StorageBanner } from "@/components/admin/StorageBanner";
import { CATEGORIES } from "@/lib/categories";
import type { Product } from "@/types";

type Props = {
  initial?: Partial<Product>;
  onSubmit: (formData: FormData) => Promise<void>;
  submitLabel?: string;
};

export function ProductForm({
  initial,
  onSubmit,
  submitLabel = "Save product",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [removeUrls, setRemoveUrls] = useState<string[]>([]);

  const defaultSlug =
    initial?.categorySlug ||
    CATEGORIES.find((c) => c.name === initial?.category)?.slug ||
    "grocery";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (files) {
      Array.from(files).forEach((f) => fd.append("images", f));
    }
    if (removeUrls.length) {
      fd.set("removeImages", removeUrls.join(","));
    }
    try {
      await onSubmit(fd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  const existingImages =
    initial?.images?.filter((u) => !removeUrls.includes(u)) ?? [];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <StorageBanner />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Product name"
          name="name"
          required
          defaultValue={initial?.name}
        />
        <Input label="SKU" name="sku" defaultValue={initial?.sku} />
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Category</span>
          <select
            name="categorySlug"
            defaultValue={defaultSlug}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </label>
        <Input label="Brand" name="brand" defaultValue={initial?.brand} />
        <Input
          label="Price (₹)"
          name="price"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={initial?.price}
        />
        <Input
          label="MRP (₹)"
          name="mrp"
          type="number"
          min="0"
          step="0.01"
          defaultValue={initial?.mrp}
        />
        <Input
          label="Stock quantity"
          name="quantity"
          type="number"
          min="0"
          required
          defaultValue={initial?.quantity ?? 0}
        />
        <Input
          label="Unit"
          name="unit"
          defaultValue={initial?.unit ?? "unit"}
        />
      </div>

      {initial?.ondcItemId && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          ONDC item ID: <code className="font-mono">{initial.ondcItemId}</code>{" "}
          (auto-assigned per store; same SKU can exist on another seller&apos;s store)
        </p>
      )}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">Description</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={initial?.description}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isPublished"
          value="true"
          defaultChecked={initial?.isPublished !== false}
          className="rounded border-slate-300 text-emerald-600"
        />
        Publish on ONDC catalog (requires image + stock &gt; 0)
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">
          Image URLs (HTTPS, one per line — works on Vercel without Blob)
        </span>
        <textarea
          name="imageUrls"
          rows={3}
          placeholder={
            "https://shopnix-nine.vercel.app/uploads/products/example.jpg\nhttps://your-cdn.com/photo.png"
          }
          className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
        />
      </label>

      {existingImages.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Current images ({existingImages.length}/8)
          </p>
          <div className="flex flex-wrap gap-3">
            {existingImages.map((url) => (
              <div key={url} className="relative">
                <div className="relative h-24 w-24 overflow-hidden rounded-lg border">
                  <Image src={url} alt="" fill className="object-cover" unoptimized />
                </div>
                <button
                  type="button"
                  onClick={() => setRemoveUrls((r) => [...r, url])}
                  className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-xs text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">
          Upload image files (optional if URLs added above)
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(e.target.files)}
          className="block w-full text-sm text-slate-600"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
