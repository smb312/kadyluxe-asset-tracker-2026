-- =====================================================================
-- KADYLUXE ASSET TRACKER · PUBLIC ACCESS  (OPTIONAL)
-- =====================================================================
-- This app is intentionally OPEN: anyone with the link can read and write,
-- and there is no login. The seeded database already has RLS disabled, so the
-- app works as-is and you do NOT need to run anything.
--
-- The ONLY reason to run this file is cosmetic: Supabase's dashboard shows a
-- "RLS disabled" warning on tables. Running this turns RLS on but adds policies
-- that allow the public (anon) role full read/write — i.e. it keeps the app
-- fully open while silencing the warning and making the "this is public on
-- purpose" decision explicit in the database.
--
-- Re-running is safe (DROP POLICY IF EXISTS guards).
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'styles','products','asset_slots','style_requirements',
    'product_assets','collections','collection_assets'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists public_all on %I', t);
    -- anon = the public, un-logged-in role used by the app's NEXT_PUBLIC key.
    execute format(
      'create policy public_all on %I for all to anon, authenticated
         using (true) with check (true)', t);
  end loop;
end $$;

-- To LOCK THIS DOWN later (add logins + an allowlist), drop these public
-- policies and replace them with restrictive ones. Ask Claude to "add auth
-- back" and it will regenerate the magic-link + allowlist setup.
