"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearToken } from "@/lib/api";

const links = [
  { href: "/admin", label: "Dashboard", icon: "◉" },
  { href: "/shop", label: "View buyer shop", icon: "🛍" },
  { href: "/admin/products", label: "Products", icon: "▣" },
  { href: "/admin/orders", label: "Orders", icon: "◎" },
  { href: "/admin/settings", label: "Store Settings", icon: "⚙" },
  { href: "/admin/ondc", label: "ONDC", icon: "⇄" },
];

export function Sidebar() {
  const pathname = usePathname() ?? "";

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 px-5 py-6">
        <p className="text-xs uppercase tracking-widest text-emerald-400">
          Shopnix
        </p>
        <h1 className="mt-1 text-lg font-bold">Seller Admin</h1>
        <p className="text-xs text-slate-400">ONDC BPP Console</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {links.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/admin" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-emerald-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-base opacity-80">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button
          type="button"
          onClick={() => {
            clearToken();
            window.location.href = "/login";
          }}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
