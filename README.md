# Shopnix ONDC Seller App

This is a seller-only ONDC Marketplace Seller Node (MSN/BPP). There is no buyer storefront and no BAP app in this project. Sellers register, complete store details, upload products, publish stock, and receive ONDC orders through the Beckn retail seller flow.

## Project Structure

```text
src/app                  Next.js pages and route handlers
src/components/admin     Seller/admin UI
src/components/ui        Shared UI controls
src/lib                  Frontend API and route bridge helpers
src/types                Frontend TypeScript types
server/app.ts            Express app mounted by Next.js
server/config            Environment and database setup
server/models            MongoDB models
server/routes            REST and ONDC routes
server/services          ONDC catalog/order and seller services
server/middleware        Auth, upload, ONDC signature middleware
server/utils             Beckn, ONDC crypto, registry and response helpers
server/scripts           One script: seed-superadmin.ts
public/uploads/products  Local product image folder for own hosting
```

## Required Environment

For local development copy `.env.example` to `.env`.

```env
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/shopnix
JWT_SECRET=change-this-to-a-long-random-secret
JWT_EXPIRES_IN=7d

SUPERADMIN_EMAIL=admin@shopnix.com
SUPERADMIN_PASSWORD=Shopnix@Admin2026
SUPERADMIN_NAME=Shopnix Superadmin

API_BASE_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com

ONDC_BPP_ID=your-domain.com
ONDC_BPP_URI=https://your-domain.com/ondc
ONDC_SUBSCRIBER_ID=your-domain.com
ONDC_UNIQUE_KEY_ID=
ONDC_SIGNING_PRIVATE_KEY=
ONDC_SIGNING_PUBLIC_KEY=
ONDC_DOMAIN=ONDC:RET10
ONDC_CITY=std:080
ONDC_COUNTRY=IND
ONDC_MSN_CATALOG=true
```

For Vercel image uploads, also add:

```env
BLOB_READ_WRITE_TOKEN=
```

## Fresh Database Setup

1. Clear your MongoDB database.
2. Set the environment variables above.
3. Run:

```bash
npm run seed:superadmin
```

This creates only one superadmin user. It does not create sellers or products.

4. Open `/login` and sign in as the superadmin.
5. Add real sellers through `/register` or by creating seller users from your admin process.
6. Each seller logs in, completes store profile, adds products, uploads images, and publishes products.

## Seller Requirements

Each seller must have:

- owner name
- email and password
- store name
- phone
- street, city, state and pincode
- GSTIN or PAN

A product appears in ONDC catalog only when:

- seller is active
- product is published
- stock is above 0
- at least one product image exists

## Image Uploads

MongoDB stores only image filenames.

Own server:

- file is saved in `public/uploads/products/{filename}`
- public URL is `/uploads/products/{filename}`
- make sure the server can write to `public/uploads/products`

Vercel:

- file is uploaded to Vercel Blob as `products/{filename}`
- MongoDB still stores only `{filename}`
- `/uploads/products/{filename}` redirects to the Blob URL
- `BLOB_READ_WRITE_TOKEN` is required in Vercel environment variables

## ONDC Seller Flow

Seller-side BPP endpoints are under `/ondc`:

- `POST /ondc/search` -> `on_search`
- `POST /ondc/select` -> `on_select`
- `POST /ondc/init` -> `on_init`
- `POST /ondc/confirm` -> `on_confirm`
- `POST /ondc/status` -> `on_status`
- `POST /ondc/cancel` -> `on_cancel`
- `POST /ondc/update` -> `on_update`
- `POST /ondc/track` -> `on_track`
- `POST /ondc/support` -> `on_support`

Implemented production behavior:

- `search` returns active sellers and published in-stock products.
- `select` validates provider, item IDs, stock and selected quantity.
- `init` creates an idempotent order per transaction.
- `confirm` accepts COD order and reserves inventory.
- seller status updates send `on_status` callback.
- delivered COD orders are marked paid.

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run seed:superadmin
```

## Vercel Checklist

1. Add MongoDB Atlas `MONGODB_URI`.
2. Add `JWT_SECRET`.
3. Add all `ONDC_*` values from ONDC portal.
4. Add `BLOB_READ_WRITE_TOKEN` for product images.
5. Set `API_BASE_URL` and `NEXT_PUBLIC_APP_URL` to your Vercel or custom domain.
6. Register only the seller BPP URL in ONDC portal: `https://your-domain.com/ondc`.
7. After deployment, test:

```text
GET /api/health
GET /ondc
GET /ondc/test-catalog?mode=pramaan
GET /uploads/products/{filename}
```
