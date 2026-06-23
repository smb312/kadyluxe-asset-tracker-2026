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
- **Auth + RLS** — Supabase email magic-link, restricted to an email allowlist,
  with Row-Level Security policies in the database.

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
   - `ALLOWED_EMAILS` — comma-separated team emails allowed to sign in.
   - `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` for local dev.
3. Apply the security layer once (Supabase SQL editor): paste and run
   `supabase/rls_and_auth.sql`. Edit the allowlist insert to include your team.
4. In Supabase → Authentication → URL Configuration, add
   `http://localhost:3000/**` (and your Vercel URL) to the redirect allow-list.
5. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000, enter an allowlisted email, and click the magic
   link.

## Deploy (Vercel)
Set the same four env vars in the Vercel project settings, set
`NEXT_PUBLIC_SITE_URL` to your production URL, and add that URL to Supabase Auth
redirect settings.

## Security summary
- The app sends magic links **only** to allowlisted emails; middleware blocks
  any session whose email isn't allowlisted.
- `supabase/rls_and_auth.sql` enables RLS on every table so the anon key alone
  reads/writes nothing; only authenticated, allowlisted users can read/write.
- `.env.local` is gitignored — never commit real keys.
