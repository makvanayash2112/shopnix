"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, setToken } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { User } from "@/types";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    try {
      const data = await apiFetch<{ token: string; user: User }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            name: fd.get("name"),
            email: fd.get("email"),
            password: fd.get("password"),
            storeName: fd.get("storeName"),
            phone: fd.get("phone"),
            gstin: fd.get("gstin"),
            pan: fd.get("pan"),
            address: {
              street: fd.get("street"),
              city: fd.get("city"),
              state: fd.get("state"),
              pincode: fd.get("pincode"),
            },
          }),
        }
      );
      setToken(data.token);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">
          Create seller account
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sets up your store and ONDC MSN provider profile.
        </p>

        <form onSubmit={onSubmit} className="mt-8 grid gap-4 sm:grid-cols-2">
          <Input label="Your name" name="name" required />
          <Input label="Store name" name="storeName" required />
          <Input label="Email" name="email" type="email" required />
          <Input
            label="Phone"
            name="phone"
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            title="Enter a valid 10 digit Indian mobile number"
            required
          />
          <Input
            label="Password"
            name="password"
            type="password"
            required
            minLength={6}
          />
          <Input
            label="GSTIN"
            name="gstin"
            pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]"
            title="Enter a valid 15 character GSTIN"
          />
          <Input
            label="PAN"
            name="pan"
            pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
            title="Enter a valid 10 character PAN"
          />
          <Input label="Street address" name="street" required />
          <Input label="City" name="city" required />
          <Input label="State" name="state" required />
          <Input
            label="Pincode"
            name="pincode"
            inputMode="numeric"
            pattern="[1-9][0-9]{5}"
            title="Enter a valid 6 digit Indian pincode"
            required
          />
          <p className="text-xs text-slate-500 sm:col-span-2">
            GSTIN or PAN is required. If both are entered, the PAN must match
            the GSTIN.
          </p>
          {error && (
            <p className="text-sm text-red-600 sm:col-span-2">{error}</p>
          )}
          <Button type="submit" className="w-full sm:col-span-2" disabled={loading}>
            {loading ? "Creating..." : "Register"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-emerald-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
