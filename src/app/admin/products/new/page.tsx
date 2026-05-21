"use client";

import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { ProductForm } from "@/components/admin/ProductForm";

export default function NewProductPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Add product</h1>
      <Card>
        <ProductForm
          onSubmit={async (fd) => {
            await apiFetch("/products", { method: "POST", body: fd });
            router.push("/admin/products");
          }}
        />
      </Card>
    </div>
  );
}
