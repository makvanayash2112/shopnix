import { head } from "@vercel/blob";
import { NextResponse, type NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const params = await ctx.params;
  const parts = params.path ?? [];
  const safeParts = parts.filter((part) => !part.includes(".."));
  const relativePath = safeParts.join("/");

  if (!relativePath.startsWith("products/")) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await head(relativePath);
      return NextResponse.redirect(blob.url, 302);
    } catch {
      return NextResponse.json({ message: "Image not found" }, { status: 404 });
    }
  }

  const filePath = path.join(process.cwd(), "public", "uploads", relativePath);
  const root = path.join(process.cwd(), "public", "uploads", "products");
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(root))) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  try {
    const file = await fs.readFile(resolved);
    return new NextResponse(file, {
      headers: {
        "Content-Type":
          CONTENT_TYPES[path.extname(resolved).toLowerCase()] ||
          "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ message: "Image not found" }, { status: 404 });
  }
}
