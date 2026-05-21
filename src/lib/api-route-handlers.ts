import type { NextRequest } from "next/server";

async function handle(req: NextRequest) {
  try {
    const { runExpress } = await import("./express-bridge");
    return await runExpress(req);
  } catch (err) {
    console.error("[api-route]", err);
    return Response.json(
      {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : "Server error — check MONGODB_URI on Vercel",
      },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
