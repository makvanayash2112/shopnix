import { env } from "../config/env";
import { getSiteUrl } from "../lib/site-url";

export const BPP_ENDPOINTS = [
  {
    method: "POST",
    path: "/ondc/search",
    callback: "on_search",
    desc: "Receive search and return catalog asynchronously",
  },
  {
    method: "POST",
    path: "/ondc/select",
    callback: "on_select",
    desc: "Return quote for selected provider items",
  },
  {
    method: "POST",
    path: "/ondc/init",
    callback: "on_init",
    desc: "Create draft ONDC order",
  },
  {
    method: "POST",
    path: "/ondc/confirm",
    callback: "on_confirm",
    desc: "Confirm COD order",
  },
  {
    method: "POST",
    path: "/ondc/status",
    callback: "on_status",
    desc: "Return seller order status",
  },
  {
    method: "POST",
    path: "/ondc/cancel",
    callback: "on_cancel",
    desc: "Cancel order",
  },
  {
    method: "POST",
    path: "/ondc/update",
    callback: "on_update",
    desc: "Order update",
  },
  {
    method: "POST",
    path: "/ondc/track",
    callback: "on_track",
    desc: "Tracking status",
  },
  {
    method: "POST",
    path: "/ondc/support",
    callback: "on_support",
    desc: "Seller support info",
  },
  { method: "GET", path: "/ondc", callback: "-", desc: "BPP health check" },
];

export const REGISTRATION_STEPS = [
  {
    step: 1,
    title: "Public HTTPS URL",
    detail:
      "Use ngrok for development or your production domain. Set API_BASE_URL and ONDC_BPP_URI.",
  },
  {
    step: 2,
    title: "ONDC portal signup",
    detail: "Complete the seller NP profile on https://portal.ondc.org.",
  },
  {
    step: 3,
    title: "Generate Ed25519 keys",
    detail: "Add signing keys and site verification HTML for your domain.",
  },
  {
    step: 4,
    title: "Register seller BPP/MSN",
    detail: "Subscriber URL is https://your-domain/ondc for ONDC:RET10.",
  },
  {
    step: 5,
    title: "Seller onboarding",
    detail:
      "Each seller registers with store details, phone, address and GSTIN or PAN.",
  },
  {
    step: 6,
    title: "Publish catalog",
    detail:
      "Sellers add products with stock and images. Active sellers appear as ONDC providers.",
  },
  {
    step: 7,
    title: "Pramaan testing",
    detail: "Run search, select, init and confirm against your /ondc endpoint.",
  },
];

export function getNetworkGuide() {
  const base = getSiteUrl();

  return {
    project: "Shopnix",
    roles: ["BPP/MSN Seller Node"],
    paymentNote:
      "Cash on delivery (COD) only in Shopnix; no payment gateway is enabled.",
    portalUrl: "https://portal.ondc.org",
    pramaanUrl: "https://pramaan.ondc.org",
    docsUrl: "https://github.com/ONDC-Official/developer-docs",
    config: {
      bppId: env.ondc.bppId,
      bppUri: env.ondc.bppUri,
      domain: env.ondc.domain,
      city: env.ondc.city,
      country: env.ondc.country,
      hasSigningKey: Boolean(env.ondc.signingPrivateKey),
      subscriberId: env.ondc.subscriberId || "(not set)",
    },
    publicEndpoints: {
      bppHealth: `${base}/ondc`,
      guide: `${base}/api/ondc/guide`,
      bppEndpoints: BPP_ENDPOINTS.map((e) => ({
        ...e,
        fullUrl: `${base}${e.path}`,
      })),
    },
    registrationSteps: REGISTRATION_STEPS,
    bppEndpoints: BPP_ENDPOINTS,
  };
}
