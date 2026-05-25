import { NextResponse } from "next/server";

/**
 * ONDC portal checks: https://{subscriber_id}/ondc-site-verification.html
 * Set ONDC_SITE_VERIFICATION_SIGNED in Vercel (signed request_id from portal keys).
 */
export async function GET() {
  const signed =
    process.env.ONDC_SITE_VERIFICATION_SIGNED ||
    "REPLACE_WITH_SIGNED_REQUEST_ID_FROM_ONDC_UTILITY";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="ondc-site-verification" content="${signed}" />
  <title>ONDC Site Verification — Shopnix</title>
</head>
<body>ONDC Site Verification Page</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
