import { put } from "@vercel/blob";
import path from "path";
import fs from "fs";
import { getSiteUrl } from "./site-url";

const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export class ImageStorageError extends Error {
  code: "BLOB_REQUIRED" | "NO_FILE" | "INVALID_URL";

  constructor(
    message: string,
    code: "BLOB_REQUIRED" | "NO_FILE" | "INVALID_URL" = "BLOB_REQUIRED"
  ) {
    super(message);
    this.name = "ImageStorageError";
    this.code = code;
  }
}

export function getImageStorageStatus() {
  const onVercel = Boolean(process.env.VERCEL);
  return {
    mode: useBlob ? "vercel-blob" : onVercel ? "urls-only" : "local-disk",
    blobConfigured: useBlob,
    onVercel,
    publicBaseUrl: getSiteUrl(),
    hint: useBlob
      ? "File uploads are stored on Vercel Blob."
      : onVercel
        ? "Add BLOB_READ_WRITE_TOKEN in Vercel, or paste HTTPS image URLs when adding products."
        : "Files are saved under public/uploads/products on this server.",
  };
}

export function isVercelStorage(): boolean {
  return useBlob || Boolean(process.env.VERCEL);
}

function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Parse image URLs from form body (JSON array or comma/newline separated). */
export function parseImageUrlsFromBody(raw?: string): string[] {
  if (!raw?.trim()) return [];
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  } catch {
    /* plain list */
  }
  return trimmed
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function validatePublicImageUrls(urls: string[]): string[] {
  const valid: string[] = [];
  for (const url of urls) {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new ImageStorageError(
        `Invalid image URL: ${url}. Use a full http(s) link.`,
        "INVALID_URL"
      );
    }
    if (process.env.VERCEL && !isHttpsUrl(url) && !url.includes("localhost")) {
      throw new ImageStorageError(
        "On production, image URLs must use HTTPS (e.g. https://your-cdn.com/image.jpg).",
        "INVALID_URL"
      );
    }
    valid.push(url);
  }
  return valid;
}

export async function saveProductImage(
  file: Express.Multer.File
): Promise<string> {
  if (!file?.buffer?.length && !file?.path) {
    throw new ImageStorageError("Empty image file.", "NO_FILE");
  }

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

  if (process.env.VERCEL) {
    throw new ImageStorageError(
      "Image upload requires BLOB_READ_WRITE_TOKEN on Vercel. Add it under Storage → Blob, or paste HTTPS image URLs in the product form.",
      "BLOB_REQUIRED"
    );
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
