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
  // Also enable by default in development environments
  const enabled = Boolean(process.env.VERCEL) || process.env.NODE_ENV !== "production";
  logOndcBpp("isPreprodTrustSearchEnabled", {
    enabled,
    vercel: Boolean(process.env.VERCEL),
    nodeEnv: process.env.NODE_ENV,
  });
  return enabled;
}

/**
 * Accept Pramaan / GCR / gateway requests when registry lookup is blocked (1010/403).
 * Shopnix keys are valid on portal but not yet authorized for registry v2 /lookup.
 * Now supports all Beckn actions (search, select, init, confirm, status, track, cancel, etc)
 */
export function isPreprodTrustedSearch(req: Request): boolean {
  const enabledCheck = isPreprodTrustSearchEnabled();
  
  const body = req.body as {
    context?: { action?: string; bap_id?: string };
  };
  const action = body?.context?.action;
  
  logOndcBpp("isPreprodTrustedSearch check", {
    enabled: enabledCheck,
    action,
    hasBapId: Boolean(body?.context?.bap_id),
    bapId: body?.context?.bap_id,
  });

  if (!enabledCheck) {
    logOndcBpp("isPreprodTrustedSearch: preprod trust disabled");
    return false;
  }

  // Support all Beckn actions from trusted sources (not just 'search')
  // Valid actions: search, select, init, confirm, status, track, cancel, update, rating, support
  if (!action) {
    logOndcBpp("isPreprodTrustedSearch: no action found");
    return false;
  }

  const gatewayAuth = (req.headers["x-gateway-authorization"] ||
    req.headers["X-Gateway-Authorization"]) as string | undefined;
  const authHeader = (req.headers.authorization ||
    req.headers["authorization"]) as string | undefined;

  const gatewaySub = parseKeyIdSubscriber(gatewayAuth);
  const authSub = parseKeyIdSubscriber(authHeader);
  const bapId = body.context?.bap_id;

  logOndcBpp("isPreprodTrustedSearch sources", {
    gatewaySub,
    authSub,
    bapId,
    gatewayAuthPresent: Boolean(gatewayAuth),
    authHeaderPresent: Boolean(authHeader),
  });

  const trusted =
    (gatewaySub && TRUSTED_GATEWAY_SUBSCRIBERS.has(gatewaySub)) ||
    (authSub && TRUSTED_GATEWAY_SUBSCRIBERS.has(authSub)) ||
    (authSub && TRUSTED_BAP_IDS.has(authSub)) ||
    (bapId && TRUSTED_BAP_IDS.has(bapId));

  if (trusted) {
    logOndcBpp(`PREPROD trusted ${action}`, {
      gatewaySub,
      authSub,
      bapId,
      note: "Registry v2 lookup unavailable (1010) — accepting request for Pramaan/GCR",
    });
  } else {
    logOndcBpp(`isPreprodTrustedSearch: no match for ${action}`, {
      gatewaySub,
      authSub,
      bapId,
      trustedGateways: Array.from(TRUSTED_GATEWAY_SUBSCRIBERS),
      trustedBaps: Array.from(TRUSTED_BAP_IDS),
    });
  }

  return Boolean(trusted);
}
