"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useBuyerAuth } from "@/lib/buyer-auth";

export function ShopHeader() {
  const { count } = useCart();
  const { user, isLoggedIn, logout, loading } = useBuyerAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/shop" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            S
          </span>
          <div>
            <p className="text-xs text-indigo-600">Shopnix</p>
            <p className="text-sm font-bold text-slate-900">Buyer Store</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex">
          <Link href="/shop" className="hover:text-indigo-600">
            Home
          </Link>
          <Link href="/shop/categories" className="hover:text-indigo-600">
            Categories
          </Link>
          {isLoggedIn && (
            <Link href="/shop/orders" className="hover:text-indigo-600">
              My orders
            </Link>
          )}
          <Link href="/admin" className="text-slate-400 hover:text-slate-600">
            Seller admin
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {!loading && (
            <>
              {isLoggedIn ? (
                <>
                  <Link
                    href="/shop/account"
                    className="hidden text-sm font-medium text-slate-600 hover:text-indigo-600 sm:inline"
                  >
                    {user?.name?.split(" ")[0]}
                  </Link>
                  <button
                    type="button"
                    onClick={logout}
                    className="hidden text-sm text-slate-500 hover:text-slate-800 sm:inline"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/shop/login"
                    className="text-sm font-medium text-slate-600 hover:text-indigo-600"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/shop/register"
                    className="hidden rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 sm:inline"
                  >
                    Register
                  </Link>
                </>
              )}
            </>
          )}
          <Link
            href="/shop/cart"
            className="relative rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Cart
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-slate-900">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
