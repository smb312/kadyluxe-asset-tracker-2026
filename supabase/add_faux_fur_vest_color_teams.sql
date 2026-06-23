-- Add three non-licensed color "teams" (colorways) for the
-- Reversible Faux Fur Vest (style 2606): Blue, Oxblood, Burnt Orange.
--
-- In this data model a "team" is a row in `products` (one product = team x style),
-- so each colorway is a product against style 2606. No units / MSRP are known
-- yet, so those are left NULL. Run this once in the Supabase SQL editor.
--
-- Idempotent: re-running does nothing thanks to the (team, style_number) unique
-- constraint.

insert into products (team, style_number, dtc_ovg_units, dtc_ovg_msrp, msrp_flagged, phase) values
  ('Blue',         2606, null, null, false, 'Backlog'),
  ('Oxblood',      2606, null, null, false, 'Backlog'),
  ('Burnt Orange', 2606, null, null, false, 'Backlog')
on conflict (team, style_number) do nothing;
