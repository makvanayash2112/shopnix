"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { StorageBanner } from "@/components/admin/StorageBanner";
import type { OndcReadiness, Seller } from "@/types";

export default function SettingsPage() {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [readiness, setReadiness] = useState<OndcReadiness | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function refresh() {
    apiFetch<Seller>("/seller/profile").then(setSeller).catch(console.error);
    apiFetch<OndcReadiness>("/seller/ondc-readiness").then(setReadiness).catch(console.error);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const fd = new FormData(e.currentTarget);

    try {
      const updated = await apiFetch<Seller>("/seller/profile", {
        method: "PUT",
        body: JSON.stringify({
          storeName: fd.get("storeName"),
          storeDescription: fd.get("storeDescription"),
          gstin: fd.get("gstin"),
          phone: fd.get("phone"),
          email: fd.get("email"),
          address: {
            street: fd.get("street"),
            city: fd.get("city"),
            state: fd.get("state"),
            pincode: fd.get("pincode"),
          },
          fulfillment: {
            type: fd.get("fulfillmentType"),
            radiusKm: Number(fd.get("radiusKm")),
          },
          ondc: {
            isActive: fd.get("ondcActive") === "on",
          },
        }),
      });
      setSeller(updated);
      setMessage("Profile saved.");
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  if (!seller) return <p className="text-slate-500">Loading profile…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Store profile</h1>
        <p className="text-slate-500">
          Details used for ONDC provider location and fulfillment
        </p>
      </div>

      <Card className="bg-slate-50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{seller.storeName}</h2>
            <p className="text-sm text-slate-600">{seller.email}</p>
            {seller.phone && (
              <p className="text-sm text-slate-600">{seller.phone}</p>
            )}
            <p className="mt-2 font-mono text-xs text-slate-500">
              ONDC provider: {seller.ondcProviderId || readiness?.providerId}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-slate-700">ONDC network</p>
            <p className="text-emerald-700">
              {seller.ondc?.isActive !== false ? "Listed" : "Paused"}
            </p>
            <Link
              href="/admin/ondc"
              className="mt-2 inline-block text-emerald-600 hover:underline"
            >
              ONDC console →
            </Link>
          </div>
        </div>
      </Card>

      <StorageBanner />

      {readiness && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">ONDC readiness</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                readiness.ready
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-100 text-amber-900"
              }`}
            >
              {readiness.ready ? "Ready" : "Incomplete"}
            </span>
          </div>
          <p className="mb-3 mt-2 text-sm text-slate-600">
            Provider ID:{" "}
            <code className="text-xs">{readiness.providerId}</code>
            {readiness.publishedCount != null && (
              <> · Published products: {readiness.publishedCount}</>
            )}
          </p>
          <ul className="space-y-1 text-sm">
            {readiness.checks?.map((c) => (
              <li key={c.id} className={c.ok ? "text-emerald-700" : "text-amber-700"}>
                {c.ok ? "✓" : "○"} {c.label}
                {!c.ok && c.hint && (
                  <span className="block text-xs text-slate-500">{c.hint}</span>
                )}
              </li>
            ))}
          </ul>
          {readiness.networkNote && (
            <p className="mt-3 text-xs text-slate-500">{readiness.networkNote}</p>
          )}
          <Link
            href="/admin/products"
            className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
          >
            Manage products →
          </Link>
        </Card>
      )}

      <Card title="Edit profile">
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Store name"
            name="storeName"
            defaultValue={seller.storeName}
            required
          />
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">
              Description
            </span>
            <textarea
              name="storeDescription"
              rows={3}
              defaultValue={seller.storeDescription}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <Input label="GSTIN" name="gstin" defaultValue={seller.gstin} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" name="phone" defaultValue={seller.phone} required />
            <Input
              label="Email"
              name="email"
              type="email"
              defaultValue={seller.email}
            />
          </div>
          <Input
            label="Street"
            name="street"
            defaultValue={seller.address?.street}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="City" name="city" defaultValue={seller.address?.city} />
            <Input
              label="State"
              name="state"
              defaultValue={seller.address?.state}
            />
            <Input
              label="Pincode"
              name="pincode"
              defaultValue={seller.address?.pincode}
            />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">
                Fulfillment type
              </span>
              <select
                name="fulfillmentType"
                defaultValue={seller.fulfillment?.type ?? "Delivery"}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="Delivery">Delivery</option>
                <option value="Pickup">Pickup</option>
                <option value="Delivery and Pickup">Delivery and Pickup</option>
              </select>
            </label>
            <Input
              label="Service radius (km)"
              name="radiusKm"
              type="number"
              defaultValue={seller.fulfillment?.radiusKm ?? 5}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="ondcActive"
              defaultChecked={seller.ondc?.isActive !== false}
              className="rounded border-slate-300 text-emerald-600"
            />
            List my store on ONDC network catalog
          </label>
          {message && (
            <p
              className={`text-sm ${message.includes("saved") ? "text-emerald-600" : "text-red-600"}`}
            >
              {message}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
