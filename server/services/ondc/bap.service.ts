import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { env } from "../../config/env";
import { OndcLog } from "../../models/OndcLog";
import type { BecknContext } from "../../utils/beckn";
import { replyContext } from "../../utils/beckn";
import { createAuthorizationHeader } from "../../utils/ondc-crypto";

export interface BapCatalogCache {
  transactionId: string;
  catalog: Record<string, unknown>;
  fetchedAt: Date;
}

const catalogCache = new Map<string, BapCatalogCache>();

export function cacheOnSearch(
  transactionId: string,
  message: Record<string, unknown>
) {
  catalogCache.set(transactionId, {
    transactionId,
    catalog: message,
    fetchedAt: new Date(),
  });
}

export function getCachedCatalog(transactionId: string) {
  return catalogCache.get(transactionId)?.catalog;
}

export async function sendToBpp(
  action: string,
  message: Record<string, unknown>,
  bppUri?: string
) {
  const bpp = (bppUri || env.ondc.bppUri).replace(/\/$/, "");
  const url = `${bpp}/${action}`;
  const transactionId = uuidv4();

  const context: BecknContext = {
    domain: env.ondc.domain,
    country: env.ondc.country,
    city: env.ondc.city,
    action,
    core_version: "1.2.0",
    bap_id: env.ondc.bapId,
    bap_uri: env.ondc.bapUri,
    bpp_id: env.ondc.bppId,
    bpp_uri: bpp,
    transaction_id: transactionId,
    message_id: uuidv4(),
    timestamp: new Date().toISOString(),
    ttl: "PT30S",
  };

  const payload = { context, message };

  await OndcLog.create({
    action,
    transactionId,
    direction: "outgoing",
    payload: payload as unknown as Record<string, unknown>,
  }).catch(() => undefined);

  try {
    // const authHeader = await createAuthorizationHeader(payload);
    const res = await axios.post(url, payload, {
      headers: { 
        "Content-Type": "application/json",
        // ...(authHeader ? { Authorization: authHeader } : {})
      },
      timeout: 15000,
    });
    return { transactionId, ack: res.data };
  } catch (err) {
    console.error(`[bap] Failed POST ${url}`, err);
    throw err;
  }
}

export function buildBapAck() {
  return { message: { ack: { status: "ACK" as const } } };
}

export function bapReplyContext(
  incoming: BecknContext,
  action: string
): BecknContext {
  return replyContext(
    {
      ...incoming,
      bap_id: incoming.bap_id || env.ondc.bapId,
      bap_uri: incoming.bap_uri || env.ondc.bapUri,
    },
    action
  );
}
