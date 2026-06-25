-- =====================================================================
-- PUBLIC ACCESS FOR THE BRIEF & REVIEW TABLES
-- =====================================================================
-- Companion to public_access.sql. The original file only covered the core
-- tracker tables, so if Row-Level Security ever gets switched on for the brief
-- or review tables (e.g. via the Supabase dashboard's "Enable RLS" prompt),
-- READS still return rows but WRITES are silently rejected — which looks like
-- "my edits didn't save."
--
-- This file makes the brief/review tables explicitly public (open read/write
-- for the anon role the app uses), matching the rest of this open tool. It also
-- re-asserts the grants in case an older olivia_briefs.sql run missed them.
--
-- Safe to re-run (DROP POLICY IF EXISTS guards). Run once in the Supabase SQL
-- editor.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'style_briefs','product_briefs','brief_links',
    'review_assets','review_comments'
  ]
  loop
    -- Skip any table that doesn't exist yet (e.g. reviews not set up).
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('grant all on table %I to anon, authenticated', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists public_all on %I', t);
    execute format(
      'create policy public_all on %I for all to anon, authenticated
         using (true) with check (true)', t);
  end loop;
end $$;
