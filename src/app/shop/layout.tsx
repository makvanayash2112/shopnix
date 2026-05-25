import { redirect } from "next/navigation";

// DISABLED: Buyer functionality is not supported in this version
// All buyer-side code is commented out - seller-only mode
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Redirect all shop/buyer routes to admin
  redirect("/admin");
}
