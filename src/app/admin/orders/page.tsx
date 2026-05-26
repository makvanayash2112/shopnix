"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Order } from "@/types";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const q = filter ? `?status=${filter}` : "";
    apiFetch<Order[]>(`/orders${q}`).then(setOrders).catch(console.error);
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-slate-500">Orders received through ONDC</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="Created">Created</option>
          <option value="Accepted">Accepted</option>
          <option value="Packed">Packed</option>
          <option value="Delivering">Delivering</option>
          <option value="Delivered">Delivered</option>
          <option value="Return-Requested">Return requested</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 pr-4">Order</th>
                <th className="py-2 pr-4">Transaction</th>
                <th className="py-2 pr-4">Items</th>
                <th className="py-2 pr-4">Channel</th>
                <th className="py-2 pr-4">Payment</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 font-medium">{o.orderId}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">
                    {o.transactionId.slice(0, 12)}…
                  </td>
                  <td className="py-3 pr-4">{o.items.length}</td>
                  <td className="py-3 pr-4 capitalize text-slate-600">
                    {o.channel ?? "ondc"}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {o.payment.method === "cash" ? "Cash (COD)" : o.payment.method ?? "—"}
                  </td>
                  <td className="py-3 pr-4">₹{o.payment.amount}</td>
                  <td className="py-3 pr-4">
                    <Badge status={o.status} />
                  </td>
                  <td className="py-3">
                    <Link
                      href={`/admin/orders/${o._id}`}
                      className="text-emerald-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && (
          <p className="py-8 text-center text-slate-500">No orders yet.</p>
        )}
      </Card>
    </div>
  );
}
