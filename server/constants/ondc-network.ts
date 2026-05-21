import { env } from "../config/env";
import { getSiteUrl } from "../lib/site-url";

export const BPP_ENDPOINTS = [
  { method: "POST", path: "/ondc/search", callback: "on_search", desc: "Receive search, return catalog async" },
  { method: "POST", path: "/ondc/select", callback: "on_select", desc: "Item selection / quote" },
  { method: "POST", path: "/ondc/init", callback: "on_init", desc: "Start order" },
  { method: "POST", path: "/ondc/confirm", callback: "on_confirm", desc: "Confirm order" },
  { method: "POST", path: "/ondc/status", callback: "on_status", desc: "Order status query" },
  { method: "POST", path: "/ondc/cancel", callback: "on_cancel", desc: "Cancel order" },
  { method: "POST", path: "/ondc/update", callback: "on_update", desc: "Order update" },
  { method: "POST", path: "/ondc/track", callback: "on_track", desc: "Tracking" },
  { method: "POST", path: "/ondc/support", callback: "on_support", desc: "Support info" },
  { method: "GET", path: "/ondc", callback: "-", desc: "BPP health check" },
];

export const BAP_ENDPOINTS = [
  { method: "POST", path: "/ondc-bap/on_search", callback: "-", desc: "Receive catalog from seller" },
  { method: "POST", path: "/ondc-bap/on_select", callback: "-", desc: "Receive quote" },
  { method: "POST", path: "/ondc-bap/on_init", callback: "-", desc: "Receive init response" },
  { method: "POST", path: "/ondc-bap/on_confirm", callback: "-", desc: "Order confirmed" },
  { method: "POST", path: "/ondc-bap/on_status", callback: "-", desc: "Status updates" },
  { method: "POST", path: "/ondc-bap/on_cancel", callback: "-", desc: "Cancellation" },
  { method: "POST", path: "/ondc-bap/on_track", callback: "-", desc: "Tracking" },
  { method: "GET", path: "/ondc-bap", callback: "-", desc: "BAP health check" },
];

export const REGISTRATION_STEPS = [
  {
    step: 1,
    title: "Public HTTPS URL",
    detail: "Use ngrok (dev) or production domain. Update API_BASE_URL, ONDC_BPP_URI, ONDC_BAP_URI in .env",
  },
  {
    step: 2,
    title: "ONDC Portal signup",
    detail: "https://portal.ondc.org — complete profile 100%, request staging access",
  },
  {
    step: 3,
    title: "Generate Ed25519 keys",
    detail: "Signing key pair + site verification HTML on your domain",
  },
  {
    step: 4,
    title: "Register BPP (Seller)",
    detail: "Subscriber ID = ONDC_BPP_ID, URL = .../ondc, domain ONDC:RET10",
  },
  {
    step: 5,
    title: "Register BAP (Buyer)",
    detail: "Subscriber ID = ONDC_BAP_ID, URL = .../ondc-bap, same domain/city",
  },
  {
    step: 6,
    title: "Shopnix admin config",
    detail: "Admin → ONDC: save BPP settings; publish products with stock",
  },
  {
    step: 7,
    title: "Pramaan testing",
    detail: "https://pramaan.ondc.org — run search to confirm end-to-end flows",
  },
  {
    step: 8,
    title: "Pre-prod → Production",
    detail: "Complete portal checklist, switch to production keys and URLs",
  },
];

export function getNetworkGuide() {
  const base = getSiteUrl();

  return {
    project: "Shopnix",
    roles: ["BPP (Seller)", "BAP (Buyer)"],
    paymentNote: "Cash on delivery (COD) only in Shopnix — no payment gateway",
    portalUrl: "https://portal.ondc.org",
    pramaanUrl: "https://pramaan.ondc.org",
    docsUrl: "https://github.com/ONDC-Official/developer-docs",
    config: {
      bppId: env.ondc.bppId,
      bppUri: env.ondc.bppUri,
      bapId: env.ondc.bapId,
      bapUri: env.ondc.bapUri,
      domain: env.ondc.domain,
      city: env.ondc.city,
      country: env.ondc.country,
      hasSigningKey: Boolean(env.ondc.signingPrivateKey),
      subscriberId: env.ondc.subscriberId || "(not set)",
    },
    publicEndpoints: {
      bppHealth: `${base}/ondc`,
      bapHealth: `${base}/ondc-bap`,
      guide: `${base}/api/ondc/guide`,
      bppEndpoints: BPP_ENDPOINTS.map((e) => ({
        ...e,
        fullUrl: `${base}${e.path}`,
      })),
      bapEndpoints: BAP_ENDPOINTS.map((e) => ({
        ...e,
        fullUrl: `${base}${e.path}`,
      })),
      buyerDiscover: `${base}/api/buyer/ondc/discover`,
    },
    registrationSteps: REGISTRATION_STEPS,
    bppEndpoints: BPP_ENDPOINTS,
    bapEndpoints: BAP_ENDPOINTS,
  };
}
