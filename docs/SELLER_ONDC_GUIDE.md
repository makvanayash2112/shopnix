# Shopnix — Seller on ONDC (BPP / Seller NP)

This app is a **Seller Network Participant (BPP)** on ONDC. Buyers find products via Pramaan, GCR, or other BAPs; **your platform** answers `search` and sends `on_search` with catalogs from all active sellers.

Buyer app (`/ondc-bap`) is optional and disabled by default.

---

## How it works (Mystore-style)

| Layer | Who | What |
|--------|-----|------|
| **Platform (you)** | `shopnix-nine.vercel.app` | One ONDC subscriber, keys on Vercel, `/ondc/*` Beckn APIs |
| **Seller on Shopnix** | Registers at `/register` → Admin | Store profile + products |
| **ONDC network** | Pramaan / buyers | `search` → your BPP → `on_search` with catalog |

**Important:** Sellers do **not** get their own ONDC subscriber ID. They sell **through your** BPP. Each seller gets an **ONDC Provider ID** inside your catalog (`ondcProviderId`).

---

## When a seller joins — required details

### 1. Account (register)

- Name, email, password  
- Store name  

Auto-created:

- `ondcProviderId` (e.g. `MYSTORE_abc123`)  
- Linked to platform `ONDC_BPP_ID` / `ONDC_BPP_URI`

### 2. Store settings (Admin → Settings)

| Field | Required for ONDC | Used for |
|--------|-------------------|----------|
| Store name | Yes | Provider name on network |
| Phone | Yes | Fulfillment contact |
| Street, city, state, pincode | Yes | Provider location / serviceability |
| GSTIN | Recommended | Portal / compliance |
| Description | Recommended | Catalog text |
| Fulfillment type + radius (km) | Yes | Delivery + serviceability tag |

Check readiness: **GET `/api/seller/ondc-readiness`** (shown on Settings page).

### 3. Products (Admin → Products)

| Field | Required for ONDC | Notes |
|--------|-------------------|--------|
| Name, price | Yes | |
| Category | Yes | Maps to `category_id` (e.g. grocery, electronics) |
| Quantity > 0 | Yes | Unpublished or zero stock = hidden on ONDC |
| **Published** = on | Yes | Toggle when listing on ONDC |
| Images (≥1) | Strongly recommended | Full URLs on Vercel Blob or `/uploads` |
| `ondcItemId` | Auto | Unique Beckn item id |

---

## Pramaan: “Waiting for on_search” (logs show ACK)

HTTP **200 + ACK** from Pramaan only means the callback was received. The portal step completes when the **catalog passes schema checks**.

Common fixes (built into Shopnix search catalog):

| Issue | Fix |
|--------|-----|
| `http://localhost:4000/...` images in DB | Catalog rewrites to `API_BASE_URL` / Vercel URL; set `API_BASE_URL=https://shopnix-nine.vercel.app` on Vercel |
| Seller NP test with 2 providers + `MSN` | Default is **SNP** + **one** primary seller; set `ONDC_MSN_CATALOG=true` only for true marketplace |
| `quantity.available.count` not `99` | ONDC v1.2.0 uses `99` when in stock |
| Mixed categories on RET10 grocery | Pramaan search sends **grocery** items when available |

After deploy, open `GET /ondc/test-catalog` and confirm image URLs are `https://shopnix-nine.vercel.app/...`, `np_type` is `SNP`, and one provider.

---

## When products appear on ONDC

1. Seller completes profile (address, phone).  
2. Seller adds products and sets **Published** + stock.  
3. `ondc.isActive` is true (default on register).  
4. Buyer/Pramaan sends **search** to `https://shopnix-nine.vercel.app/ondc/search`.  
5. Your BPP builds **multi-seller catalog** (`getNetworkCatalogEntries`) and POSTs **on_search** to the buyer.

Preview catalog: `GET https://shopnix-nine.vercel.app/ondc/test-catalog`

---

## Platform owner checklist (ONDC portal)

Subscriber: **`shopnix-nine.vercel.app`**

| Step | URL / action |
|------|----------------|
| Site verification | `https://shopnix-nine.vercel.app/ondc-site-verification.html` — set `ONDC_SITE_VERIFICATION_SIGNED` in Vercel |
| BPP base | `https://shopnix-nine.vercel.app/ondc` |
| on_subscribe | `POST https://shopnix-nine.vercel.app/ondc/on_subscribe` (implement challenge decrypt; see ONDC reference utility) |
| Keys | `ONDC_SIGNING_PRIVATE_KEY`, `ONDC_UNIQUE_KEY_ID`, etc. on Vercel |
| Pramaan test | [pramaan.ondc.org](https://pramaan.ondc.org/) — Retail Grocery, Seller NP, std:080 |

See also `docs/ONDC_REGISTRATION.md`.

---

## Beckn endpoints (seller BPP)

| Endpoint | Purpose |
|----------|---------|
| `POST /ondc/search` | → `on_search` (catalog) |
| `POST /ondc/select` | → `on_select` |
| `POST /ondc/init` | → `on_init` |
| `POST /ondc/confirm` | → `on_confirm` |
| `POST /ondc/status` | → `on_status` |
| `POST /ondc/cancel` | → `on_cancel` |
| `POST /ondc/track` | → `on_track` |

---

## Scripts

```bash
npm run seed:admin      # Admin seller + provider id
npm run seed:products   # 15 sample products
npm run ondc:keys       # Generate signing keys
npm run ondc:test-registry
```

---

## FAQ

**Does each seller need an ONDC portal account?**  
No. Only the platform (`shopnix-nine.vercel.app`) is registered on ONDC. Sellers use Shopnix admin.

**How many products show on search?**  
Up to 50 published products per seller, up to 20 sellers per catalog response.

**Why Pramaan stuck on on_search?**  
Ensure deploy includes “send on_search before ACK” fix and published products exist. Check Vercel logs for `on_search success`.
