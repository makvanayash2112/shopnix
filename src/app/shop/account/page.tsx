"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBuyerAuth } from "@/lib/buyer-auth";
import { buyerAuthFetch } from "@/lib/buyer-api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { BuyerUser } from "@/types";

export default function BuyerAccountPage() {
  const router = useRouter();
  const { user, loading, isLoggedIn, refresh } = useBuyerAuth();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.replace("/shop/login?redirect=/shop/account");
    }
  }, [loading, isLoggedIn, router]);

  if (loading || !user) {
    return <main className="p-16 text-center text-slate-500">Loading…</main>;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const fd = new FormData(e.currentTarget);
    try {
      await buyerAuthFetch<BuyerUser>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: fd.get("name"),
          phone: fd.get("phone"),
          address: {
            street: fd.get("street"),
            city: fd.get("city"),
            state: fd.get("state"),
            pincode: fd.get("pincode"),
          },
        }),
      });
      await refresh();
      setMessage("Profile saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold">My account</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your details are used for orders and delivery
      </p>

      <Card className="mt-6">
        <dl className="mb-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Member since</dt>
            <dd>
              {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : "—"}
            </dd>
          </div>
        </dl>

        <form onSubmit={onSubmit} className="space-y-4 border-t pt-6">
          <Input label="Full name" name="name" defaultValue={user.name} required />
          <Input label="Phone" name="phone" type="tel" defaultValue={user.phone} required />
          <Input
            label="Street"
            name="street"
            defaultValue={user.address?.street}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="City" name="city" defaultValue={user.address?.city} />
            <Input label="State" name="state" defaultValue={user.address?.state} />
            <Input
              label="Pincode"
              name="pincode"
              defaultValue={user.address?.pincode}
            />
          </div>
          {message && (
            <p
              className={`text-sm ${message.includes("saved") ? "text-emerald-600" : "text-red-600"}`}
            >
              {message}
            </p>
          )}
          <Button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
