export interface User {
  id: string;
  name: string;
  email: string;
  role: "superadmin" | "seller";
  sellerId?: string;
}

export interface Category {
  slug: string;
  name: string;
  icon: string;
}

export interface Seller {
  _id: string;
  storeName: string;
  storeDescription?: string;
  gstin?: string;
  pan?: string;
  email: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  ondc: {
    bppId: string;
    bppUri: string;
    domain: string;
    city: string;
    isActive: boolean;
    subscriberId?: string;
  };
  fulfillment?: {
    type: string;
    radiusKm?: number;
  };
  ondcProviderId?: string;
}

export interface ImageStorageStatus {
  mode: "vercel-blob" | "urls-only" | "local-disk";
  blobConfigured: boolean;
  onVercel: boolean;
  publicBaseUrl: string;
  hint: string;
}

export interface OndcReadiness {
  ready: boolean;
  providerId?: string;
  publishedCount?: number;
  checks?: { id: string; label: string; ok: boolean; hint?: string }[];
  networkNote?: string;
}

export interface Product {
  _id: string;
  sellerId?: string | Seller;
  name: string;
  description?: string;
  category: string;
  categorySlug?: string;
  brand?: string;
  sku: string;
  price: number;
  mrp?: number;
  quantity: number;
  unit: string;
  images: string[];
  isPublished: boolean;
  ondcItemId: string;
  tags?: string[];
  createdAt: string;
}

export interface Order {
  _id: string;
  orderId: string;
  transactionId: string;
  channel?: "ondc";
  status: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    ondcItemId: string;
  }[];
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    // address?: Record<string, string>;
    address?: {
      name?: string;
      building?: string;
      locality?: string;
      city?: string;
      state?: string;
      country?: string;
      area_code?: string;
      gps?: string;
    };
  };
  payment: {
    method?: string;
    amount: number;
    status?: string;
    type?: string;
  };
  fulfillment?: { type?: string; state?: string; tracking?: string };
  deliveredAt?: string;
  returnInfo?: {
    reason?: string;
    requestedAt?: string;
    approvedAt?: string;
    completedAt?: string;
    status?: string;
    sellerNote?: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface OrderTrackResponse {
  orderId: string;
  status: string;
  legacyStatus?: string;
  payment: Order["payment"];
  fulfillment?: Order["fulfillment"];
  items: Order["items"];
  customer?: Order["customer"];
  createdAt: string;
  updatedAt: string;
  canCancel: boolean;
  canReturn: boolean;
  returnMessage?: string;
  returnDeadline?: string | null;
  returnInfo?: Order["returnInfo"];
  deliveredAt?: string;
  returnPolicy?: {
    windowDays: number;
    title: string;
    summary: string;
    rules: string[];
  };
}

export interface DashboardStats {
  productCount: number;
  publishedCount: number;
  orderCount: number;
  pendingOrders: number;
  revenue: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}
