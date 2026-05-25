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
const PLACEHOLDER_RE =
  /placehold\.co|placeholder\.png|\/uploads\/products\/placeholder/i;

/** Stable public image for ONDC (Vercel has no local uploads in prod). */
export function ondcFallbackImageUrl(seed: string): string {
  const s = seed.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 40);
  return `https://picsum.photos/seed/shopnix-${s}/800/800`;
}

export function isInvalidOndcImageUrl(url: string, baseUrl: string): boolean {
  if (!url?.startsWith("http")) return true;
  if (PLACEHOLDER_RE.test(url)) return true;
  if (LOCAL_HOST_RE.test(url)) return true;
  const base = baseUrl.replace(/\/$/, "");
  if (url.startsWith(`${base}/uploads/`)) return true;
  return false;
}

/** Rewrite localhost / placeholders / missing Vercel uploads to HTTPS picsum. */
export function resolvePublicImageUrl(
  url: string,
  baseUrl: string,
  seed = "product"
): string {
  if (!url || isInvalidOndcImageUrl(url, baseUrl)) {
    return ondcFallbackImageUrl(seed);
  }
  if (LOCAL_HOST_RE.test(url)) {
    return ondcFallbackImageUrl(seed);
  }
  if (url.startsWith("http")) return url;
  const base = baseUrl.replace(/\/$/, "");
  const resolved = `${base}${url.startsWith("/") ? url : `/${url}`}`;
  if (isInvalidOndcImageUrl(resolved, baseUrl)) {
    return ondcFallbackImageUrl(seed);
  }
  return resolved;
}

export function normalizeOndcUnit(unit?: string): string {
  const u = (unit || "unit").toLowerCase();
  const allowed = [
    "unit",
    "dozen",
    "gram",
    "kilogram",
    "tonne",
    "litre",
    "millilitre",
  ] as const;
  if ((allowed as readonly string[]).includes(u)) return u;
  if (u === "kg" || u === "kilogram") return "kilogram";
  if (u === "l" || u === "liter" || u === "litre") return "litre";
  if (u === "ml") return "millilitre";
  if (u === "g" || u === "gram") return "gram";
  return "unit";
}
