import dotenv from "dotenv";
import path from "path";
import { getSiteUrl } from "../lib/site-url";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const siteUrl = getSiteUrl();

export const env = {
  port: Number(process.env.API_PORT) || 4000,
  apiBaseUrl: siteUrl,
  mongodbUri:
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/shopnix_ondc",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  ondc: {
    bppId: process.env.ONDC_BPP_ID || "shopnix-bpp.local",
    bppUri: process.env.ONDC_BPP_URI || `${siteUrl}/ondc`,
    bapId: process.env.ONDC_BAP_ID || "shopnix-bap.local",
    bapUri: process.env.ONDC_BAP_URI || `${siteUrl}/ondc-bap`,
    domain: process.env.ONDC_DOMAIN || "ONDC:RET10",
    city: process.env.ONDC_CITY || "std:080",
    country: process.env.ONDC_COUNTRY || "IND",
    signingPrivateKey: process.env.ONDC_SIGNING_PRIVATE_KEY || "",
    subscriberId: process.env.ONDC_SUBSCRIBER_ID || "",
  },
  defaultStoreName: process.env.DEFAULT_STORE_NAME || "Shopnix Store",
  defaultStoreGstin: process.env.DEFAULT_STORE_GSTIN || "",
  defaultStoreEmail: process.env.DEFAULT_STORE_EMAIL || "admin@shopnix.local",
};
