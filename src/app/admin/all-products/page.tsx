"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import type { Product, Seller } from "@/types";

function productSeller(product: Product): Seller | null {
  return typeof product.sellerId === "object" ? product.sellerId : null;
}

export default function SuperadminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Product[]>("/products/all")
      .then(setProducts)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load products")
      );
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">All products</h1>
        <p className="text-slate-500">
          Superadmin read-only view of every seller product in the ONDC catalog.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card title="Marketplace products">
        {products.length === 0 ? (
          <p className="text-sm text-slate-500">No products created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Seller</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4">Stock</th>
                  <th className="py-2 pr-4">ONDC item</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const seller = productSeller(product);

                  return (
                    <tr key={product._id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 align-top">
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          SKU {product.sku} · {product.category}
                        </p>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <p>{seller?.storeName || "Unknown seller"}</p>
                        <p className="text-xs text-slate-500">
                          {seller?.email || "No email"}
                        </p>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        Rs {product.price.toLocaleString("en-IN")}
                        {product.mrp ? (
                          <p className="text-xs text-slate-500">
                            MRP Rs {product.mrp.toLocaleString("en-IN")}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        {product.quantity} {product.unit}
                      </td>
                      <td className="py-3 pr-4 align-top font-mono text-xs">
                        {product.ondcItemId}
                      </td>
                      <td className="py-3 align-top">
                        {product.isPublished ? "Published" : "Draft"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
