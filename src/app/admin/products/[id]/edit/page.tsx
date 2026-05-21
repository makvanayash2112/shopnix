"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { ProductForm } from "@/components/admin/ProductForm";
import type { Product } from "@/types";

export default function EditProductPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    apiFetch<Product>(`/products/${id}`).then(setProduct).catch(console.error);
  }, [id]);

  if (!product) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Edit product</h1>
      <Card>
        <ProductForm
          initial={product}
          submitLabel="Update product"
          onSubmit={async (fd) => {
            await apiFetch(`/products/${id}`, { method: "PUT", body: fd });
            router.push("/admin/products");
          }}
        />
      </Card>
    </div>
  );
}
