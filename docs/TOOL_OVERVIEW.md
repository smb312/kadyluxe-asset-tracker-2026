# KadyLuxe × Olivia AI — Asset Tracker & Creative Brief Hub

**What it is:** a shared, login-free web tool that connects the **KadyLuxe**
merchandising/creative team with the **Olivia AI** production team. KadyLuxe
uses it to specify *what* needs to be shot and *how* it should look; Olivia uses
it to deliver finished assets and get sign-off. Both sides see the same live
status at all times, so nobody is chasing spreadsheets or email threads.

It is intentionally open — anyone with the link can read and edit. There is no
sign-in; you simply pick whether you're acting as "KadyLuxe" or "Olivia" on the
review screen.

---

## 1. The vocabulary (read this first)

| Term | What it means |
|---|---|
| **Style** | A product design, identified by a style number + name (e.g. *2606 — Reversible Faux Fur Vest*). Some are flagged **Hero ★**. |
| **Team** | A buyer/colorway running a style — a licensed team (*Denver Broncos*), or a plain colorway (*Blue, Oxblood, Burnt Orange*). |
| **SKU / Product** | One **Team × Style** combination — the actual thing being produced and shot. This is the atomic unit the whole tool is built around. |
| **Shot / Slot** | An individual asset to be produced for a style: PDP shots (Front, Back, Fabric, Lifestyle…), Paid Social assets, UGC. Each can be **required** or **optional**. |
| **Brief** | The creative direction for a style — model, environment, styling, product feel — plus reference links. Can be overridden per team. |

The key idea: **shots are defined per *style*, but produced and tracked per
*SKU* (team × style).** So one style's requirements automatically apply to every
team running it.

---

## 2. The five areas of the tool

The header nav switches between five screens:

### Tracker (`/`) — "Are the assets ready?"
The production scoreboard. One row per SKU, with colored **chips** for every
required shot:
- 🔴 Not started → 🟡 In progress → 🟢 Ready (click a chip to cycle).
- Attach the final asset link to a chip, or open an existing one.
- Live dashboard totals across PDP / Paid Social / UGC.
- Per-SKU notes, filters (style, phase, readiness) and sorting.

This is where readiness is *recorded*. Most cells turn green automatically when
Olivia's uploads are approved on the Review screen (see §3).

### All SKUs (`/hub`) — the master sheet / single source of truth
Every SKU in one wide, sortable, filterable, Google-Sheets-style table that
joins **everything** known about it:
- Commercial: phase, OVG units, OVG $ (with a ⚠ flag on placeholder prices).
- Asset readiness: PDP / Paid / UGC ready-vs-total + an overall completion bar.
- Brief status, count of attached styling links, and review activity (pending ⏳ / approved ✓).
- Search, filter (style / phase / brief status / readiness), and a totals strip.
- **Export CSV** of whatever you've filtered to.
- **Clickable:** click a row to jump straight to that team's brief card; click
  the Review cell to open that SKU's review board.

This is the screen leadership opens to see the whole program at a glance.

### Requirements (`/settings`) — "What does each style need?"
The editable catalog of shots, and which shots each style requires (required vs
optional). Changing a style's requirements instantly changes the chips shown on
the Tracker and the "shots needed" list in the Brief. **KadyLuxe owns this.**

### Briefs (`/briefs`) — the creative hand-off, a two-pane workspace
- **Left rail:** a board of all styles grouped by brief status (**Ready for
  Olivia / Draft / Delivered**), with search and a per-style completeness meter.
- **Right pane**, four tabs:
  - **Brief** — the style's shared defaults (Model, Lifestyle environment,
    Model styling, Product look & feel, Notes) plus the live list of shots
    needed. Model & Environment are flagged "overridable per team."
  - **By team** — one card per team running the style. Each team can **override**
    model / environment / styling, or leave it blank to **inherit** the default
    (the card shows "Inherited" vs "Override"). You can **add, rename, and
    delete teams** here directly — no spreadsheet or developer needed.
  - **Assets** — styling guides (Slides), product photos (Drive), model refs and
    PDFs, grouped by type, tagged to a team or shared, with image upload.
  - **Olivia hub** — a clean, read-only summary of the whole brief, teams and
    assets, with a one-click "copy as text."
- A **status control** (Draft → Ready for Olivia → Delivered) and a **"Copy
  brief for Olivia"** button.

### Reviews (`/reviews`) — the delivery & sign-off loop
Where Olivia hands work back and KadyLuxe approves it:
- An identity switch at the top: act as **KadyLuxe** or **Olivia**.
- Pick a style + team. Olivia uploads deliverables **per shot** (e.g. against
  "Front") or as a **product-level / general** upload not tied to one shot.
- Deliverables can be **images, Looms, or links**.
- KadyLuxe **approves** or **rejects with a reason**; a **comment thread** on
  each asset handles back-and-forth.
- **Approving a shot-tagged asset automatically marks that shot Ready on the
  Tracker** and attaches its link — closing the loop without double entry.

---

## 3. How the two teams work together

### KadyLuxe → Olivia (the brief hand-off)
1. **Define the shot list.** On **Requirements**, confirm which shots each style
   needs (required vs optional).
2. **Set up teams.** On **Briefs → By team**, add the teams/colorways running the
   style (e.g. add *Blue / Oxblood / Burnt Orange*; remove any that don't apply).
3. **Write the brief.** On **Briefs → Brief**, fill the style defaults: the
   model, the lifestyle environment, how the model is styled, and the product's
   look & feel.
4. **Add team specifics.** On **By team**, override model/environment/styling for
   any team that differs; leave the rest to inherit.
5. **Attach references.** On **Assets**, drop in styling guides, ecomm product
   photos, model references and PDFs (tag them to a team or leave shared).
6. **Mark it "Ready for Olivia."** Flip the status; optionally hit **Copy brief
   for Olivia** to paste the whole package, or send them the **Olivia hub** view
   — one page with everything they need to shoot that style.

### Olivia → KadyLuxe (delivery & review)
1. **Open the brief.** Read the Olivia hub for the style (model, environment,
   styling, shot list, all reference links) — one place, no hunting.
2. **Produce and upload.** On **Reviews**, acting as **Olivia**, upload each
   deliverable against its shot (or product-level), as an image, Loom or link.
3. **Discuss inline.** Use the comment thread on any asset to ask questions or
   note revisions.
4. **KadyLuxe reviews.** Acting as **KadyLuxe**, approve good assets or reject
   with a clear reason. Approvals roll straight through to the Tracker as
   **Ready**, with the final link attached.
5. **Iterate** on rejections until every required shot is green.

### The shared loop
- **All SKUs** and the **Tracker** always reflect the latest state, so both
  teams (and leadership) see the same picture: which SKUs are briefed, which are
  in production, which are delivered, and where the gaps are.
- Pending reviews surface as ⏳ on the master sheet, so KadyLuxe knows what's
  waiting on them; completion bars show Olivia (and buyers) what's left.

---

## 4. The status lifecycles

**Brief status** (set by KadyLuxe on the Briefs screen)
`Draft` → `Ready for Olivia` → `Delivered`

**Asset status** (per shot, on the Tracker — usually driven by approvals)
`Not started` → `In progress` → `Ready`

**Review status** (per deliverable, on the Reviews screen)
`Pending` → `Approved` (→ marks the shot Ready) **or** `Rejected` (with reason → revise & re-upload)

---

## 5. Quick playbooks

**KadyLuxe, starting a new style:**
Requirements (confirm shots) → Briefs: add teams → write defaults → per-team
overrides → attach references → set **Ready for Olivia** → share the Olivia hub.

**Olivia, producing a style:**
Open Olivia hub → shoot to the brief → Reviews (as Olivia): upload per shot →
answer comments → watch shots flip to Ready as they're approved.

**KadyLuxe, reviewing:**
All SKUs: sort by pending reviews (⏳) → click the Review cell → approve or
reject with a reason → confirm the Tracker turned green.

**Anyone, checking program status:**
All SKUs → filter by phase / brief status / "has gaps" → read the totals strip →
Export CSV for a report.

---

## 6. Practical notes

- **Access:** open link, no login. On Reviews you choose KadyLuxe vs Olivia per
  browser — it's a label for who's acting, not a security wall.
- **Live data:** every screen loads fresh on each visit; edits save as you go.
- **Reporting:** both the All SKUs sheet and the Briefs board export to CSV.
- **Setup:** the core tracker works as-is. The brief & review features live in
  optional database tables (`supabase/olivia_briefs.sql`); if a screen shows a
  one-time setup note, run that file once in Supabase.
- **Teams are per style:** "Blue" on one style is independent of "Blue" on
  another — correct for colorways, and editable anytime on Briefs → By team.
