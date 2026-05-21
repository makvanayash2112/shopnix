import mongoose from "mongoose";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __shopnixDb: { connected: boolean } | undefined;
}

export async function connectDatabase(): Promise<void> {
  if (global.__shopnixDb?.connected) return;

  await mongoose.connect(env.mongodbUri);
  global.__shopnixDb = { connected: true };
  console.log("[db] MongoDB connected");
}
