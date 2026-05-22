import { put } from "@vercel/blob";
import path from "path";
import fs from "fs";
import { getSiteUrl } from "./site-url";

const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export function isVercelStorage(): boolean {
  return useBlob || Boolean(process.env.VERCEL);
}

export async function saveProductImage(
  file: Express.Multer.File
): Promise<string> {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = path.extname(file.originalname) || ".jpg";
  const filename = `${unique}${ext}`;

  if (useBlob && file.buffer) {
    const blob = await put(`products/${filename}`, file.buffer, {
      access: "public",
      contentType: file.mimetype,
    });
    return blob.url;
  }

  // Vercel serverless functions have a read-only filesystem. 
  // If no blob token is provided, return a placeholder instead of crashing.
  if (process.env.VERCEL) {
    console.warn("Vercel environment detected but no BLOB_READ_WRITE_TOKEN provided. Returning dummy image URL.");
    return `https://placehold.co/600x400/png?text=Product`;
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const dest = path.join(uploadDir, filename);
  if (file.buffer) {
    fs.writeFileSync(dest, file.buffer);
  } else if (file.path) {
    fs.copyFileSync(file.path, dest);
  }

  return `${getSiteUrl()}/uploads/products/${filename}`;
}
