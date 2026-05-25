/** RET10 category_id + serviceability category (must align per ONDC v1.2.0 checks). */
const CATEGORY_MAP: Record<
  string,
  { categoryId: string; serviceabilityCategory: string }
> = {
  grocery: { categoryId: "Grocery", serviceabilityCategory: "Grocery" },
  "fruits-vegetables": {
    categoryId: "Fruits and Vegetables",
    serviceabilityCategory: "Fruits and Vegetables",
  },
  beauty: { categoryId: "Grocery", serviceabilityCategory: "Grocery" },
  electronics: { categoryId: "Grocery", serviceabilityCategory: "Grocery" },
  fashion: { categoryId: "Grocery", serviceabilityCategory: "Grocery" },
  books: { categoryId: "Grocery", serviceabilityCategory: "Grocery" },
  health: { categoryId: "Grocery", serviceabilityCategory: "Grocery" },
  sports: { categoryId: "Grocery", serviceabilityCategory: "Grocery" },
  "home-kitchen": { categoryId: "Grocery", serviceabilityCategory: "Grocery" },
};

export function mapOndcCategory(slug: string) {
  return (
    CATEGORY_MAP[slug] ?? {
      categoryId: "Grocery",
      serviceabilityCategory: "Grocery",
    }
  );
}

/** ONDC v1.2.0: in-stock items use available count 99 (not raw inventory). */
export function ondcAvailableCount(quantity: number): string {
  return quantity > 0 ? "99" : "0";
}

const LOCAL_HOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

/** Rewrite seeded localhost URLs to the public Vercel/site base. */
export function resolvePublicImageUrl(url: string, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  if (!url) return `${base}/uploads/products/placeholder.png`;
  if (LOCAL_HOST_RE.test(url)) {
    const path = url.replace(LOCAL_HOST_RE, "");
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }
  if (url.startsWith("http")) return url;
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}
