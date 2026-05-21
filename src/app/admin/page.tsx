"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { StatsCard } from "@/components/admin/StatsCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { DashboardStats, Order } from "@/types";
import { Badge } from "@/components/ui/Badge";

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    apiFetch<DashboardStats>("/seller/stats").then(setStats).catch(console.error);
    apiFetch<Order[]>("/orders")
      .then((o) => setRecentOrders(o.slice(0, 5)))
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Overview of your ONDC seller store</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label="Products" value={stats?.productCount ?? "—"} />
        <StatsCard
          label="Published on ONDC"
          value={stats?.publishedCount ?? "—"}
        />
        <StatsCard label="Orders" value={stats?.orderCount ?? "—"} />
        <StatsCard
          label="Revenue (completed)"
          value={stats ? `₹${stats.revenue.toLocaleString("en-IN")}` : "—"}
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
                {recentOrders.map((o) => (
                  <tr key={o._id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium">
                      <Link
                        href={`/admin/orders/${o._id}`}
                        className="text-emerald-700 hover:underline"
                      >
                        {o.orderId}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">₹{o.payment.amount}</td>
                    <td className="py-3 pr-4">
                      <Badge status={o.status} />
                    </td>
                    <td className="py-3 text-slate-500">
                      {new Date(o.createdAt).toLocaleDateString()}
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
