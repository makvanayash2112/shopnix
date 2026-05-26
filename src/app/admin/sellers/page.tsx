"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import type { Product, Seller } from "@/types";

function sellerProductCounts(products: Product[]) {
  return products.reduce<Record<string, { total: number; published: number }>>(
    (counts, product) => {
      const seller =
        typeof product.sellerId === "object" ? product.sellerId?._id : product.sellerId;
      if (!seller) return counts;
      counts[seller] ??= { total: 0, published: 0 };
      counts[seller].total += 1;
      if (product.isPublished) counts[seller].published += 1;
      return counts;
    },
    {}
  );
}

export default function SuperadminSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch<Seller[]>("/seller/all"), apiFetch<Product[]>("/products/all")])
      .then(([sellerList, productList]) => {
        setSellers(sellerList);
        setProducts(productList);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load sellers")
      );
  }, []);

  const counts = sellerProductCounts(products);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">All sellers</h1>
        <p className="text-slate-500">
          Superadmin read-only view of every registered seller.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card title="Seller directory">
        {sellers.length === 0 ? (
          <p className="text-sm text-slate-500">No sellers registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-4">Store</th>
                  <th className="py-2 pr-4">Contact</th>
                  <th className="py-2 pr-4">Tax IDs</th>
                  <th className="py-2 pr-4">Address</th>
                  <th className="py-2 pr-4">Products</th>
                  <th className="py-2">ONDC provider</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((seller) => {
                  const productCount = counts[seller._id] ?? {
                    total: 0,
                    published: 0,
                  };

                  return (
                    <tr key={seller._id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 align-top">
                        <p className="font-medium text-slate-900">
                          {seller.storeName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {seller.ondc?.isActive !== false ? "Listed" : "Paused"}
                        </p>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <p>{seller.email}</p>
                        <p className="text-xs text-slate-500">
                          {seller.phone || "No phone"}
                        </p>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <p>GSTIN: {seller.gstin || "Missing"}</p>
                        <p className="text-xs text-slate-500">
                          PAN: {seller.pan || "Missing"}
                        </p>
                      </td>
                      <td className="py-3 pr-4 align-top text-slate-600">
                        {[seller.address?.city, seller.address?.state, seller.address?.pincode]
                          .filter(Boolean)
                          .join(", ") || "Missing"}
                      </td>
                      <td className="py-3 pr-4 align-top">
                        {productCount.total} total
                        <p className="text-xs text-slate-500">
                          {productCount.published} published
                        </p>
                      </td>
                      <td className="py-3 align-top font-mono text-xs">
                        {seller.ondcProviderId || "Not assigned"}
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
