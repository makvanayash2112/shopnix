"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { Seller } from "@/types";

export default function SettingsPage() {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<Seller>("/seller/profile").then(setSeller).catch(console.error);
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
        }),
      });
      setSeller(updated);
      setMessage("Settings saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  if (!seller) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Store settings</h1>
      <Card>
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
          <Input label="Phone" name="phone" defaultValue={seller.phone} />
          <Input
            label="Email"
            name="email"
            type="email"
            defaultValue={seller.email}
          />
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
          {message && (
            <p
              className={`text-sm ${message.includes("saved") ? "text-emerald-600" : "text-red-600"}`}
            >
              {message}
            </p>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "Saving…" : "Save settings"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
