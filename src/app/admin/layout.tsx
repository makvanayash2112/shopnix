"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { apiFetch, getToken } from "@/lib/api";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<{ role: string }>("/auth/me").catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200 bg-white px-8 py-4">
          <p className="text-sm text-slate-500">Seller workspace</p>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
