-- =====================================================================
-- KADYLUXE ASSET TRACKER · ROW-LEVEL SECURITY + ALLOWLIST  (ADDITIVE)
-- =====================================================================
-- Run this AFTER KL_Tracker_schema.sql. It does NOT drop or recreate any
-- existing table or data. It:
--   1. creates an `allowlist` table of permitted team emails,
--   2. enables Row-Level Security on every app table,
--   3. adds policies so ONLY authenticated users whose email is on the
--      allowlist can read or write.
-- Re-running is safe (guards + DROP POLICY IF EXISTS).
--
-- HOW TO EDIT WHO HAS ACCESS: insert/delete rows in `allowlist` (section 1).
-- The Supabase SQL editor uses the service role, which bypasses RLS, so you
-- can always manage the allowlist here.
-- =====================================================================

-- ========== 1. ALLOWLIST OF TEAM EMAILS ==========
create table if not exists allowlist (
  email text primary key
);

-- >>> EDIT THIS LIST: add every teammate who should have access. <<<
-- To add someone later, add a line here and re-run this file (safe), or just
-- run:  insert into allowlist (email) values ('new@person.com');
insert into allowlist (email) values
  ('eric@growwithcoast.com'),
  ('scott@growwithcoast.com'),
  ('kady@kadyluxe.com')
on conflict (email) do nothing;

-- Helper: is the CURRENT authenticated user on the allowlist?
-- SECURITY DEFINER so the function can read `allowlist` regardless of RLS.
create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from allowlist a
    where lower(a.email) = lower((auth.jwt() ->> 'email'))
  );
$$;

-- ========== 2. ENABLE RLS EVERYWHERE ==========
alter table styles              enable row level security;
alter table products            enable row level security;
alter table asset_slots         enable row level security;
alter table style_requirements  enable row level security;
alter table product_assets      enable row level security;
alter table collections         enable row level security;
alter table collection_assets   enable row level security;
alter table allowlist           enable row level security;

-- ========== 3. POLICIES: allowlisted members get full read/write ==========
-- One FOR ALL policy per table keeps it simple: members can SELECT/INSERT/
-- UPDATE/DELETE; everyone else (including the anon key with no session) is
-- denied by default because RLS is on and no other policy matches.

do $$
declare t text;
begin
  foreach t in array array[
    'styles','products','asset_slots','style_requirements',
    'product_assets','collections','collection_assets'
  ]
  loop
    execute format('drop policy if exists members_all on %I', t);
    execute format(
      'create policy members_all on %I for all to authenticated
         using (public.is_team_member())
         with check (public.is_team_member())', t);
  end loop;
end $$;

-- The allowlist table: members may read it; only the service role (SQL editor)
-- may change it. No insert/update/delete policy = those are denied under RLS.
drop policy if exists members_read_allowlist on allowlist;
create policy members_read_allowlist on allowlist
  for select to authenticated
  using (public.is_team_member());

-- =====================================================================
-- DONE. Quick checks:
--   • Hitting the REST API with only the anon key (no login) now returns
--     no rows / permission denied — good.
--   • A logged-in user whose email is NOT in `allowlist` also gets nothing.
--   • A logged-in, allowlisted user can read and write normally.
-- Remember to also restrict sign-ups in Supabase Auth settings if desired;
-- the app only ever sends magic links to allowlisted addresses.
-- =====================================================================
