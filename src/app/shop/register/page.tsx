"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useBuyerAuth } from "@/lib/buyer-auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function BuyerRegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params?.get("redirect") || "/shop";
  const { register } = useBuyerAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    try {
      await register({
        name: fd.get("name") as string,
        email: fd.get("email") as string,
        password: fd.get("password") as string,
        phone: fd.get("phone") as string,
        address: {
          street: String(fd.get("street") || ""),
          city: String(fd.get("city") || ""),
          state: String(fd.get("state") || ""),
          pincode: String(fd.get("pincode") || ""),
        },
      });
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold">Create buyer account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Email must be unique — one account per email
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Input label="Full name" name="name" required />
          <Input label="Email" name="email" type="email" required />
          <Input label="Phone" name="phone" type="tel" required />
          <Input
            label="Password (min 6 chars)"
            name="password"
            type="password"
            minLength={6}
            required
          />
          <p className="text-xs font-medium text-slate-500">Default address (optional)</p>
          <Input label="Street" name="street" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="City" name="city" />
            <Input label="State" name="state" />
            <Input label="Pincode" name="pincode" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {loading ? "Creating…" : "Register"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/shop/login" className="font-medium text-indigo-600">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
