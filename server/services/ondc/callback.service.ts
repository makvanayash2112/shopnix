import axios from "axios";
import { OndcLog } from "../../models/OndcLog";
import type { BecknContext } from "../../utils/beckn";
import { callbackUrl } from "../../utils/beckn";
import { createAuthorizationHeader } from "../../utils/ondc-crypto";
import { logOndcBpp } from "../../utils/ondc-debug";

export async function postToBap(
  context: BecknContext,
  action: string,
  message: Record<string, unknown>
) {
  const url = callbackUrl(context.bap_uri, action);

  const payload = { context, message };
  const body = JSON.stringify(payload);

  try {
    await OndcLog.create({
      action,
      transactionId: context.transaction_id,
      direction: "outgoing",
      payload,
    }).catch(() => undefined);

    logOndcBpp(`outgoing ${action}`, {
      url,
      bap_id: context.bap_id,
      bap_uri: context.bap_uri,
      transaction_id: context.transaction_id,
      message_id: context.message_id,
      bodyLength: body.length,
    });

    const authHeader = await createAuthorizationHeader(body);

    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      timeout: 60000,
      transformRequest: [(data) => data],
    });

    const data = response.data as {
      message?: { ack?: { status?: string } };
      error?: unknown;
    };
    const ackStatus = data?.message?.ack?.status;
    if (ackStatus !== "ACK" || data.error) {
      logOndcBpp(`${action} protocol response`, {
        status: response.status,
        ack: ackStatus,
        error: data.error,
        body: data,
      });
    } else {
      logOndcBpp(`${action} success`, {
        status: response.status,
        ack: ackStatus,
      });
    }
    return response.data;
  } catch (err: unknown) {
    const ax = err as {
      response?: { status?: number; data?: unknown };
      message?: string;
    };
    logOndcBpp(`${action} FAILED`, {
      url,
      status: ax.response?.status,
      data: ax.response?.data,
      message: ax.message,
    });
    return null;
  }
}
