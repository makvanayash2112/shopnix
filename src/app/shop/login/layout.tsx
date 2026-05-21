import { Suspense } from "react";

export default function BuyerLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<div className="p-16 text-center">Loading…</div>}>{children}</Suspense>;
}
