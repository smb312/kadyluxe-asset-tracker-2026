import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { SkuHub, type HubRow } from "@/components/SkuHub";
import type { AssetSlot, AssetStatus, BriefStatus, StyleRequirement } from "@/lib/types";

export const dynamic = "force-dynamic";

// A single denormalized "everything" sheet: one row per product (team x style),
// joining commercial data, live asset readiness, brief status and review
// activity. Read-only reporting hub.
export default async function HubPage() {
  const supabase = await createClient();

  const [
    productsRes,
    slotsRes,
    reqRes,
    paRes,
    briefsRes,
    reviewsRes,
    linksRes,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*, styles(name, is_hero)")
      .order("dtc_ovg_msrp", { ascending: false, nullsFirst: false }),
    supabase.from("asset_slots").select("*").order("sort"),
    supabase.from("style_requirements").select("*"),
    supabase.from("product_assets").select("product_id, asset_slot_id, status"),
    // These three live in the optional olivia_briefs.sql tables — tolerate absence.
    supabase.from("style_briefs").select("style_number, status"),
    supabase.from("review_assets").select("product_id, review_status"),
    supabase.from("brief_links").select("style_number"),
  ]);

  const fatal =
    productsRes.error || slotsRes.error || reqRes.error || paRes.error;
  if (fatal) throw new Error(fatal.message);

  const slots = (slotsRes.data ?? []) as AssetSlot[];
  const slotsById = new Map(slots.map((s) => [s.id, s]));
  const requirements = (reqRes.data ?? []) as StyleRequirement[];

  // Per-style product-level requirements (required + optional).
  const reqByStyle = new Map<number, { slot: AssetSlot; required: boolean }[]>();
  for (const r of requirements) {
    const slot = slotsById.get(r.asset_slot_id);
    if (!slot || slot.level !== "product") continue;
    if (!reqByStyle.has(r.style_number)) reqByStyle.set(r.style_number, []);
    reqByStyle.get(r.style_number)!.push({ slot, required: r.is_required });
  }

  const statusByKey = new Map<string, AssetStatus>();
  for (const a of (paRes.data ?? []) as {
    product_id: number;
    asset_slot_id: number;
    status: AssetStatus;
  }[])
    statusByKey.set(`${a.product_id}:${a.asset_slot_id}`, a.status);

  const briefByStyle = new Map<number, BriefStatus>();
  for (const b of (briefsRes.data ?? []) as {
    style_number: number;
    status: BriefStatus;
  }[])
    briefByStyle.set(b.style_number, b.status);

  const pendingByProduct = new Map<number, number>();
  const approvedByProduct = new Map<number, number>();
  for (const r of (reviewsRes.data ?? []) as {
    product_id: number;
    review_status: string;
  }[]) {
    if (r.review_status === "pending")
      pendingByProduct.set(r.product_id, (pendingByProduct.get(r.product_id) ?? 0) + 1);
    else if (r.review_status === "approved")
      approvedByProduct.set(r.product_id, (approvedByProduct.get(r.product_id) ?? 0) + 1);
  }

  const linksByStyle = new Map<number, number>();
  for (const l of (linksRes.data ?? []) as { style_number: number }[])
    linksByStyle.set(l.style_number, (linksByStyle.get(l.style_number) ?? 0) + 1);

  const rows: HubRow[] = (
    (productsRes.data ?? []) as (Record<string, unknown> & {
      styles?: { name?: string; is_hero?: boolean } | null;
    })[]
  ).map((p) => {
    const styleNumber = p.style_number as number;
    const productId = p.id as number;
    const reqs = reqByStyle.get(styleNumber) ?? [];

    let pdpReady = 0,
      pdpTotal = 0,
      paidReady = 0,
      paidTotal = 0,
      ugcReady = 0,
      ugcTotal = 0,
      reqReady = 0,
      reqTotal = 0;
    for (const { slot, required } of reqs) {
      const ready =
        (statusByKey.get(`${productId}:${slot.id}`) ?? "not_started") === "ready";
      if (slot.asset_type === "pdp") {
        pdpTotal++;
        if (ready) pdpReady++;
      } else if (slot.asset_type === "paid_social") {
        paidTotal++;
        if (ready) paidReady++;
      } else if (slot.asset_type === "ugc") {
        ugcTotal++;
        if (ready) ugcReady++;
      }
      if (required) {
        reqTotal++;
        if (ready) reqReady++;
      }
    }

    return {
      productId,
      styleNumber,
      styleName: p.styles?.name ?? `Style ${styleNumber}`,
      isHero: !!p.styles?.is_hero,
      team: p.team as string,
      phase: p.phase as string,
      units: (p.dtc_ovg_units as number) ?? null,
      msrp: (p.dtc_ovg_msrp as number) ?? null,
      msrpFlagged: !!p.msrp_flagged,
      pdpReady,
      pdpTotal,
      paidReady,
      paidTotal,
      ugcReady,
      ugcTotal,
      reqReady,
      reqTotal,
      pct: reqTotal ? Math.round((reqReady / reqTotal) * 100) : 0,
      briefStatus: briefByStyle.get(styleNumber) ?? null,
      pendingReviews: pendingByProduct.get(productId) ?? 0,
      approvedReviews: approvedByProduct.get(productId) ?? 0,
      linkCount: linksByStyle.get(styleNumber) ?? 0,
      notes: (p.notes as string) ?? null,
    };
  });

  return (
    <div>
      <header className="bg-ink text-paper px-6 pt-[18px] pb-4">
        <div className="flex justify-between items-end flex-wrap gap-3">
          <div>
            <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-gold">
              KadyLuxe · Fall 26 · Master Sheet
            </span>
            <h1 className="font-disp font-bold uppercase text-[28px] leading-[0.95] mt-0.5">
              All SKUs
            </h1>
          </div>
          <Nav active="hub" />
        </div>
      </header>
      <SkuHub rows={rows} />
    </div>
  );
}
