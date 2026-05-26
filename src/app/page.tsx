import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-emerald-950 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-emerald-400">
            Shopnix ONDC
          </p>
          <h1 className="text-xl font-bold">Seller Network Platform</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              Seller login
            </Button>
          </Link>
          <Link href="/register">
            <Button className="bg-emerald-500 hover:bg-emerald-600">
              Register seller
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-bold leading-tight sm:text-5xl">
            Sell on ONDC — automated product sync & order management
          </h2>
          <p className="mt-6 text-lg text-slate-300">
            Join the ONDC Marketplace as a Seller Node (MSN). Create your seller account, add products, and automatically list them across the ONDC network. Your inventory is exposed through the seller BPP with Cash on Delivery support.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/admin">
              <Button className="bg-emerald-500 px-6 py-3 text-base hover:bg-emerald-600">
                Go to seller dashboard
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="secondary" className="px-6 py-3 text-base">
                Create seller account
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Seller dashboard",
              desc: "Manage products, orders, and store profile. Track ONDC MSN listings in real-time.",
              href: "/admin",
            },
            {
              title: "Product catalog",
              desc: "Add, edit, and publish products to ONDC network. Sync inventory automatically.",
              href: "/admin/products",
            },
            {
              title: "Order management",
              desc: "View and manage ONDC orders. Complete fulfillment workflows.",
              href: "/admin/orders",
            },
          ].map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:bg-white/10"
            >
              <h3 className="font-semibold text-emerald-300">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
