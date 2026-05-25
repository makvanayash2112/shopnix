import type { Response } from "express";
import { buildAckResponse } from "./beckn";
import { logOndcBpp } from "./ondc-debug";

/**
 * On Vercel/serverless the process stops after the HTTP response is sent.
 * Run Beckn callback work (on_search, on_select, …) BEFORE sending ACK.
 */
export async function ackAfterWork(
  res: Response,
  label: string,
  work: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await work();
    logOndcBpp(`${label} callback work done`, { ms: Date.now() - start });
  } catch (err) {
    logOndcBpp(`${label} callback work ERROR`, err);
  }
  res.status(200).json(buildAckResponse());
}
