import axios from "axios";
import { OndcLog } from "../../models/OndcLog";
import type { BecknContext } from "../../utils/beckn";
import { callbackUrl } from "../../utils/beckn";
import { createAuthorizationHeader } from "../../utils/ondc-crypto";

export async function postToBap(
  context: BecknContext,
  action: string,
  message: Record<string, unknown>
) {
  const url = callbackUrl(context.bap_uri, action);
  const payload = { context, message };

  await OndcLog.create({
    action,
    transactionId: context.transaction_id,
    direction: "outgoing",
    payload,
  }).catch(() => undefined);

  try {
    const authHeader = await createAuthorizationHeader(payload);
    
    await axios.post(url, payload, {
      headers: { 
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      timeout: 15000,
    });
  } catch (err) {
    console.error(`[ondc] Failed POST ${url}`, err);
  }
}
