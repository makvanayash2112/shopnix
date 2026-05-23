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
  try {
    const url = callbackUrl(context.bap_uri, action);

    const payload = {
      context,
      message,
    };

    await OndcLog.create({
      action,
      transactionId: context.transaction_id,
      direction: "outgoing",
      payload,
    }).catch(() => undefined);

    const body =
      JSON.stringify(payload);

    const authHeader =
      await createAuthorizationHeader(body);

    console.log(`[ONDC] Sending ${action} → ${url}`);

    const response = await axios.post(
      url,
      body,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        timeout: 60000,
      }
    );

    console.log(`[ONDC] ${action} success`, response.status);

    return response.data;
  } catch (err: any) {
    console.error(
      `[ONDC] ${action} failed`,
      err?.response?.data || err.message
    );
  }
}