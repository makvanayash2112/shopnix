# Deploy Shopnix on Vercel (Frontend + API + ONDC same domain)

Example production URL: `https://shopnix.vercel.app`  
Everything runs on **one domain**:

| Path | Purpose |
|------|---------|
| `/` | Next.js frontend (buyer shop + seller admin) |
| `/api/*` | REST API (auth, products, orders) |
| `/ondc/*` | ONDC Seller (BPP) |
| `/ondc-bap/*` | ONDC Buyer (BAP) |
| `/uploads/*` | Product images (local dev; use Blob on Vercel) |

**How it works on Vercel:** Next.js serves the UI and API via App Router routes (`src/app/api`, `src/app/ondc`, etc.) that run your Express app. Do not add a `functions` block for `backend/handler.ts` — that path is not used with the Next.js framework.

**Local dev:** `npm run dev` runs Express on port `4000` and Next on `3000`; Next rewrites proxy API/ONDC paths to Express.

---

## Step 1 — MongoDB Atlas

1. Create free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Database user + password.
3. Network access: **Allow access from anywhere** (`0.0.0.0/0`) for Vercel serverless.
4. Copy connection string:
   ```
   mongodb+srv://USER:PASS@cluster.mongodb.net/shopnix?retryWrites=true&w=majority
   ```

---

## Step 2 — Vercel Blob (product images)

Vercel serverless cannot store files on disk permanently.

1. Vercel project → **Storage** → **Create Blob store**.
2. Connect to project → copy `BLOB_READ_WRITE_TOKEN`.

Without Blob, image upload on Vercel will fail — Blob is required for production images.

---

## Step 3 — Push code to GitHub

```bash
git add .
git commit -m "Vercel deployment"
git push origin main
```

---

## Step 4 — Import on Vercel

1. [vercel.com](https://vercel.com) → **Add New Project**.
2. Import your GitHub repo `shopnix`.
3. Framework: **Next.js** (auto-detected).
4. Root directory: `.`
5. Build command: `npm run build` (uses `next build --webpack` — required for this stack).
6. Output: default (do not override).

---

## Step 5 — Environment variables (Vercel → Settings → Environment Variables)

Add for **Production**, **Preview**, and **Development**:

| Variable | Example | Required |
|----------|---------|----------|
| `MONGODB_URI` | `mongodb+srv://...` | Yes |
| `JWT_SECRET` | long random string | Yes |
| `JWT_EXPIRES_IN` | `7d` | Yes |
| `BLOB_READ_WRITE_TOKEN` | from Vercel Blob | Yes (images) |
| `ADMIN_EMAIL` | `admin@shopnix.com` | Yes |
| `ADMIN_PASSWORD` | your password | For seed only |
| `ONDC_BPP_ID` | `shopnix-bpp.yourdomain.com` | ONDC |
| `ONDC_BPP_URI` | `https://YOUR.vercel.app/ondc` | ONDC |
| `ONDC_BAP_ID` | `shopnix-bap.yourdomain.com` | ONDC |
| `ONDC_BAP_URI` | `https://YOUR.vercel.app/ondc-bap` | ONDC |
| `ONDC_DOMAIN` | `ONDC:RET10` | ONDC |
| `ONDC_CITY` | `std:080` | ONDC |
| `ONDC_COUNTRY` | `IND` | ONDC |
| `ONDC_SIGNING_PRIVATE_KEY` | (from ONDC key gen) | Staging/prod |
| `ONDC_SUBSCRIBER_ID` | portal subscriber id | ONDC |

**Do NOT set** `API_BASE_URL` or `NEXT_PUBLIC_API_URL` on Vercel — leave empty so the app uses **same origin** (`/api/...`).

Optional after first deploy:

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` |

`VERCEL_URL` is set automatically by Vercel.

---

## Step 6 — Deploy

Click **Deploy**. Wait for build to finish.

Test URLs (replace `YOUR` with your Vercel URL):

- Shop: `https://YOUR.vercel.app/shop`
- Admin: `https://YOUR.vercel.app/login`
- API health: `https://YOUR.vercel.app/api/health`
- BPP: `https://YOUR.vercel.app/ondc`
- BAP: `https://YOUR.vercel.app/ondc-bap`
- ONDC guide: `https://YOUR.vercel.app/api/ondc/guide`

---

## Step 7 — Seed admin & products (one time)

From your **local machine** with production `MONGODB_URI` in `.env`:

```bash
npm run seed:admin
npm run seed:products
```

Or use MongoDB Compass to verify users/products.

---

## Step 8 — Connect ONDC (same Vercel domain)

Use **exact** URLs in [portal.ondc.org](https://portal.ondc.org):

**Seller BPP**

- Subscriber URL: `https://YOUR.vercel.app/ondc`
- Register all BPP endpoints under that base (see Admin → ONDC)

**Buyer BAP**

- Subscriber URL: `https://YOUR.vercel.app/ondc-bap`
- Register all BAP `on_*` callback paths

Test on [pramaan.ondc.org](https://pramaan.ondc.org).

Full ONDC checklist: `docs/ONDC_REGISTRATION.md`

---

## Step 9 — Custom domain (optional)

1. Vercel → **Domains** → add `api.yourdomain.com` or `shop.yourdomain.com`.
2. Update ONDC portal URIs to custom domain.
3. Set in Vercel env (optional):
   ```
   NEXT_PUBLIC_APP_URL=https://shop.yourdomain.com
   ONDC_BPP_URI=https://shop.yourdomain.com/ondc
   ONDC_BAP_URI=https://shop.yourdomain.com/ondc-bap
   ```

---

## Local development

```bash
# Copy env
cp .env.example .env

# Local MongoDB + optional Blob token
npm run dev
```

Opens **http://localhost:3000** — API and ONDC run through Next.js (same as Vercel).

Legacy two-port mode (optional):

```bash
npm run dev:legacy
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| API 404 on Vercel | Check `pages/api/[[...path]].ts` exists; redeploy |
| ONDC 404 | Use `/ondc` not `/api/ondc` in portal (both work; portal should use `/ondc`) |
| Image upload fails | Add `BLOB_READ_WRITE_TOKEN` |
| MongoDB timeout | Whitelist `0.0.0.0/0` in Atlas |
| Orders not in admin | Run `npm run fix:orders` with production URI |
| Build fails | Run `npm run build` locally first |

---

## Architecture on Vercel

```
Browser → https://your-app.vercel.app/shop
       → https://your-app.vercel.app/api/...  → Express (serverless)
       → https://your-app.vercel.app/ondc/... → Express (serverless)
Images → Vercel Blob CDN URLs
DB     → MongoDB Atlas
```
