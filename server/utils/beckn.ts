import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env";

export interface BecknContext {
  domain: string;
  country: string;
  city: string;
  action: string;
  core_version?: string;
  bap_id: string;
  bap_uri: string;
  bpp_id?: string;
  bpp_uri?: string;
  transaction_id: string;
  message_id: string;
  timestamp: string;
  ttl?: string;
}

export function buildAckResponse() {
  return {
    message: {
      ack: { status: "ACK" as const },
    },
  };
}

export function buildNackResponse(error?: { type?: string; code?: string; message?: string }) {
  return {
    message: {
      ack: { status: "NACK" as const },
    },
    error: error ?? { message: "Invalid request" },
  };
}

export type ReplyContextOptions = {
  /** Pramaan / ONDC v1.2.0: on_search must reuse search message_id */
  preserveMessageId?: boolean;
};

export function replyContext(
  incoming: BecknContext,
  action: string,
  options?: ReplyContextOptions
): BecknContext {
  const pairedAction = action.startsWith("on_") ? action.slice(3) : null;
  const preserveMessageId =
    options?.preserveMessageId ??
    (pairedAction !== null && incoming.action === pairedAction);

  return {
    domain: incoming.domain || env.ondc.domain,
    country: incoming.country || env.ondc.country,
    city: incoming.city || env.ondc.city,
    action,
    core_version: incoming.core_version || "1.2.0",
    bap_id: incoming.bap_id,
    bap_uri: incoming.bap_uri,
    bpp_id: incoming.bpp_id || env.ondc.bppId,
    bpp_uri: incoming.bpp_uri || env.ondc.bppUri,
    transaction_id: incoming.transaction_id,
    message_id: preserveMessageId ? incoming.message_id : uuidv4(),
    timestamp: new Date().toISOString(),
    ttl: incoming.ttl || "PT30S",
  };
}


export function callbackUrl(
  bapUri: string,
  action: string
): string {

  const base =
    bapUri.replace(/\/$/, "");

  return `${base}/${action}`;
}