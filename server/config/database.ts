import mongoose from "mongoose";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __shopnixDb: { connected: boolean } | undefined;
}

export async function connectDatabase(): Promise<void> {
  if (global.__shopnixDb?.connected && mongoose.connection.readyState === 1) {
    return;
  }

  if (!env.mongodbUri || env.mongodbUri.includes("127.0.0.1")) {
    if (process.env.VERCEL) {
      throw new Error(
        "MONGODB_URI is missing or still set to localhost. Add Atlas URI in Vercel Environment Variables."
      );
    }
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.mongodbUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });
  }

  global.__shopnixDb = { connected: true };
  console.log("[db] MongoDB connected");
}
