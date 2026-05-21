"use client";

import { useEffect, useState } from "react";
import { apiFetch, API_URL } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { Seller } from "@/types";

interface OndcLog {
  _id: string;
  action: string;
  transactionId: string;
  direction: string;
  createdAt: string;
}

interface NetworkGuide {
  config: {
    bppId: string;
    bppUri: string;
    bapId: string;
    bapUri: string;
    domain: string;
    city: string;
    hasSigningKey: boolean;
    subscriberId: string;
  };
  portalUrl: string;
  pramaanUrl: string;
  docsUrl: string;
  registrationSteps: { step: number; title: string; detail: string }[];
  publicEndpoints: {
    bppHealth: string;
    bapHealth: string;
    bppEndpoints: { method: string; path: string; fullUrl: string; desc: string }[];
    bapEndpoints: { method: string; path: string; fullUrl: string; desc: string }[];
  };
}

export default function OndcPage() {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [guide, setGuide] = useState<NetworkGuide | null>(null);
  const [logs, setLogs] = useState<OndcLog[]>([]);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"bpp" | "bap" | "steps">("steps");

  useEffect(() => {
    apiFetch<Seller>("/seller/profile").then(setSeller).catch(console.error);
    fetch(`${API_URL || ""}/api/ondc/guide`)
      .then((r) => r.json())
      .then((j) => setGuide(j.data))
      .catch(console.error);
    fetch(`${API_URL || ""}/api/ondc/logs`)
      .then((r) => r.json())
      .then((j) => setLogs(j.data || []))
      .catch(console.error);
  }, []);

  async function saveOndc(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const fd = new FormData(e.currentTarget);
    try {
      const updated = await apiFetch<Seller>("/seller/profile", {
        method: "PUT",
        body: JSON.stringify({
          ondc: {
            bppId: fd.get("bppId"),
            bppUri: fd.get("bppUri"),
            domain: fd.get("domain"),
            city: fd.get("city"),
            isActive: fd.get("isActive") === "on",
            subscriberId: fd.get("subscriberId"),
          },
        }),
      });
      setSeller(updated);
      setMessage("Seller BPP configuration saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!seller) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">ONDC — Seller + Buyer</h1>
        <p className="text-slate-500">
          Register <strong>BPP</strong> (seller) and <strong>BAP</strong> (buyer) on{" "}
          <a href="https://portal.ondc.org" className="text-emerald-600 hover:underline" target="_blank" rel="noreferrer">
            portal.ondc.org
          </a>
          . Full guide: <code className="text-xs">docs/ONDC_REGISTRATION.md</code> in project.
        </p>
      </div>

      <div className="flex gap-2 border-b">
        {(["steps", "bpp", "bap"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? "border-b-2 border-emerald-600 text-emerald-700"
                : "text-slate-500"
            }`}
          >
            {t === "steps" ? "How to register" : t === "bpp" ? "Seller (BPP)" : "Buyer (BAP)"}
          </button>
        ))}
      </div>

      {tab === "steps" && guide && (
        <Card title="ONDC marketplace onboarding checklist">
          <ol className="space-y-4">
            {guide.registrationSteps.map((s) => (
              <li key={s.step} className="flex gap-3 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">
                  {s.step}
                </span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-slate-600">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <a href={guide.portalUrl} target="_blank" rel="noreferrer" className="font-medium text-emerald-600">
              ONDC Portal →
            </a>
            <a href={guide.pramaanUrl} target="_blank" rel="noreferrer" className="font-medium text-emerald-600">
              Pramaan sandbox →
            </a>
            <a href={guide.docsUrl} target="_blank" rel="noreferrer" className="text-slate-500">
              Developer docs →
            </a>
          </div>
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Vercel:</strong> use <code>https://your-app.vercel.app/ondc</code> and{" "}
            <code>/ondc-bap</code> in ONDC portal. See <code>docs/VERCEL_DEPLOY.md</code>.
          </p>
        </Card>
      )}

      {tab === "bpp" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="BPP configuration (Seller)">
            <form onSubmit={saveOndc} className="space-y-4">
              <Input label="BPP ID (subscriber_id)" name="bppId" defaultValue={seller.ondc.bppId} required />
              <Input label="BPP URI" name="bppUri" defaultValue={seller.ondc.bppUri} required />
              <Input label="Domain" name="domain" defaultValue={seller.ondc.domain} />
              <Input label="City code" name="city" defaultValue={seller.ondc.city} />
              <Input label="Subscriber ID" name="subscriberId" defaultValue={seller.ondc.subscriberId} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked={seller.ondc.isActive} />
                BPP active
              </label>
              {message && <p className="text-sm text-emerald-600">{message}</p>}
              <Button type="submit">Save BPP config</Button>
            </form>
          </Card>
          <Card title="BPP endpoints (register on portal)">
            <ul className="max-h-96 space-y-2 overflow-y-auto font-mono text-xs">
              {guide?.publicEndpoints.bppEndpoints.map((e) => (
                <li key={e.path} className="rounded bg-slate-50 p-2">
                  {e.method} {e.fullUrl}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Health: {guide?.publicEndpoints.bppHealth}
            </p>
          </Card>
        </div>
      )}

      {tab === "bap" && guide && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="BAP identity (Buyer app)">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">BAP ID</dt>
                <dd className="font-mono text-xs">{guide.config.bapId}</dd>
              </div>
              <div>
                <dt className="text-slate-500">BAP URI</dt>
                <dd className="font-mono text-xs break-all">{guide.config.bapUri}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Signing key in .env</dt>
                <dd>{guide.config.hasSigningKey ? "✅ Set" : "❌ Add ONDC_SIGNING_PRIVATE_KEY"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-slate-600">
              Buyer UI: <a href="/shop/ondc" className="text-indigo-600">/shop/ondc</a>
            </p>
          </Card>
          <Card title="BAP callback URLs">
            <ul className="max-h-96 space-y-2 overflow-y-auto font-mono text-xs">
              {guide.publicEndpoints.bapEndpoints.map((e) => (
                <li key={e.path} className="rounded bg-slate-50 p-2">
                  {e.method} {e.fullUrl}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Health: {guide.publicEndpoints.bapHealth}
            </p>
          </Card>
        </div>
      )}

      <Card title="Recent ONDC transaction logs">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No ONDC traffic yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2">Action</th>
                <th className="py-2">Dir</th>
                <th className="py-2">Transaction</th>
                <th className="py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-b border-slate-100">
                  <td className="py-2">{log.action}</td>
                  <td className="py-2">{log.direction}</td>
                  <td className="py-2 font-mono text-xs">{log.transactionId.slice(0, 14)}…</td>
                  <td className="py-2">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
