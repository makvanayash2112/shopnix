"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buyerFetch, buyerAuthFetch } from "@/lib/buyer-api";
import { useBuyerAuth } from "@/lib/buyer-auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface OndcInfo {
  role: string;
  bapId: string;
  bapUri: string;
  bppUri: string;
  portalUrl: string;
  pramaanUrl: string;
  note: string;
  registrationSteps: { step: number; title: string; detail: string }[];
  bapEndpoints: { method: string; path: string; fullUrl?: string; desc: string }[];
}

export default function BuyerOndcPage() {
  const { isLoggedIn } = useBuyerAuth();
  const [info, setInfo] = useState<OndcInfo | null>(null);
  const [discoverResult, setDiscoverResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    buyerFetch<OndcInfo>("/ondc/info").then(setInfo);
  }, []);

  async function testOwnStore() {
    setLoading(true);
    setDiscoverResult("");
    try {
      const fn = isLoggedIn ? buyerAuthFetch : buyerFetch;
      const res = await fn<{ transactionId: string }>("/ondc/discover-shopnix", {
        method: "POST",
        body: JSON.stringify({}),
      }) as { transactionId: string };
      setDiscoverResult(
        `Search sent. Transaction: ${res.transactionId}. Check seller BPP logs in admin.`
      );
    } catch (err) {
      setDiscoverResult(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm text-indigo-600 hover:underline">
        ← Back to shop
      </Link>
      <h1 className="mt-4 text-3xl font-bold">ONDC Buyer (BAP)</h1>
      <p className="mt-2 text-slate-600">
        Connect Shopnix as a <strong>buyer app</strong> on the ONDC open network — separate
        from browsing this store directly.
      </p>

      {info && (
        <>
          <Card className="mt-8" title="Your BAP identity (register on ONDC portal)">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">BAP ID</dt>
                <dd className="font-mono text-xs">{info.bapId}</dd>
              </div>
              <div>
                <dt className="text-slate-500">BAP URI</dt>
                <dd className="font-mono text-xs break-all">{info.bapUri}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Linked seller BPP (your store)</dt>
                <dd className="font-mono text-xs break-all">{info.bppUri}</dd>
              </div>
            </dl>
          </Card>

          <Card className="mt-6" title="Registration steps">
            <ol className="space-y-4">
              {info.registrationSteps.map((s) => (
                <li key={s.step} className="flex gap-3 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    {s.step}
                  </span>
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-slate-600">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={info.portalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                ONDC Portal →
              </a>
              <a
                href={info.pramaanUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                Pramaan testing →
              </a>
              <span className="text-sm text-slate-500">
                Full guide: <code>docs/ONDC_REGISTRATION.md</code> in your project folder
              </span>
            </div>
          </Card>

          <Card className="mt-6" title="BAP callback URLs (register these)">
            <ul className="space-y-2 font-mono text-xs text-slate-700">
              {info.bapEndpoints.map((e) => (
                <li key={e.path} className="rounded bg-slate-50 p-2">
                  {e.method} {e.fullUrl ?? e.path}
                  <span className="block font-sans text-slate-500">{e.desc}</span>
                </li>
              ))}
            </ul>
          </Card>

          {isLoggedIn && (
            <Card className="mt-6" title="Test: search your Shopnix seller on ONDC">
              <p className="text-sm text-slate-600">
                Sends Beckn search from BAP to your BPP (requires public HTTPS API).
              </p>
              <Button
                className="mt-4 bg-indigo-600 hover:bg-indigo-700"
                disabled={loading}
                onClick={testOwnStore}
              >
                {loading ? "Sending…" : "Test BAP → BPP search"}
              </Button>
              {discoverResult && (
                <p className="mt-3 text-sm text-slate-700">{discoverResult}</p>
              )}
            </Card>
          )}
        </>
      )}
    </main>
  );
}
