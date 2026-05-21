import type { NextConfig } from "next";

const apiPort = process.env.API_PORT || "4000";
const localApi = `http://127.0.0.1:${apiPort}`;

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.VERCEL) return [];
    return [
      { source: "/api/:path*", destination: `${localApi}/api/:path*` },
      { source: "/ondc", destination: `${localApi}/ondc` },
      { source: "/ondc/:path*", destination: `${localApi}/ondc/:path*` },
      { source: "/ondc-bap", destination: `${localApi}/ondc-bap` },
      { source: "/ondc-bap/:path*", destination: `${localApi}/ondc-bap/:path*` },
      { source: "/uploads/:path*", destination: `${localApi}/uploads/:path*` },
    ];
  },
  devIndicators: false,
  serverExternalPackages: [
    "mongoose",
    "mongodb",
    "express",
    "multer",
    "bcryptjs",
    "jsonwebtoken",
    "serverless-http",
    "cors",
    "dotenv",
    "@vercel/blob",
  ],
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", pathname: "/**" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
      { protocol: "https", hostname: "picsum.photos", pathname: "/**" },
    ],
  },
};

export default nextConfig;
