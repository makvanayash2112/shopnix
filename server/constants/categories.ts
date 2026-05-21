export interface CategoryDef {
  slug: string;
  name: string;
  icon: string;
}

export const PRODUCT_CATEGORIES: CategoryDef[] = [
  { slug: "electronics", name: "Electronics", icon: "⚡" },
  { slug: "grocery", name: "Grocery", icon: "🛒" },
  { slug: "fashion", name: "Fashion & Apparel", icon: "👕" },
  { slug: "home-kitchen", name: "Home & Kitchen", icon: "🏠" },
  { slug: "beauty", name: "Beauty & Personal Care", icon: "✨" },
  { slug: "health", name: "Health & Wellness", icon: "💊" },
  { slug: "sports", name: "Sports & Fitness", icon: "🏃" },
  { slug: "books", name: "Books & Stationery", icon: "📚" },
  { slug: "toys", name: "Toys & Baby", icon: "🧸" },
  { slug: "automotive", name: "Automotive", icon: "🚗" },
  { slug: "appliances", name: "Appliances", icon: "🔌" },
  { slug: "other", name: "Other", icon: "📦" },
];

export function getCategoryBySlug(slug: string): CategoryDef | undefined {
  return PRODUCT_CATEGORIES.find((c) => c.slug === slug);
}

export function normalizeCategory(input?: string): string {
  if (!input) return "grocery";
  const slug = input.toLowerCase().trim().replace(/\s+/g, "-");
  const found = PRODUCT_CATEGORIES.find(
    (c) => c.slug === slug || c.name.toLowerCase() === input.toLowerCase()
  );
  return found?.slug ?? (slug || "other");
}
