import Link from "next/link";

export function ShopFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-8">
      <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-6 px-4 text-sm text-slate-600 sm:px-6">
        <Link href="/shop/ondc" className="hover:text-indigo-600">
          ONDC Buyer (BAP)
        </Link>
        <Link href="/shop/returns-policy" className="hover:text-indigo-600">
          Return policy (7 days)
        </Link>
        <Link href="/shop/categories" className="hover:text-indigo-600">
          Categories
        </Link>
        <Link href="/shop/login" className="hover:text-indigo-600">
          Buyer login
        </Link>
      </div>
    </footer>
  );
}
