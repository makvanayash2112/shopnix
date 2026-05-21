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
          <h1 className="text-xl font-bold">Buyer + Seller Platform</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/shop">
            <Button className="bg-indigo-500 hover:bg-indigo-600">
              Buyer shop
            </Button>
          </Link>
          <Link href="/shop/login">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              Buyer login
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" className="text-white hover:bg-white/10">
              Seller login
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-bold leading-tight sm:text-5xl">
            Buy & sell on ONDC — cash delivery, full catalog
          </h2>
          <p className="mt-6 text-lg text-slate-300">
            Buyers browse electronics, grocery, fashion and more. Sellers manage
            products, orders, and ONDC BPP/BAP from one project. Payment is cash
            on delivery only.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/shop">
              <Button className="bg-indigo-500 px-6 py-3 text-base hover:bg-indigo-600">
                Open buyer store
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="secondary" className="px-6 py-3 text-base">
                Seller admin
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="ghost" className="text-white hover:bg-white/10">
                Register as seller
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Buyer storefront",
              desc: "Categories, multi-image products, cart, COD checkout.",
              href: "/shop",
            },
            {
              title: "Seller admin",
              desc: "Products, orders, store & ONDC BPP settings.",
              href: "/admin",
            },
            {
              title: "ONDC ready",
              desc: "BPP seller APIs + BAP buyer network hooks.",
              href: "/admin/ondc",
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
