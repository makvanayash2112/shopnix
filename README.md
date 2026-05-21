# Shopnix — ONDC Seller App

Full-stack ONDC (Open Network for Digital Commerce) seller platform with **Next.js** admin UI, **Express.js** REST API, **MongoDB**, local product image storage, and **Beckn BPP** protocol endpoints.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| API | Express.js, Mongoose |
| Database | MongoDB |
| Auth | JWT + bcrypt |
| ONDC | Beckn BPP routes (search, select, init, confirm, …) |
| Images | Local `public/uploads/products/` → `http://localhost:4000/uploads/products/...` |

## Project structure

```
shopnix/
├── server/                 # Express API + ONDC BPP
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/ondc/
│   └── index.ts
├── src/                    # Next.js seller admin
│   ├── app/
│   │   ├── admin/          # Dashboard, products, orders, ONDC
│   │   ├── login/
│   │   └── register/
│   ├── components/
│   └── lib/
└── public/uploads/         # Product images (gitignored except .gitkeep)
```

## Quick start

### 1. Prerequisites

- Node.js 20+
- MongoDB running locally or Atlas URI

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` — set `MONGODB_URI`, `JWT_SECRET`, and ONDC fields after registration.

### 3. Install & run

```bash
npm install
npm run dev
```

- **Admin UI:** http://localhost:3000  
- **Express API:** http://localhost:4000  
- **ONDC BPP base:** `http://localhost:4000/ondc` (configure in ONDC registry; use [ngrok](https://ngrok.com) for public URL in sandbox)

### 4. Register a seller

1. Open http://localhost:3000/register  
2. Create account → redirects to admin  
3. Add products with images (stored under `public/uploads/products/`)  
4. Configure ONDC BPP ID/URI under **Admin → ONDC**

## ONDC BPP endpoints

All accept Beckn `POST` with `{ context, message }`, return immediate `ACK`, then async `on_*` callback to `bap_uri`:

| Incoming | Outgoing callback |
|----------|-------------------|
| `/ondc/search` | `on_search` (catalog) |
| `/ondc/select` | `on_select` |
| `/ondc/init` | `on_init` |
| `/ondc/confirm` | `on_confirm` |
| `/ondc/status` | `on_status` |
| `/ondc/cancel` | `on_cancel` |
| `/ondc/update` | `on_update` |
| `/ondc/track` | `on_track` |
| `/ondc/support` | `on_support` |

Health: `GET /ondc`

## REST API (authenticated)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Seller signup |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Current user |
| CRUD | `/api/products` | Products + image upload |
| GET/PATCH | `/api/orders` | Order list & status |
| GET/PUT | `/api/seller/profile` | Store + ONDC settings |
| GET | `/api/seller/stats` | Dashboard stats |

## Product image URLs

Uploaded files are saved as:

`http://localhost:4000/uploads/products/<filename>.jpg`

Next.js rewrites `/uploads/*` to the API in development so images work in the admin UI.

## ONDC network registration

1. Complete seller onboarding on the ONDC portal (sandbox/preprod).  
2. Set `ONDC_BPP_ID`, `ONDC_BPP_URI` (public HTTPS URL), signing keys in `.env`.  
3. Expose local API via ngrok: `ngrok http 4000` → use HTTPS URL + `/ondc` as BPP URI.  
4. Publish products with **Publish on ONDC catalog** enabled and stock &gt; 0.

> **Note:** Production ONDC requires Ed25519 signing and registry verification. This project implements the Beckn flow and callbacks; add signing middleware before going live.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API + Next.js together |
| `npm run dev:server` | Express only |
| `npm run dev:next` | Next.js only |
| `npm run server` | Express (no watch) |
| `npm run build` | Next.js production build |

## License

Private — Shopnix ONDC seller application.
