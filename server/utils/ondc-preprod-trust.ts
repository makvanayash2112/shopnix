import type { Request } from "express";
import { logOndcBpp } from "./ondc-debug";

/** Preprod network participants that send search to BPPs (Pramaan, GCR, gateway) */
const TRUSTED_GATEWAY_SUBSCRIBERS = new Set([
  "preprod.gateway.proteantech.in",
  "pre-prod.gcr.ondc.org",
  "staging.gateway.proteantech.in",
]);

const TRUSTED_BAP_IDS = new Set([
  "pramaan.ondc.org/beta/preprod/mock/buyer",
  "pramaan.ondc.org/beta/staging/mock/buyer",
  "qa-gcr.ondc.org",
]);

function parseKeyIdSubscriber(authHeader?: string): string | null {
  if (!authHeader) return null;
  const m = authHeader.match(/keyId="([^"]+)"/);
  if (!m) return null;
  return m[1].split("|")[0] || null;
}

export function isPreprodTrustSearchEnabled(): boolean {
  if (process.env.ONDC_PREPROD_TRUST_SEARCH === "false") return false;
  if (process.env.ONDC_PREPROD_TRUST_SEARCH === "true") return true;
  // Default: trust on Vercel preprod deploys until registry v2 lookup works
  return Boolean(process.env.VERCEL);
}

/**
 * Accept Pramaan / GCR / gateway search when registry lookup is blocked (1010/403).
 * Shopnix keys are valid on portal but not yet authorized for registry v2 /lookup.
 */
export function isPreprodTrustedSearch(req: Request): boolean {
  if (!isPreprodTrustSearchEnabled()) return false;

  const body = req.body as {
    context?: { action?: string; bap_id?: string };
  };
  if (body?.context?.action !== "search") return false;

  const gatewayAuth = (req.headers["x-gateway-authorization"] ||
    req.headers["X-Gateway-Authorization"]) as string | undefined;
  const authHeader = (req.headers.authorization ||
    req.headers["authorization"]) as string | undefined;

  const gatewaySub = parseKeyIdSubscriber(gatewayAuth);
  const authSub = parseKeyIdSubscriber(authHeader);
  const bapId = body.context?.bap_id;

  const trusted =
    (gatewaySub && TRUSTED_GATEWAY_SUBSCRIBERS.has(gatewaySub)) ||
    (authSub && TRUSTED_GATEWAY_SUBSCRIBERS.has(authSub)) ||
    (authSub && TRUSTED_BAP_IDS.has(authSub)) ||
    (bapId && TRUSTED_BAP_IDS.has(bapId));

  if (trusted) {
    logOndcBpp("PREPROD trusted search", {
      gatewaySub,
      authSub,
      bapId,
      note: "Registry v2 lookup unavailable (1010) — accepting search for Pramaan/GCR",
    });
  }

  return Boolean(trusted);
}
