import type { Response } from "express";
import { buildAckResponse } from "./beckn";
import { logOndcBpp } from "./ondc-debug";

/**
 * On Vercel/serverless the process stops after the HTTP response is sent.
 * Run Beckn callback work (on_search, on_select, …) BEFORE sending ACK.
 */
// REPLACE entire ackAfterWork:
export async function ackAfterWork(
  res: Response,
  label: string,
  arg3: import("./beckn").BecknContext | undefined | (() => Promise<void>),
  arg4?: () => Promise<void>
): Promise<void> {
  const context = typeof arg3 === "function" ? undefined : arg3;
  const work = typeof arg3 === "function" ? arg3 : arg4!;
  const start = Date.now();
  // Send ACK immediately for Vercel (before work, to avoid timeout)
  res.status(200).json(buildAckResponse(context));
  try {
    await work();
    logOndcBpp(`${label} callback work done`, { ms: Date.now() - start });
  } catch (err) {
    logOndcBpp(`${label} callback work ERROR`, {
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - start,
    });
  }
}

