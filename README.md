# KadyLuxe — Paid Asset Tracker

Internal tracker for KadyLuxe's paid creative assets. Next.js (App Router) +
TypeScript + Tailwind + Supabase. Connects to the **existing** Supabase database
defined in `KL_Tracker_schema.sql` — it does not recreate it.

## Features
- **Product grid** — one row per product, sorted by DTC overage $, Phase 1 rows
  flagged with a gold edge. Asset chips are derived **live** from each style's
  `style_requirements ⋈ asset_slots`, grouped PDP / Paid Social / UGC. Click a
  chip to cycle Not started → In progress → Ready (saved to `product_assets`).
- **Finalized links** — attach a `final_url` to any chip via the corner
  popover; saving offers to mark the slot Ready. A linked chip opens the asset
  in a new tab.
- **Hero collections** — one card per `collections` row (group asset + UGC when
  in scope), backed by `collection_assets`.
- **Live dashboard** — % ready tiles for PDP, Paid Social, and UGC.
- **Filters / sort** — search, style, phase, has-gaps/complete, click-to-sort.
- **Requirements editor** (`/settings`) — toggle which slots each style needs.

> **Access:** this app is intentionally open — no login. Anyone with the URL can
> view and edit. It's an internal tool with nothing sensitive. To add logins +
> a team allowlist later, ask Claude to "add auth back."

## Run it locally
1. Install deps:
   ```bash
   npm install
   ```
2. Create `.env.local` from the example and fill in your values:
   ```bash
   cp .env.local.example .env.local
   ```
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from
     Supabase → Project Settings → API.
3. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Deploy (Vercel)
Set the two `NEXT_PUBLIC_SUPABASE_*` env vars in the Vercel project settings and
deploy. That's it.

## Notes on access
- There is no auth. The Supabase anon key ships to the browser (by design), and
  the seeded database has RLS disabled, so the app reads/writes openly.
- `supabase/public_access.sql` is **optional** — only run it if you want to
  silence Supabase's "RLS disabled" dashboard warning while keeping the app
  fully public.
- `.env.local` is gitignored — never commit real keys.
