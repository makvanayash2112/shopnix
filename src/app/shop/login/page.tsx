"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useBuyerAuth } from "@/lib/buyer-auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function BuyerLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params?.get("redirect") || "/shop";
  const { login } = useBuyerAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await login(fd.get("email") as string, fd.get("password") as string);
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">Buyer sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to place orders and track delivery
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Input label="Email" name="email" type="email" required />
          <Input label="Password" name="password" type="password" required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          New here?{" "}
          <Link
            href={`/shop/register?redirect=${encodeURIComponent(redirect)}`}
            className="font-medium text-indigo-600"
          >
            Create buyer account
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-slate-400">
          Browse products without signing in. Login required only to buy.
        </p>
      </div>
    </main>
  );
}
