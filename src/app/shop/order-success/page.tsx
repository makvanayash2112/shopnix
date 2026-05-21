"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function OrderSuccessPage() {
  const params = useSearchParams();
  const orderId = params?.get("orderId");

  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
        ✓
      </div>
      <h1 className="mt-6 text-2xl font-bold text-slate-900">Order placed!</h1>
      {orderId && (
        <p className="mt-2 font-mono text-sm text-slate-600">Order ID: {orderId}</p>
      )}
      <p className="mt-4 text-slate-600">
        Pay with <strong>cash on delivery</strong> when your items arrive.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {orderId && (
          <Link href={`/shop/orders/${orderId}`}>
            <Button variant="secondary">Track order status</Button>
          </Link>
        )}
        <Link href="/shop">
          <Button className="bg-indigo-600 hover:bg-indigo-700">
            Continue shopping
          </Button>
        </Link>
      </div>
    </main>
  );
}
