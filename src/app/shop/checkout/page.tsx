"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useBuyerAuth } from "@/lib/buyer-auth";
import { buyerAuthFetch } from "@/lib/buyer-api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Order } from "@/types";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const { user, isLoggedIn, loading } = useBuyerAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.replace("/shop/login?redirect=/shop/checkout");
    }
  }, [loading, isLoggedIn, router]);

  if (loading) {
    return <main className="p-16 text-center">Loading…</main>;
  }

  if (!isLoggedIn || !user) return null;

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p>Cart is empty.</p>
        <Link href="/shop" className="mt-4 text-indigo-600 hover:underline">
          Continue shopping
        </Link>
      </main>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    try {
      const order = await buyerAuthFetch<Order>("/orders", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "cash",
          address: {
            street: fd.get("street"),
            city: fd.get("city"),
            state: fd.get("state"),
            pincode: fd.get("pincode"),
          },
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      });
      clearCart();
      router.push(`/shop/order-success?orderId=${order.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <p className="mt-1 text-sm text-slate-500">
        Signed in as <strong>{user.email}</strong>
      </p>

      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="font-semibold text-emerald-900">Cash on delivery (COD)</p>
        <p className="mt-1 text-sm text-emerald-800">
          Pay ₹{total} in cash when delivered. No online payment.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="rounded-lg bg-slate-50 p-4 text-sm">
          <p>
            <span className="text-slate-500">Name:</span> {user.name}
          </p>
          <p>
            <span className="text-slate-500">Phone:</span> {user.phone}
          </p>
          <p>
            <span className="text-slate-500">Email:</span> {user.email}
          </p>
        </div>

        <p className="text-sm font-medium text-slate-700">Delivery address</p>
        <Input
          label="Street"
          name="street"
          required
          defaultValue={user.address?.street}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="City" name="city" required defaultValue={user.address?.city} />
          <Input label="State" name="state" required defaultValue={user.address?.state} />
          <Input
            label="Pincode"
            name="pincode"
            required
            defaultValue={user.address?.pincode}
          />
        </div>

        <div className="rounded-lg bg-slate-100 p-4 text-sm">
          <div className="flex justify-between font-bold">
            <span>Order total</span>
            <span>₹{total}</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 py-3 hover:bg-indigo-700"
        >
          {submitting ? "Placing order…" : "Place order (COD)"}
        </Button>
      </form>
    </main>
  );
}
