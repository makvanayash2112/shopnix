"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buyerFetch } from "@/lib/buyer-api";
import { Card } from "@/components/ui/Card";

interface ReturnPolicy {
  windowDays: number;
  title: string;
  summary: string;
  rules: string[];
}

export default function ReturnsPolicyPage() {
  const [policy, setPolicy] = useState<ReturnPolicy | null>(null);

  useEffect(() => {
    buyerFetch<ReturnPolicy>("/return-policy").then(setPolicy);
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-sm text-indigo-600 hover:underline">
        ← Back to shop
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">
        {policy?.title ?? "Return policy"}
      </h1>
      <p className="mt-4 text-lg text-slate-600">
        {policy?.summary ??
          "Returns accepted within 7 days of delivery for eligible orders."}
      </p>

      <Card className="mt-8">
        <h2 className="font-semibold text-slate-900">How it works</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700">
          <li>Place your order and pay cash on delivery when it arrives.</li>
          <li>Track status: Confirmed → Packed → Out for delivery → Delivered.</li>
          <li>
            Cancel anytime before <strong>Out for delivery</strong> — not after.
          </li>
          <li>
            After delivery, open <strong>My orders</strong> and request a return
            within {policy?.windowDays ?? 7} days.
          </li>
          <li>Seller approves return; refund processed as per store policy.</li>
        </ol>
      </Card>

      {policy?.rules && (
        <Card className="mt-6" title="Rules">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            {policy.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
