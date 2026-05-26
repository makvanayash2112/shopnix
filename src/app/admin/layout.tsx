"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/admin/Sidebar";
import { apiFetch, getToken } from "@/lib/api";
import type { User } from "@/types";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch<User>("/auth/me")
      .then(setUser)
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-200 bg-white px-8 py-4">
          <p className="text-sm text-slate-500">
            {user
              ? user.role === "superadmin"
                ? "Superadmin marketplace view"
                : "Seller workspace"
              : "Loading workspace"}
          </p>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
