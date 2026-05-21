"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBuyerAuth } from "@/lib/buyer-auth";
import { buyerAuthFetch } from "@/lib/buyer-api";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { Order } from "@/types";

export default function BuyerOrdersPage() {
  const router = useRouter();
  const { isLoggedIn, loading } = useBuyerAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.replace("/shop/login?redirect=/shop/orders");
      return;
    }
    if (isLoggedIn) {
      buyerAuthFetch<Order[]>("/orders").then(setOrders).catch(console.error);
    }
  }, [loading, isLoggedIn, router]);

  if (loading) {
    return <main className="p-16 text-center">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">My orders</h1>
      <p className="mt-1 text-slate-500">Track status and payment (cash on delivery)</p>

      <div className="mt-8 space-y-4">
        {orders.map((o) => (
          <Card key={o._id} className="transition hover:border-indigo-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <Link
                  href={`/shop/orders/${o.orderId}`}
                  className="font-mono text-lg font-bold text-indigo-600 hover:underline"
                >
                  {o.orderId}
                </Link>
                <p className="mt-1 text-sm text-slate-500">
                  {new Date(o.createdAt).toLocaleString()} · {o.items.length}{" "}
                  item(s)
                </p>
              </div>
              <div className="text-right">
                <Badge status={o.status} />
                <p className="mt-2 font-bold">₹{o.payment.amount}</p>
                <p className="text-xs text-slate-500">Cash on delivery</p>
              </div>
            </div>
            <Link
              href={`/shop/orders/${o.orderId}`}
              className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
            >
              View status →
            </Link>
          </Card>
        ))}
      </div>

      {orders.length === 0 && (
        <div className="mt-12 text-center">
          <p className="text-slate-500">No orders yet.</p>
          <Link href="/shop" className="mt-4 inline-block text-indigo-600 hover:underline">
            Start shopping
          </Link>
        </div>
      )}
    </main>
  );
}
