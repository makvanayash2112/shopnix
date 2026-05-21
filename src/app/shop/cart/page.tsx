"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useBuyerAuth } from "@/lib/buyer-auth";
import { Button } from "@/components/ui/Button";

export default function CartPage() {
  const { items, updateQty, removeItem, total } = useCart();
  const { isLoggedIn } = useBuyerAuth();

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg text-slate-600">Your cart is empty.</p>
        <Link href="/shop" className="mt-4 inline-block text-indigo-600 hover:underline">
          Continue shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">Your cart</h1>
      <ul className="mt-8 space-y-4">
        {items.map((item) => (
          <li
            key={item.productId}
            className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {item.image ? (
                <Image src={item.image} alt="" fill className="object-cover" unoptimized />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Link
                  href={`/shop/product/${item.productId}`}
                  className="font-semibold hover:text-indigo-600"
                >
                  {item.name}
                </Link>
                <p className="text-sm text-slate-500">₹{item.price} each</p>
              </div>
              <div className="mt-2 flex items-center gap-3 sm:mt-0">
                <input
                  type="number"
                  min={1}
                  max={item.maxStock}
                  value={item.quantity}
                  onChange={(e) =>
                    updateQty(item.productId, Number(e.target.value))
                  }
                  className="w-16 rounded border px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
                <span className="font-semibold">
                  ₹{item.price * item.quantity}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>₹{total}</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">Payment: Cash on delivery</p>
        {!isLoggedIn && (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <Link href="/shop/login?redirect=/shop/checkout" className="font-medium underline">
              Sign in
            </Link>{" "}
            or{" "}
            <Link href="/shop/register?redirect=/shop/checkout" className="font-medium underline">
              register
            </Link>{" "}
            to place your order.
          </p>
        )}
        <Link
          href={isLoggedIn ? "/shop/checkout" : "/shop/login?redirect=/shop/checkout"}
          className="mt-6 block"
        >
          <Button className="w-full bg-indigo-600 py-3 hover:bg-indigo-700">
            {isLoggedIn ? "Proceed to checkout" : "Sign in to checkout"}
          </Button>
        </Link>
      </div>
    </main>
  );
}
