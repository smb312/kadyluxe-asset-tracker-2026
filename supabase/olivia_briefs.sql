-- =====================================================================
-- KADYLUXE ASSET TRACKER · OLIVIA AI CREATIVE BRIEFS  (ADDITIVE)
-- =====================================================================
-- Run this once in the Supabase SQL editor. It only ADDS two new tables
-- (and grants) — it does not touch or drop anything that already exists.
-- Re-running is safe.
--
-- WHAT THIS POWERS: the "Briefs" page, where you assemble everything Olivia AI
-- needs to generate PDP/lifestyle imagery for each style — the model to use,
-- the lifestyle environment, how the model is styled outside the product, the
-- product look & feel, and links to styling decks (Google Slides) and product
-- photo folders (Google Drive), optionally tagged per team.
-- =====================================================================

-- ========== 1. ONE BRIEF PER STYLE ==========
create table if not exists style_briefs (
  style_number          int primary key references styles(style_number) on delete cascade,
  model_notes           text,   -- what model to use
  lifestyle_environment text,   -- environment / setting for the lifestyle shot
  model_styling_notes   text,   -- how the model is styled outside the product
  product_feel_notes    text,   -- what the product looks and feels like
  extra_notes           text,   -- anything else for Olivia
  status                text not null default 'draft', -- draft | ready | delivered
  updated_at            timestamptz not null default now()
);

-- ========== 2. RESOURCE LINKS (slides / drive / pdf / model refs) ==========
create table if not exists brief_links (
  id            bigint generated always as identity primary key,
  style_number  int  not null references styles(style_number) on delete cascade,
  team          text,            -- NULL = applies to all teams of this style
  kind          text not null default 'other',
                -- styling_guide | product_photos | model_reference | pdf | other
  title         text not null default '',
  url           text not null,
  storage_path  text,            -- set when the file was uploaded to Storage
  updated_at    timestamptz not null default now()
);
create index if not exists idx_brief_links_style on brief_links(style_number);

-- For installs created before uploads existed: add the column if missing.
alter table brief_links add column if not exists storage_path text;

-- ========== 3. GRANTS ==========
-- This app is open (no login), like the rest of the tool. RLS stays off and the
-- public roles get access via grants, matching the existing tables.
grant all on table style_briefs to anon, authenticated;
grant all on table brief_links  to anon, authenticated;

-- ========== 4. OPTIONAL STARTER LINKS ==========
-- Pre-loads the links you shared. I mapped each to my best-guess style number —
-- *** VERIFY these on the Briefs page and fix any that are wrong *** (just edit
-- or delete the link and re-add under the right style). Delete this whole block
-- if you'd rather enter them yourself.
insert into brief_links (style_number, team, kind, title, url) values
  -- "Team Printed Fur Vests" styling  → Reversible Faux Fur Vest (2606)?
  (2606, null, 'styling_guide', 'Team Printed Fur Vests — styling',
    'https://docs.google.com/presentation/d/19ADRIZSToOLFkBgpD6I2vApaHNoZnxF7flBGv1XlwFc/edit?usp=sharing'),
  -- "Shine On Sweater (short sleeve)" → SS Sequin Knit Hood (2617)?
  (2617, null, 'styling_guide', 'Shine On Sweater (short sleeve) — styling',
    'https://docs.google.com/presentation/d/12XFaMMK2jidpxLhYG_BUaYT0e3hkQRg3XoVJYI5gtwM/edit?usp=sharing'),
  -- "Shine Sweaters (long sleeve) by team" → Shine Sequin Knit Hood (2607)?
  (2607, null, 'styling_guide', 'Shine Sweaters (long sleeve) — styling by team',
    'https://docs.google.com/presentation/d/1K7fCpHsCdw61WTWA0CfpohX3BmXHrP-etttQp66FRe0/edit?usp=sharing'),
  -- "Faux fur vests + mesh" styling guide → Reversible Faux Fur Vest (2606)?
  (2606, null, 'styling_guide', 'Faux Fur Vests + Mesh — styling',
    'https://docs.google.com/presentation/d/1lOumxlvdfgDJFwqDlHSVlUim4dNwqCappoQbxao1jlg/edit?usp=sharing'),
  -- Faux fur vest ecomm product images (Drive) → Reversible Faux Fur Vest (2606)?
  (2606, null, 'product_photos', 'Faux Fur Vest — ecomm images (front/back/detail)',
    'https://drive.google.com/drive/folders/1Se_naFWzgXKtHVQDzPh9NY2HlX737JNb')
on conflict do nothing;

-- ========== 5. PER-TEAM BRIEF OVERRIDES ==========
-- The styling guides and product photos are the same across teams (same
-- garment), but the MODEL and LIFESTYLE ENVIRONMENT can differ per team. This
-- table holds per-product (team x style) overrides; a blank field inherits the
-- style-level default from style_briefs.
create table if not exists product_briefs (
  product_id            bigint primary key references products(id) on delete cascade,
  model_notes           text,
  lifestyle_environment text,
  model_styling_notes   text,
  notes                 text,
  updated_at            timestamptz not null default now()
);
grant all on table product_briefs to anon, authenticated;

-- ========== 6. STORAGE BUCKET FOR UPLOADED IMAGES ==========
-- Lets you upload PNG/JPG styling/product images directly (no Drive link needed).
-- The bucket is PUBLIC so the images render in the app and their URLs can be
-- handed to Olivia AI — same "open tool" posture as the rest of this app.
insert into storage.buckets (id, name, public)
values ('brief-assets', 'brief-assets', true)
on conflict (id) do nothing;

-- Allow the public (anon) role to read/upload/delete within this one bucket.
drop policy if exists "brief-assets read"   on storage.objects;
drop policy if exists "brief-assets insert" on storage.objects;
drop policy if exists "brief-assets update" on storage.objects;
drop policy if exists "brief-assets delete" on storage.objects;

create policy "brief-assets read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'brief-assets');
create policy "brief-assets insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'brief-assets');
create policy "brief-assets update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'brief-assets');
create policy "brief-assets delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'brief-assets');

-- ========== 7. OLIVIA REVIEW LOOP (per-shot deliverables) ==========
-- Olivia uploads finished assets (images) or adds Loom / links per shot, and
-- the KadyLuxe side approves or rejects (with a reason) and leaves comments.
create table if not exists review_assets (
  id            bigint generated always as identity primary key,
  product_id    bigint not null references products(id)   on delete cascade,
  asset_slot_id bigint not null references asset_slots(id) on delete cascade,
  kind          text not null default 'image',   -- image | loom | link
  title         text not null default '',
  url           text not null,
  storage_path  text,                            -- set when uploaded to Storage
  review_status text not null default 'pending', -- pending | approved | rejected
  review_reason text,                            -- why rejected / approval note
  reviewed_by   text,
  reviewed_at   timestamptz,
  created_by    text,                            -- who uploaded (KadyLuxe|Olivia)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_review_assets_product on review_assets(product_id);

create table if not exists review_comments (
  id              bigint generated always as identity primary key,
  review_asset_id bigint not null references review_assets(id) on delete cascade,
  author          text,
  body            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists idx_review_comments_asset on review_comments(review_asset_id);

grant all on table review_assets   to anon, authenticated;
grant all on table review_comments to anon, authenticated;

-- Separate public bucket for Olivia's uploaded deliverables.
insert into storage.buckets (id, name, public)
values ('review-assets', 'review-assets', true)
on conflict (id) do nothing;

drop policy if exists "review-assets read"   on storage.objects;
drop policy if exists "review-assets insert" on storage.objects;
drop policy if exists "review-assets update" on storage.objects;
drop policy if exists "review-assets delete" on storage.objects;

create policy "review-assets read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'review-assets');
create policy "review-assets insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'review-assets');
create policy "review-assets update" on storage.objects
  for update to anon, authenticated using (bucket_id = 'review-assets');
create policy "review-assets delete" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'review-assets');

-- =====================================================================
-- DONE. "Briefs" page = briefs + styling links/images. "Reviews" page =
-- Olivia's uploaded deliverables with approve / reject / comments per shot.
-- =====================================================================
