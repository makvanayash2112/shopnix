# Vercel environment variables (shopnix-nine.vercel.app)

## Required on Vercel

| Variable | Example |
|----------|---------|
| `MONGODB_URI` | `mongodb+srv://USER:PASS@cluster.mongodb.net/shopnix?retryWrites=true&w=majority` |
| `JWT_SECRET` | long random string (not `shopnix-dev-secret-change-me`) |
| `JWT_EXPIRES_IN` | `7d` |
| `BLOB_READ_WRITE_TOKEN` | from Vercel → Storage → Blob |
| `ONDC_BPP_ID` | `shopnix-bpp.shopnix-nine.vercel.app` |
| `ONDC_BPP_URI` | `https://shopnix-nine.vercel.app/ondc` |
| `ONDC_BAP_ID` | `shopnix-bap.shopnix-nine.vercel.app` |
| `ONDC_BAP_URI` | `https://shopnix-nine.vercel.app/ondc-bap` |
| `ONDC_DOMAIN` | `ONDC:RET10` |
| `ONDC_CITY` | `std:080` |
| `ONDC_COUNTRY` | `IND` |

## Optional

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://shopnix-nine.vercel.app` |
| `DEFAULT_STORE_NAME` | `Shopnix Store` |
| `DEFAULT_STORE_EMAIL` | `admin@shopnix.local` |

## Do NOT set on Vercel

| Variable | Why |
|----------|-----|
| `API_BASE_URL` | Leave unset — Vercel sets `VERCEL_URL` automatically |
| `NEXT_PUBLIC_API_URL` | Leave unset — browser uses same origin `/api/...` |
| `API_PORT` | Local dev only |

## After deploy — test

- `https://shopnix-nine.vercel.app/api/health` → JSON `{"status":"ok"}`
- `https://shopnix-nine.vercel.app/api/buyer/products?category=grocery`

If you see HTML "This page couldn't load", redeploy after pushing the `backend/handler.ts` fix.
