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
  updated_at    timestamptz not null default now()
);
create index if not exists idx_brief_links_style on brief_links(style_number);

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

-- =====================================================================
-- DONE. Open the app's "Briefs" page to fill in model / environment / styling
-- notes and manage links per style.
-- =====================================================================
