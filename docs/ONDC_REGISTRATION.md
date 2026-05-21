# Shopnix — Add Buyer (BAP) + Seller (BPP) to ONDC Network

Shopnix runs **both roles** in one project:

| Role | ONDC name | What it does | Your base URL |
|------|-----------|--------------|---------------|
| **Seller** | **BPP** (Provider) | Receives `search`, sends catalog, fulfills orders | `{PUBLIC_URL}/ondc` |
| **Buyer** | **BAP** (Buyer App) | Sends `search` to sellers, receives `on_search`, places orders | `{PUBLIC_URL}/ondc-bap` |

Replace `{PUBLIC_URL}` with your **HTTPS** public URL (e.g. ngrok or production domain).

---

## Architecture (how Shopnix maps to ONDC)

```
Buyer apps (other BAPs) ──search──► ONDC Gateway ──► Your BPP (/ondc)
Your BAP (/ondc-bap) ──search──► Other BPPs on network
Your Shopnix web buyer ──REST──► MongoDB (direct store — works without network)
```

- **Shopnix buyer website** (`/shop`) = your own storefront (direct API).
- **ONDC BAP** (`/ondc-bap`) = network buyer app (for Pramaan / other sellers on ONDC).
- **ONDC BPP** (`/ondc`) = network seller (your catalog for other buyer apps).

---

## Step 1 — Prerequisites (both BAP and BPP)

1. **Company / business** details (GSTIN, PAN, bank — as required on portal).
2. **Public HTTPS domain** (cannot use `localhost` on registry):
   - Dev: [ngrok](https://ngrok.com) → `https://abc123.ngrok-free.app`
   - Prod: `https://api.yourdomain.com`
3. **ONDC domain** (retail grocery default): `ONDC:RET10`  
   Other examples: `ONDC:RET11` (fashion), `ONDC:RET12` (electronics) — must match your catalog.
4. **City code** (e.g. Bengaluru): `std:080` — [city codes](https://github.com/ONDC-Official/developer-docs).
5. **Ed25519 signing keys** (mandatory for staging/production registry).

Generate keys (example using Node):

```bash
npm install -g ondc-cli
# Or use ONDC key generator from developer-docs / reference implementations
```

Store in `.env`:

```env
ONDC_SIGNING_PRIVATE_KEY=<base64-or-pem-private>
ONDC_SUBSCRIBER_ID=<your-subscriber-id-from-portal>
```

6. **Site verification file** at  
   `https://your-domain.com/ondc-site-verification.html`  
   (ONDC portal gives exact content after key upload).

---

## Step 2 — Expose your API publicly (development)

```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 4000
```

Copy ngrok HTTPS URL, e.g. `https://abc123.ngrok-free.app`

Update `.env`:

```env
API_BASE_URL=https://abc123.ngrok-free.app
NEXT_PUBLIC_API_URL=https://abc123.ngrok-free.app
ONDC_BPP_URI=https://abc123.ngrok-free.app/ondc
ONDC_BAP_URI=https://abc123.ngrok-free.app/ondc-bap
ONDC_BPP_ID=shopnix-bpp.yourdomain.com
ONDC_BAP_ID=shopnix-bap.yourdomain.com
```

Restart `npm run dev`.

Verify:

- Seller BPP health: `GET https://YOUR_URL/ondc`
- Buyer BAP health: `GET https://YOUR_URL/ondc-bap`
- Guide API: `GET https://YOUR_URL/api/ondc/guide`

---

## Step 3 — Register on ONDC Portal

1. Go to **[https://portal.ondc.org](https://portal.ondc.org)** → Sign up / Sign in.
2. Complete profile **100%** (company, KYC, documents).
3. Request access to **Staging** / **Pre-production** (whitelist); approval can take **6–48 hours**.
4. You will register **two network participants** (or one NP with two roles, per portal flow):

### A) Seller (BPP) registration

| Field | Example |
|-------|---------|
| Participant type | Seller / BPP |
| Subscriber ID | `shopnix-bpp.yourdomain.com` (must match `ONDC_BPP_ID`) |
| Subscriber URL | `https://your-domain.com/ondc` |
| Domain | `ONDC:RET10` |
| City | `std:080` |
| Signing public key | From your Ed25519 key pair |

**BPP endpoints to register** (all POST, Beckn format):

| Path | Callback you send |
|------|-------------------|
| `/ondc/search` | `on_search` |
| `/ondc/select` | `on_select` |
| `/ondc/init` | `on_init` |
| `/ondc/confirm` | `on_confirm` |
| `/ondc/status` | `on_status` |
| `/ondc/cancel` | `on_cancel` |
| `/ondc/update` | `on_update` |
| `/ondc/track` | `on_track` |
| `/ondc/support` | `on_support` |

### B) Buyer (BAP) registration

| Field | Example |
|-------|---------|
| Participant type | Buyer / BAP |
| Subscriber ID | `shopnix-bap.yourdomain.com` (must match `ONDC_BAP_ID`) |
| Subscriber URL | `https://your-domain.com/ondc-bap` |
| Domain | `ONDC:RET10` |
| City | `std:080` |

**BAP endpoints to register** (receive callbacks from network):

| Path | Purpose |
|------|---------|
| `/ondc-bap/on_search` | Catalog from sellers |
| `/ondc-bap/on_select` | Quote |
| `/ondc-bap/on_init` | Order init |
| `/ondc-bap/on_confirm` | Order confirmed |
| `/ondc-bap/on_status` | Status updates |
| `/ondc-bap/on_cancel` | Cancellation |
| `/ondc-bap/on_track` | Tracking |

**BAP outgoing** (Shopnix calls sellers):

- `POST /ondc-bap/discover` — internal API to trigger `search` on a BPP (testing).

---

## Step 4 — Configure Shopnix Admin

1. Login: **Seller admin** → http://localhost:3000/login  
   `admin@shopnix.com` / `Shopnix@Admin2026`
2. Open **Admin → ONDC** — set BPP ID, BPP URI, domain, city, subscriber ID.
3. Open **Shop → ONDC (Buyer)** — view BAP URIs and test discover.
4. Ensure products are **Published** with stock & images (Admin → Products).

---

## Step 5 — Test with Pramaan (sandbox)

1. **[https://pramaan.ondc.org](https://pramaan.ondc.org)** — ONDC test harness.
2. Use your **staging subscriber_id** after portal approval.
3. Mock partners (for early tests):
   - Mock seller BPP: `pramaan.ondc.org/beta/staging/mock/seller`
   - Mock buyer BAP: `pramaan.ondc.org/beta/staging/mock/buyer`
4. Run flows: Search → Select → Init → Confirm → Status → Track.
5. Check **Admin → ONDC → Transaction logs** in Shopnix.

Test your BPP (others search you):

- Pramaan buyer searches your `ONDC_BPP_ID` / catalog.

Test your BAP (you search others):

```bash
curl -X POST https://YOUR_URL/api/buyer/ondc/discover \
  -H "Content-Type: application/json" \
  -d '{"category":"Grocery","bppUri":"https://pramaan-provider-uri"}'
```

---

## Step 6 — Payment on ONDC

Shopnix buyer store uses **Cash on Delivery only** (no payment gateway).

For ONDC network orders, payment type in Beckn is `ON-FULFILLMENT` / COD.  
Production may require **RSP** (payment collector) per ONDC retail spec — check latest docs for your domain.

---

## Step 7 — Go live (production)

1. Complete **pre-production** test report on portal.
2. Production keys + production subscriber_id.
3. Update `.env` with production URLs (no ngrok).
4. SSL, site verification, registry publish.
5. Monitor logs: `OndcLog` collection in MongoDB.

---

## Environment checklist

```env
# Public URLs (HTTPS in staging/prod)
API_BASE_URL=https://api.yourdomain.com
ONDC_BPP_ID=shopnix-bpp.yourdomain.com
ONDC_BPP_URI=https://api.yourdomain.com/ondc
ONDC_BAP_ID=shopnix-bap.yourdomain.com
ONDC_BAP_URI=https://api.yourdomain.com/ondc-bap
ONDC_DOMAIN=ONDC:RET10
ONDC_CITY=std:080
ONDC_COUNTRY=IND
ONDC_SIGNING_PRIVATE_KEY=...
ONDC_SUBSCRIBER_ID=...
```

---

## Official references

- Portal: https://portal.ondc.org  
- Developer docs: https://github.com/ONDC-Official/developer-docs  
- Pramaan testing: https://pramaan.ondc.org  
- Beckn protocol: https://developers.becknprotocol.io  

---

## What Shopnix already implements

| Feature | Status |
|---------|--------|
| BPP search → on_search catalog | ✅ |
| BPP select, init, confirm, status, cancel, track, support | ✅ |
| BAP on_* callbacks + discover | ✅ |
| ONDC transaction logs | ✅ |
| Admin ONDC config UI | ✅ |
| Ed25519 signing on every request | ⚠️ Add before staging sign-off |
| RSP / online payment | ❌ COD only (by design) |

For signing in production, integrate ONDC reference auth header middleware before registry submission.
