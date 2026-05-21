import { Suspense } from "react";

export default function OrderSuccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<div className="p-16 text-center">Loading…</div>}>{children}</Suspense>;
}
