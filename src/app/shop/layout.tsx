import { CartProvider } from "@/lib/cart";
import { BuyerAuthProvider } from "@/lib/buyer-auth";
import { ShopHeader } from "@/components/shop/ShopHeader";
import { ShopFooter } from "@/components/shop/ShopFooter";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <BuyerAuthProvider>
      <CartProvider>
        <div className="flex min-h-screen flex-col bg-slate-50">
          <ShopHeader />
          <div className="flex-1">{children}</div>
          <ShopFooter />
        </div>
      </CartProvider>
    </BuyerAuthProvider>
  );
}
