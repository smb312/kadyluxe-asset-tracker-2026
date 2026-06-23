-- =====================================================================
-- KADYLUXE ASSET TRACKER  ·  Supabase / Postgres schema + seed
-- Run this ENTIRE file once in the Supabase SQL Editor (New query > paste > Run).
-- Re-running is safe: every insert is guarded with ON CONFLICT DO NOTHING.
-- =====================================================================

-- ========== 1. TABLES ==========

-- The 27 product styles. Editing requirements happens per-style (see table 4).
create table if not exists styles (
  style_number int primary key,
  name         text not null,
  is_hero      boolean not null default false
);

-- The 241 Team x Style "products" (the bets). dtc_ovg_msrp is NULL where the
-- source MSRP was the $999 placeholder; msrp_flagged marks those rows.
create table if not exists products (
  id             bigint generated always as identity primary key,
  team           text not null,
  style_number   int  not null references styles(style_number),
  dtc_ovg_units  int,
  dtc_ovg_msrp   numeric,
  msrp_flagged   boolean not null default false,
  phase          text not null default 'Backlog',   -- Phase 1 | Phase 2 | Backlog
  notes          text,
  unique (team, style_number)
);

-- Catalog of every possible deliverable "slot" (Front, Back, Lifestyle, etc.).
-- Add a row here to introduce a brand-new shot/asset type for the whole system.
create table if not exists asset_slots (
  id          bigint generated always as identity primary key,
  asset_type  text not null,                 -- pdp | paid_social | ugc | group
  code        text not null unique,          -- front, back, lifestyle, studio, ugc...
  label       text not null,                 -- "Front", "Lifestyle Spotlight"
  level       text not null default 'product', -- product | collection
  sort        int  not null default 0
);

-- *** THE EDITABLE REQUIREMENTS MATRIX ***
-- Which slots each STYLE needs. To change the PDP needs for one style,
-- add/remove rows here (or flip is_required). The app reads this live, so the
-- product grid instantly shows the new set of chips. No code change needed.
create table if not exists style_requirements (
  style_number   int    not null references styles(style_number) on delete cascade,
  asset_slot_id  bigint not null references asset_slots(id)       on delete cascade,
  is_required    boolean not null default true,  -- false = optional (e.g. UGC)
  primary key (style_number, asset_slot_id)
);

-- *** STATUS + FINALIZED LINK, per product per slot ***
-- Created on first edit (upsert). final_url holds the link to the finished asset.
create table if not exists product_assets (
  id            bigint generated always as identity primary key,
  product_id    bigint not null references products(id)    on delete cascade,
  asset_slot_id bigint not null references asset_slots(id)  on delete cascade,
  status        text not null default 'not_started',  -- not_started|in_progress|ready|na
  final_url     text,                                 -- <-- finalized asset link
  updated_at    timestamptz not null default now(),
  unique (product_id, asset_slot_id)
);

-- The 5 hero collections (group-level assets).
create table if not exists collections (
  id            bigint generated always as identity primary key,
  name          text not null unique,
  style_number  int references styles(style_number),
  ugc_in_scope  boolean not null default false
);

create table if not exists collection_assets (
  id            bigint generated always as identity primary key,
  collection_id bigint not null references collections(id) on delete cascade,
  asset_slot_id bigint not null references asset_slots(id) on delete cascade,
  status        text not null default 'not_started',
  final_url     text,
  updated_at    timestamptz not null default now(),
  unique (collection_id, asset_slot_id)
);

create index if not exists idx_products_style    on products(style_number);
create index if not exists idx_prodassets_product on product_assets(product_id);

-- ========== 2. SLOT CATALOG ==========
insert into asset_slots (asset_type, code, label, level, sort) values
  ('pdp','front','Front','product',1),
  ('pdp','back','Back','product',2),
  ('pdp','fabric','Fabric','product',3),
  ('pdp','long','Long','product',4),
  ('pdp','ghost','Ghost','product',5),
  ('paid_social','lifestyle','Lifestyle Spotlight','product',6),
  ('paid_social','editorial','Editorial Portrait','product',7),
  ('paid_social','studio','Studio Spotlight','product',8),
  ('ugc','ugc','UGC','product',9),
  ('group','group','Group Paid-Social Asset','collection',10),
  ('ugc','ugc_collection','Collection UGC','collection',11)
on conflict (code) do nothing;

-- ========== 3. STYLES (27) ==========
insert into styles (style_number, name, is_hero) values
  (1808, 'Casual Hoodie', false),
  (2424, 'Love Letter Sweater', true),
  (2425, 'Love Letter Sweater SE', false),
  (2521, 'Denim Pearl Snap Denim', false),
  (2524, 'Vinti Cardi', true),
  (2550, 'Mini Icon Crew Socks', false),
  (2554, 'Game Changer Artist Tee', false),
  (2600, 'Game Day Clear Clutch', false),
  (2601, 'Silk Scarf', false),
  (2602, 'Game Day Pointelle Vest', false),
  (2603, 'Open Weave Sweater', false),
  (2604, 'Mini Icon Fisherman', true),
  (2605, 'Linen Easy Shirt', false),
  (2606, 'Reversible Faux Fur Vest', false),
  (2607, 'Shine Sequin Knit Hood', false),
  (2608, 'Mesh Top', false),
  (2610, 'Pin Pack', false),
  (2617, 'SS Sequin Knit Hood', false),
  (2620, 'Balloon Sleeve Crew', false),
  (2624, 'Throwback Knit Crew', false),
  (2626, 'Faux Fur Knit Bomber', true),
  (2633, 'Cashmere Classic SS', false),
  (2650, 'Icon Crew Socks 3-Pack', false),
  (2652, 'Cardi Long Sleeve', false),
  (2653, 'Cardi ShortSleeve', false),
  (2654, 'Mini Cardi', false),
  (2655, 'Western Graphic Tee', true)
on conflict (style_number) do nothing;

-- ========== 4. PRODUCTS (241) ==========
insert into products (team, style_number, dtc_ovg_units, dtc_ovg_msrp, msrp_flagged, phase) values
  ('Denver Broncos', 2626, 1000, 249990, false, 'Phase 1'),
  ('Denver Broncos', 2604, 1312, 208608, false, 'Phase 1'),
  ('Texas Longhorns', 2626, 500, 124995, false, 'Phase 1'),
  ('Dallas Cowboys', 2626, 404, 100996, false, 'Phase 1'),
  ('Phoenix Suns', 2626, 356, 88996, false, 'Phase 1'),
  ('Penn State Nittany Lions', 2424, 370, 55130, false, 'Phase 1'),
  ('Miami Hurricanes', 2424, 300, 44700, false, 'Phase 1'),
  ('Dallas Cowboys', 2424, 273, 40677, false, 'Phase 1'),
  ('Texas A&M Aggies', 2424, 156, 23244, false, 'Phase 1'),
  ('Georgia Bulldogs', 2604, 144, 22896, false, 'Phase 1'),
  ('Ohio State Buckeyes', 2604, 144, 22896, false, 'Phase 1'),
  ('Oklahoma Sooners', 2424, 148, 22052, false, 'Phase 1'),
  ('Wisconsin Badgers', 2424, 132, 19668, false, 'Phase 1'),
  ('Tennessee Volunteers', 2604, 114, 18126, false, 'Phase 1'),
  ('Ohio State Buckeyes', 2424, 104, 15496, false, 'Phase 1'),
  ('Alabama Crimson Tide', 2604, 96, 15264, false, 'Phase 1'),
  ('Dallas Cowboys', 2604, 96, 15264, false, 'Phase 1'),
  ('Indiana Hoosiers', 2604, 96, 15264, false, 'Phase 1'),
  ('LSU Tigers', 2604, 96, 15264, false, 'Phase 1'),
  ('Michigan Wolverines', 2604, 96, 15264, false, 'Phase 1'),
  ('Oklahoma Sooners', 2604, 96, 15264, false, 'Phase 1'),
  ('Texas Longhorns', 2604, 96, 15264, false, 'Phase 1'),
  ('University of Kentucky', 2424, 102, 15198, false, 'Phase 1'),
  ('Kansas Jayhawks', 2424, 96, 14304, false, 'Phase 1'),
  ('Kansas State Wildcats', 2424, 87, 12963, false, 'Phase 1'),
  ('Purdue Boilermakers', 2424, 86, 12814, false, 'Phase 1'),
  ('Illinois Fighting Illini', 2424, 84, 12516, false, 'Phase 1'),
  ('Virginia Cavaliers', 2424, 78, 11622, false, 'Phase 1'),
  ('LSU Tigers', 2424, 77, 11473, false, 'Phase 1'),
  ('Florida Gators', 2604, 72, 11448, false, 'Phase 1'),
  ('Iowa Hawkeyes', 2424, 73, 10877, false, 'Phase 1'),
  ('BYU Cougars', 2424, 69, 10281, false, 'Phase 1'),
  ('Texas Longhorns', 2424, 58, 8642, false, 'Phase 1'),
  ('Ole Miss Rebels', 2424, 56, 8344, false, 'Phase 1'),
  ('Utah Utes', 2424, 56, 8344, false, 'Phase 1'),
  ('Wyoming Cowboys', 2604, 52, 8268, false, 'Phase 1'),
  ('Indiana Hoosiers', 2424, 55, 8195, false, 'Phase 1'),
  ('Montana State Bobcats', 2424, 54, 8046, false, 'Phase 1'),
  ('Michigan Wolverines', 2424, 52, 7748, false, 'Phase 1'),
  ('Wyoming Cowboys', 2424, 52, 7748, false, 'Phase 1'),
  ('BYU Cougars', 2604, 48, 7632, false, 'Phase 1'),
  ('Colorado Buffaloes', 2604, 48, 7632, false, 'Phase 1'),
  ('Wisconsin Badgers', 2604, 48, 7632, false, 'Phase 1'),
  ('Auburn Tigers', 2424, 51, 7599, false, 'Phase 1'),
  ('MST', 2424, 48, 7152, false, 'Phase 1'),
  ('Nebraska Cornhuskers', 2424, 48, 7152, false, 'Phase 1'),
  ('Illinois Fighting Illini', 2604, 40, 6360, false, 'Phase 1'),
  ('University of Kentucky', 2604, 36, 5724, false, 'Phase 1'),
  ('Virginia Tech', 2604, 36, 5724, false, 'Phase 1'),
  ('Arizona State Sun Devils', 2424, 12, 1788, false, 'Phase 1'),
  ('Auburn Tigers', 2604, 6, 954, false, 'Phase 1'),
  ('Clemson Tigers', 2604, 6, 954, false, 'Phase 1'),
  ('Penn State Nittany Lions', 2604, 6, 954, false, 'Phase 1'),
  ('Utah Utes', 2604, 6, 954, false, 'Phase 1'),
  ('Phoenix Suns', 2604, 1, 159, false, 'Phase 1'),
  ('Utah Mammoth', 2604, 1, 159, false, 'Phase 1'),
  ('Florida Panthers', 2424, 1, 149, false, 'Phase 1'),
  ('Phoenix Suns', 2424, 1, 149, false, 'Phase 1'),
  ('San Jose Sharks', 2424, 1, 149, false, 'Phase 1'),
  ('Utah Mammoth', 2424, 1, 149, false, 'Phase 1'),
  ('Alabama Crimson Tide', 2424, 0, 0, false, 'Phase 1'),
  ('Clemson Tigers', 2424, 0, 0, false, 'Phase 1'),
  ('Colorado Buffaloes', 2424, 0, 0, false, 'Phase 1'),
  ('Florida Gators', 2424, 0, 0, false, 'Phase 1'),
  ('Florida State Seminoles', 2424, 0, 0, false, 'Phase 1'),
  ('Iowa Hawkeyes', 2604, 0, 0, false, 'Phase 1'),
  ('MST', 2604, 0, 0, false, 'Phase 1'),
  ('Nebraska Cornhuskers', 2604, 0, 0, false, 'Phase 1'),
  ('Tennessee Volunteers', 2424, 0, 0, false, 'Phase 1'),
  ('Denver Broncos', 2624, 1312, 195488, false, 'Backlog'),
  ('KADYLUXE', 2601, 1800, 104400, false, 'Backlog'),
  ('KADYLUXE', 2606, 450, 67500, false, 'Backlog'),
  ('Denver Broncos', 2617, 500, 64500, false, 'Backlog'),
  ('KADYLUXE', 2607, 450, 62100, false, 'Backlog'),
  ('Denver Broncos', 2606, 360, 54000, false, 'Backlog'),
  ('Dallas Cowboys', 2524, 300, 53700, false, 'Backlog'),
  ('KADYLUXE', 2608, 750, 51750, false, 'Backlog'),
  ('KL', 2617, 400, 51600, false, 'Backlog'),
  ('KADYLUXE', 2610, 1900, 45600, false, 'Backlog'),
  ('KADYLUXE', 2653, 450, 44100, false, 'Backlog'),
  ('KADYLUXE', 2652, 300, 35400, false, 'Backlog'),
  ('Denver Broncos', 2608, 500, 34500, false, 'Backlog'),
  ('KADYLUXE', 2655, 500, 29500, false, 'Backlog'),
  ('Alabama Crimson Tide', 2524, 156, 27924, false, 'Backlog'),
  ('Indiana Hoosiers', 2607, 200, 27600, false, 'Backlog'),
  ('KL', 2607, 200, 27600, false, 'Backlog'),
  ('Michigan Wolverines', 2607, 200, 27600, false, 'Backlog'),
  ('Ohio State Buckeyes', 2607, 200, 27600, false, 'Backlog'),
  ('Alabama Crimson Tide', 2617, 200, 25800, false, 'Backlog'),
  ('Georgia Bulldogs', 2617, 200, 25800, false, 'Backlog'),
  ('Houston Cougars', 2617, 200, 25800, false, 'Backlog'),
  ('Miami Hurricanes', 2617, 200, 25800, false, 'Backlog'),
  ('Ole Miss Rebels', 2617, 200, 25800, false, 'Backlog'),
  ('Tennessee Volunteers', 2617, 200, 25800, false, 'Backlog'),
  ('Vanderbilt Commodores', 2617, 200, 25800, false, 'Backlog'),
  ('Dallas Cowboys', 2606, 150, 22500, false, 'Backlog'),
  ('Oklahoma Sooners', 2554, 300, 20700, false, 'Backlog'),
  ('Dallas Cowboys', 2554, 296, 20424, false, 'Backlog'),
  ('Georgia Bulldogs', 2606, 132, 19800, false, 'Backlog'),
  ('Dallas Cowboys', 2605, 150, 19350, false, 'Backlog'),
  ('Texas A&M Aggies', 2605, 150, 19350, false, 'Backlog'),
  ('Texas Longhorns', 2605, 150, 19350, false, 'Backlog'),
  ('Dallas Cowboys', 2654, 128, 19072, false, 'Backlog'),
  ('Tennessee Volunteers', 2606, 120, 18000, false, 'Backlog'),
  ('Indiana Hoosiers', 2524, 91, 16289, false, 'Backlog'),
  ('Alabama Crimson Tide', 2603, 150, 15600, false, 'Backlog'),
  ('LSU Tigers', 2603, 150, 15600, false, 'Backlog'),
  ('Ohio State Buckeyes', 2603, 150, 15600, false, 'Backlog'),
  ('Texas Longhorns', 2603, 150, 15600, false, 'Backlog'),
  ('Indiana Hoosiers', 2425, 102, 15198, false, 'Backlog'),
  ('Tennessee Volunteers', 2603, 144, 14976, false, 'Backlog'),
  ('Texas A&M Aggies', 2603, 144, 14976, false, 'Backlog'),
  ('BYU Cougars', 2554, 200, 13800, false, 'Backlog'),
  ('Texas Longhorns', 2606, 90, 13500, false, 'Backlog'),
  ('Dallas Cowboys', 2607, 96, 13248, false, 'Backlog'),
  ('Georgia Bulldogs', 2603, 126, 13104, false, 'Backlog'),
  ('Indiana Hoosiers', 2603, 126, 13104, false, 'Backlog'),
  ('Tennessee Volunteers', 2602, 144, 12816, false, 'Backlog'),
  ('Texas A&M Aggies', 2602, 144, 12816, false, 'Backlog'),
  ('Florida Gators', 2603, 114, 11856, false, 'Backlog'),
  ('University of Kentucky', 2603, 114, 11856, false, 'Backlog'),
  ('Nebraska Cornhuskers', 2606, 78, 11700, false, 'Backlog'),
  ('Georgia Bulldogs', 2602, 126, 11214, false, 'Backlog'),
  ('Colorado Buffaloes', 2606, 72, 10800, false, 'Backlog'),
  ('Alabama Crimson Tide', 2554, 156, 10764, false, 'Backlog'),
  ('Colorado Buffaloes', 2554, 156, 10764, false, 'Backlog'),
  ('Iowa Hawkeyes', 2603, 102, 10608, false, 'Backlog'),
  ('Virginia Cavaliers', 2603, 102, 10608, false, 'Backlog'),
  ('Clemson Tigers', 2603, 100, 10400, false, 'Backlog'),
  ('Florida State Seminoles', 2603, 100, 10400, false, 'Backlog'),
  ('Indiana Hoosiers', 2554, 150, 10350, false, 'Backlog'),
  ('Ohio State Buckeyes', 2554, 150, 10350, false, 'Backlog'),
  ('Florida Gators', 2602, 114, 10146, false, 'Backlog'),
  ('Arizona State Sun Devils', 2617, 78, 10062, false, 'Backlog'),
  ('Kansas Jayhawks', 2605, 78, 10062, false, 'Backlog'),
  ('Texas Longhorns', 2617, 78, 10062, false, 'Backlog'),
  ('Wisconsin Badgers', 2605, 78, 10062, false, 'Backlog'),
  ('Auburn Tigers', 2524, 56, 10024, false, 'Backlog'),
  ('Clemson Tigers', 2524, 56, 10024, false, 'Backlog'),
  ('Colorado Buffaloes', 2524, 56, 10024, false, 'Backlog'),
  ('Florida State Seminoles', 2524, 56, 10024, false, 'Backlog'),
  ('LSU Tigers', 2524, 56, 10024, false, 'Backlog'),
  ('MST', 2524, 56, 10024, false, 'Backlog'),
  ('Oklahoma Sooners', 2524, 56, 10024, false, 'Backlog'),
  ('Penn State Nittany Lions', 2524, 56, 10024, false, 'Backlog'),
  ('BYU Cougars', 2607, 72, 9936, false, 'Backlog'),
  ('Illinois Fighting Illini', 2607, 72, 9936, false, 'Backlog'),
  ('Kansas Jayhawks', 2607, 72, 9936, false, 'Backlog'),
  ('Kansas State Wildcats', 2607, 72, 9936, false, 'Backlog'),
  ('Utah Utes', 2607, 72, 9936, false, 'Backlog'),
  ('Wisconsin Badgers', 2607, 72, 9936, false, 'Backlog'),
  ('Iowa Hawkeyes', 2602, 102, 9078, false, 'Backlog'),
  ('Texas Longhorns', 2602, 102, 9078, false, 'Backlog'),
  ('Virginia Cavaliers', 2602, 102, 9078, false, 'Backlog'),
  ('Texas A&M Aggies', 2655, 150, 8850, false, 'Backlog'),
  ('Nebraska Cornhuskers', 2524, 48, 8592, false, 'Backlog'),
  ('Virginia Cavaliers', 2524, 48, 8592, false, 'Backlog'),
  ('Alabama Crimson Tide', 2602, 96, 8544, false, 'Backlog'),
  ('Dallas Cowboys', 2602, 96, 8544, false, 'Backlog'),
  ('Iowa Hawkeyes', 2607, 56, 7728, false, 'Backlog'),
  ('Nebraska Cornhuskers', 2607, 56, 7728, false, 'Backlog'),
  ('Wisconsin Badgers', 2524, 41, 7339, false, 'Backlog'),
  ('Iowa Hawkeyes', 2606, 48, 7200, false, 'Backlog'),
  ('Wyoming Cowboys', 2606, 48, 7200, false, 'Backlog'),
  ('Utah Utes', 2554, 104, 7176, false, 'Backlog'),
  ('Arizona State Sun Devils', 2605, 54, 6966, false, 'Backlog'),
  ('Kansas State Wildcats', 2605, 54, 6966, false, 'Backlog'),
  ('Nebraska Cornhuskers', 2605, 54, 6966, false, 'Backlog'),
  ('Wyoming Cowboys', 2633, 54, 6966, false, 'Backlog'),
  ('Illinois Fighting Illini', 2602, 78, 6942, false, 'Backlog'),
  ('Indiana Hoosiers', 2602, 78, 6942, false, 'Backlog'),
  ('Nebraska Cornhuskers', 2602, 78, 6942, false, 'Backlog'),
  ('Wisconsin Badgers', 2602, 78, 6942, false, 'Backlog'),
  ('Montana State Bobcats', 2524, 38, 6802, false, 'Backlog'),
  ('LSU Tigers', 2602, 72, 6408, false, 'Backlog'),
  ('Alabama Crimson Tide', 2655, 100, 5900, false, 'Backlog'),
  ('Clemson Tigers', 2655, 100, 5900, false, 'Backlog'),
  ('Georgia Bulldogs', 2655, 100, 5900, false, 'Backlog'),
  ('Indiana Hoosiers', 2655, 100, 5900, false, 'Backlog'),
  ('LSU Tigers', 2655, 100, 5900, false, 'Backlog'),
  ('Oklahoma Sooners', 2655, 100, 5900, false, 'Backlog'),
  ('BYU Cougars', 2603, 54, 5616, false, 'Backlog'),
  ('Wisconsin Badgers', 2554, 80, 5520, false, 'Backlog'),
  ('Utah Utes', 1808, 54, 5346, false, 'Backlog'),
  ('Wyoming Cowboys', 2524, 28, 5012, false, 'Backlog'),
  ('Nebraska Cornhuskers', 2603, 48, 4992, false, 'Backlog'),
  ('Wyoming Cowboys', 2603, 48, 4992, false, 'Backlog'),
  ('Arizona State Sun Devils', 2554, 56, 3864, false, 'Backlog'),
  ('Clemson Tigers', 2554, 56, 3864, false, 'Backlog'),
  ('Florida State Seminoles', 2554, 56, 3864, false, 'Backlog'),
  ('Iowa Hawkeyes', 2554, 56, 3864, false, 'Backlog'),
  ('MST', 2554, 56, 3864, false, 'Backlog'),
  ('Nebraska Cornhuskers', 2554, 56, 3864, false, 'Backlog'),
  ('Penn State Nittany Lions', 2554, 56, 3864, false, 'Backlog'),
  ('Wyoming Cowboys', 2554, 56, 3864, false, 'Backlog'),
  ('Wyoming Cowboys', 2607, 24, 3312, false, 'Backlog'),
  ('Florida State Seminoles', 2655, 56, 3304, false, 'Backlog'),
  ('Iowa Hawkeyes', 2605, 25, 3225, false, 'Backlog'),
  ('Florida State Seminoles', 2602, 20, 1780, false, 'Backlog'),
  ('Iowa Hawkeyes', 2524, 8, 1432, false, 'Backlog'),
  ('Auburn Tigers', 2603, 6, 624, false, 'Backlog'),
  ('Auburn Tigers', 2602, 6, 534, false, 'Backlog'),
  ('Clemson Tigers', 2602, 6, 534, false, 'Backlog'),
  ('Auburn Tigers', 2655, 6, 354, false, 'Backlog'),
  ('BYU Cougars', 2650, 6, 216, false, 'Backlog'),
  ('Florida State Seminoles', 2650, 6, 216, false, 'Backlog'),
  ('Indiana Hoosiers', 2650, 6, 216, false, 'Backlog'),
  ('LSU Tigers', 2650, 6, 216, false, 'Backlog'),
  ('MST', 2650, 6, 216, false, 'Backlog'),
  ('Nebraska Cornhuskers', 2650, 6, 216, false, 'Backlog'),
  ('Penn State Nittany Lions', 2650, 6, 216, false, 'Backlog'),
  ('Phoenix Suns', 2607, 1, 138, false, 'Backlog'),
  ('San Jose Sharks', 2607, 1, 138, false, 'Backlog'),
  ('Utah Mammoth', 2607, 1, 138, false, 'Backlog'),
  ('Phoenix Suns', 2554, 1, 69, false, 'Backlog'),
  ('Utah Mammoth', 2554, 1, 69, false, 'Backlog'),
  ('BYU Cougars', 2550, 2, 36, false, 'Backlog'),
  ('BYU2', 2550, 2, 36, false, 'Backlog'),
  ('Indiana Hoosiers', 2550, 2, 36, false, 'Backlog'),
  ('Alabama Crimson Tide', 2650, 0, 0, false, 'Backlog'),
  ('Arizona State Sun Devils', 2524, 0, 0, false, 'Backlog'),
  ('Arizona State Sun Devils', 2602, 0, 0, false, 'Backlog'),
  ('Arizona State Sun Devils', 2603, 0, 0, false, 'Backlog'),
  ('Arizona State Sun Devils', 2650, 0, 0, false, 'Backlog'),
  ('Arizona State Sun Devils', 2655, 0, 0, false, 'Backlog'),
  ('Auburn Tigers', 2650, 0, 0, false, 'Backlog'),
  ('BYU Cougars', 2524, 0, 0, false, 'Backlog'),
  ('Clemson Tigers', 2650, 0, 0, false, 'Backlog'),
  ('Florida Panthers', 2524, 0, 0, false, 'Backlog'),
  ('Illinois Fighting Illini', 2550, 0, 0, false, 'Backlog'),
  ('KADYLUXE', 2600, 1000, NULL, true, 'Backlog'),
  ('KADYLUXE', 2620, 1500, NULL, true, 'Backlog'),
  ('Michigan Wolverines', 2524, 0, 0, false, 'Backlog'),
  ('Michigan Wolverines', 2650, 0, 0, false, 'Backlog'),
  ('Ohio State Buckeyes', 2524, 0, 0, false, 'Backlog'),
  ('Ohio State Buckeyes', 2650, 0, 0, false, 'Backlog'),
  ('Texas A&M Aggies', 2521, 0, 0, false, 'Backlog'),
  ('Texas Longhorns', 2524, 0, 0, false, 'Backlog'),
  ('Utah Utes', 2550, 0, 0, false, 'Backlog'),
  ('Wyoming Cowboys', 2521, 0, 0, false, 'Backlog'),
  ('Wyoming Cowboys', 2550, 0, 0, false, 'Backlog')
on conflict (team, style_number) do nothing;

-- ========== 5. DEFAULT REQUIREMENTS ==========
-- Every style starts needing all 5 PDP shots + all 3 paid-social assets (required),
-- plus UGC (optional). Change per style afterward in the style_requirements table.
insert into style_requirements (style_number, asset_slot_id, is_required)
select s.style_number, a.id, (a.asset_type <> 'ugc')
from styles s
join asset_slots a on a.level = 'product'
on conflict do nothing;

-- ========== 6. HERO COLLECTIONS (5) ==========
insert into collections (name, style_number, ugc_in_scope) values
  ('Faux Fur Knit Bomber', 2626, true),
  ('Mini Icon Fisherman', 2604, true),
  ('Love Letter Sweater', 2424, true),
  ('Vinti Cardi', 2524, true),
  ('Western Graphic Tee', 2655, false)
on conflict do nothing;

-- group paid-social asset for every collection
insert into collection_assets (collection_id, asset_slot_id)
select c.id, a.id from collections c join asset_slots a on a.code = 'group'
on conflict (collection_id, asset_slot_id) do nothing;

-- collection UGC only for the in-scope (top 4) collections
insert into collection_assets (collection_id, asset_slot_id)
select c.id, a.id from collections c join asset_slots a on a.code = 'ugc_collection'
where c.ugc_in_scope
on conflict (collection_id, asset_slot_id) do nothing;

-- =====================================================================
-- SECURITY NOTE: these tables have NO row-level security yet, so anyone with
-- the anon key + URL could read/write. Before sharing the live link, put the
-- app behind Supabase Auth (email allowlist for your team) and enable RLS.
-- The build guide tells Claude Code to do this for you.
-- =====================================================================
