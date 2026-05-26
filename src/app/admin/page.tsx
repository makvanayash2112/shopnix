"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { StatsCard } from "@/components/admin/StatsCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { DashboardStats, Order, Product, Seller, User } from "@/types";
import { Badge } from "@/components/ui/Badge";

export default function AdminDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    apiFetch<User>("/auth/me")
      .then((currentUser) => {
        setUser(currentUser);
        if (currentUser.role === "superadmin") {
          return Promise.all([
            apiFetch<Seller[]>("/seller/all"),
            apiFetch<Product[]>("/products/all"),
          ]).then(([sellerList, productList]) => {
            setSellers(sellerList);
            setAllProducts(productList);
          });
        }

        return Promise.all([
          apiFetch<DashboardStats>("/seller/stats"),
          apiFetch<Order[]>("/orders"),
        ]).then(([sellerStats, orders]) => {
          setStats(sellerStats);
          setRecentOrders(orders.slice(0, 5));
        });
      })
      .catch(console.error);
  }, []);

  if (user?.role === "superadmin") {
    const activeSellers = sellers.filter((seller) => seller.ondc?.isActive !== false);
    const publishedProducts = allProducts.filter((product) => product.isPublished);

    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Superadmin overview
          </h1>
          <p className="text-slate-500">
            Read-only view of sellers and their ONDC catalog products.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard label="Sellers" value={sellers.length} />
          <StatsCard label="Active on ONDC" value={activeSellers.length} />
          <StatsCard label="Products" value={allProducts.length} />
          <StatsCard label="Published products" value={publishedProducts.length} />
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/admin/sellers">
            <Button>View all sellers</Button>
          </Link>
          <Link href="/admin/all-products">
            <Button variant="secondary">View all products</Button>
          </Link>
        </div>

        <Card title="Recently registered sellers">
          {sellers.length === 0 ? (
            <p className="text-sm text-slate-500">No sellers registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 pr-4">Store</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">GSTIN/PAN</th>
                    <th className="py-2">ONDC</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.slice(0, 6).map((seller) => (
                    <tr key={seller._id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-medium">{seller.storeName}</td>
                      <td className="py-3 pr-4">{seller.email}</td>
                      <td className="py-3 pr-4">
                        {seller.gstin || seller.pan || "Missing"}
                      </td>
                      <td className="py-3">
                        {seller.ondc?.isActive !== false ? "Listed" : "Paused"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Seller dashboard</h1>
        <p className="text-slate-500">Overview of your ONDC seller store</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Products" value={stats?.productCount ?? "-"} />
        <StatsCard label="Published on ONDC" value={stats?.publishedCount ?? "-"} />
        <StatsCard label="Orders" value={stats?.orderCount ?? "-"} />
        <StatsCard
          label="Revenue completed"
          value={stats ? `Rs ${stats.revenue.toLocaleString("en-IN")}` : "-"}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/products/new">
          <Button>Add product</Button>
        </Link>
        <Link href="/admin/ondc">
          <Button variant="secondary">ONDC settings</Button>
        </Link>
      </div>

      <Card title="Recent orders">
        {recentOrders.length === 0 ? (
          <p className="text-sm text-slate-500">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-4">Order ID</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order._id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium">
                      <Link
                        href={`/admin/orders/${order._id}`}
                        className="text-emerald-700 hover:underline"
                      >
                        {order.orderId}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">Rs {order.payment.amount}</td>
                    <td className="py-3 pr-4">
                      <Badge status={order.status} />
                    </td>
                    <td className="py-3 text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
