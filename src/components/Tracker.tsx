"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TrackerData } from "@/lib/data";
import type { AssetSlot, AssetStatus } from "@/lib/types";
import { fmtMoney, nextStatus, shortFor } from "@/lib/assets";
import { Chip } from "./Chip";
import { Dashboard, type DashStats } from "./Dashboard";
import { Controls, type ControlsState } from "./Controls";
import { HeroPanel } from "./HeroPanel";
import { Nav } from "./Nav";
import { useAssetStore } from "./useAssetStore";

interface Entry {
  slot: AssetSlot;
  required: boolean;
}
interface StyleGroups {
  pdp: Entry[];
  paid_social: Entry[];
  ugc: Entry[];
}

const PHASE_ORDER = ["Phase 1", "Phase 2", "Backlog"];

type SortCol = "priority" | "team" | "style_name" | "msrp";

export function Tracker({ data }: { data: TrackerData }) {
  const { products, slots, requirements, collections } = data;
  const store = useAssetStore(data.productAssets, data.collectionAssets);
  const supabase = useMemo(() => createClient(), []);

  // --- Local notes state (products.notes), persisted on blur. ---
  const [notes, setNotes] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {};
    for (const p of products) m[p.id] = p.notes ?? "";
    return m;
  });

  const [controls, setControls] = useState<ControlsState>({
    q: "",
    style: "",
    phase: "",
    ready: "",
  });
  const [sort, setSort] = useState<{ col: SortCol; dir: 1 | -1 }>({
    col: "priority",
    dir: 1,
  });

  // --- Static lookups derived once. ---
  const slotsById = useMemo(() => {
    const m = new Map<number, AssetSlot>();
    for (const s of slots) m.set(s.id, s);
    return m;
  }, [slots]);

  const groupSlot = useMemo(
    () => slots.find((s) => s.code === "group"),
    [slots],
  );
  const ugcCollectionSlot = useMemo(
    () => slots.find((s) => s.code === "ugc_collection"),
    [slots],
  );

  // Requirements derived LIVE from style_requirements ⋈ asset_slots, grouped by
  // asset_type and sorted by slot order. Change the matrix → chips change here.
  const groupsByStyle = useMemo(() => {
    const m = new Map<number, StyleGroups>();
    for (const r of requirements) {
      const slot = slotsById.get(r.asset_slot_id);
      if (!slot || slot.level !== "product") continue;
      if (!m.has(r.style_number))
        m.set(r.style_number, { pdp: [], paid_social: [], ugc: [] });
      const g = m.get(r.style_number)!;
      const bucket = g[slot.asset_type as keyof StyleGroups];
      if (bucket) bucket.push({ slot, required: r.is_required });
    }
    for (const g of m.values()) {
      const sortFn = (a: Entry, b: Entry) => a.slot.sort - b.slot.sort;
      g.pdp.sort(sortFn);
      g.paid_social.sort(sortFn);
      g.ugc.sort(sortFn);
    }
    return m;
  }, [requirements, slotsById]);

  const requiredByStyle = useMemo(() => {
    const m = new Map<number, AssetSlot[]>();
    for (const r of requirements) {
      if (!r.is_required) continue;
      const slot = slotsById.get(r.asset_slot_id);
      if (!slot || slot.level !== "product") continue;
      if (!m.has(r.style_number)) m.set(r.style_number, []);
      m.get(r.style_number)!.push(slot);
    }
    return m;
  }, [requirements, slotsById]);

  // Priority rank = position in the server's msrp-desc ordering (stable).
  const priorityMap = useMemo(() => {
    const m = new Map<number, number>();
    products.forEach((p, i) => m.set(p.id, i + 1));
    return m;
  }, [products]);

  const styleNames = useMemo(
    () => [...new Set(products.map((p) => p.style_name))].sort(),
    [products],
  );
  const phases = useMemo(() => {
    const present = new Set(products.map((p) => p.phase));
    return PHASE_ORDER.filter((p) => present.has(p)).concat(
      [...present].filter((p) => !PHASE_ORDER.includes(p)),
    );
  }, [products]);

  const { getProduct } = store;

  const isComplete = useCallback(
    (styleNumber: number, productId: number) => {
      const reqs = requiredByStyle.get(styleNumber) ?? [];
      return (
        reqs.length > 0 &&
        reqs.every((s) => getProduct(productId, s.id).status === "ready")
      );
    },
    [requiredByStyle, getProduct],
  );

  // --- Filter + sort the visible rows. ---
  const rows = useMemo(() => {
    let list = products.slice();
    const q = controls.q.trim().toLowerCase();
    if (q)
      list = list.filter((p) =>
        `${p.team} ${p.style_name}`.toLowerCase().includes(q),
      );
    if (controls.style)
      list = list.filter((p) => p.style_name === controls.style);
    if (controls.phase) list = list.filter((p) => p.phase === controls.phase);
    if (controls.ready === "done")
      list = list.filter((p) => isComplete(p.style_number, p.id));
    if (controls.ready === "gap")
      list = list.filter((p) => !isComplete(p.style_number, p.id));

    const { col, dir } = sort;
    list.sort((a, b) => {
      if (col === "priority")
        return (priorityMap.get(a.id)! - priorityMap.get(b.id)!) * dir;
      if (col === "msrp") {
        const av = a.dtc_ovg_msrp ?? -1;
        const bv = b.dtc_ovg_msrp ?? -1;
        return (av - bv) * dir;
      }
      const av = String(a[col] ?? "");
      const bv = String(b[col] ?? "");
      return av.localeCompare(bv) * dir;
    });
    return list;
  }, [products, controls, sort, priorityMap, isComplete]);

  // --- Live dashboard stats. ---
  const stats: DashStats = useMemo(() => {
    let pdpReady = 0,
      pdpTotal = 0,
      paidReady = 0,
      paidTotal = 0,
      ugcReady = 0,
      ugcInProgress = 0,
      ugcTotal = 0;
    for (const p of products) {
      const g = groupsByStyle.get(p.style_number);
      if (!g) continue;
      for (const e of g.pdp) {
        pdpTotal++;
        if (getProduct(p.id, e.slot.id).status === "ready") pdpReady++;
      }
      for (const e of g.paid_social) {
        paidTotal++;
        if (getProduct(p.id, e.slot.id).status === "ready") paidReady++;
      }
      for (const e of g.ugc) {
        ugcTotal++;
        const st = getProduct(p.id, e.slot.id).status;
        if (st === "ready") ugcReady++;
        else if (st === "in_progress") ugcInProgress++;
      }
    }
    return {
      pdpReady,
      pdpTotal,
      paidReady,
      paidTotal,
      ugcReady,
      ugcInProgress,
      ugcTotal,
    };
  }, [products, groupsByStyle, getProduct]);

  // --- Note persistence (write on blur). ---
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const saveNote = useCallback(
    async (productId: number, value: string) => {
      const { error } = await supabase
        .from("products")
        .update({ notes: value })
        .eq("id", productId);
      setNoteErr(error ? `Could not save note: ${error.message}` : null);
    },
    [supabase],
  );

  // --- Chip rendering for a product slot. ---
  const renderChip = (productId: number, e: Entry) => {
    const cell = getProduct(productId, e.slot.id);
    const optional = !e.required;
    return (
      <Chip
        key={e.slot.id}
        short={shortFor(e.slot.code)}
        label={e.slot.label}
        status={cell.status}
        optional={optional}
        finalUrl={cell.final_url}
        onCycle={() =>
          store.writeProduct(productId, e.slot.id, {
            status: nextStatus(cell.status),
          })
        }
        onSetStatus={(s: AssetStatus) =>
          store.writeProduct(productId, e.slot.id, { status: s })
        }
        onSaveLink={(url, markReady) =>
          store.writeProduct(productId, e.slot.id, {
            final_url: url || null,
            ...(markReady ? { status: "ready" as AssetStatus } : {}),
          })
        }
        onRemoveLink={() =>
          store.writeProduct(productId, e.slot.id, { final_url: null })
        }
      />
    );
  };

  const groupReady = (productId: number, entries: Entry[]) =>
    entries.filter((e) => getProduct(productId, e.slot.id).status === "ready")
      .length;

  const onSort = (col: SortCol) =>
    setSort((s) =>
      s.col === col
        ? { col, dir: (s.dir * -1) as 1 | -1 }
        : { col, dir: col === "team" || col === "style_name" ? 1 : col === "msrp" ? -1 : 1 },
    );

  const sortArrow = (col: SortCol) =>
    sort.col === col ? (sort.dir === 1 ? " ↑" : " ↓") : "";

  const emptyGroups: StyleGroups = { pdp: [], paid_social: [], ugc: [] };

  return (
    <div>
      {/* Header */}
      <header className="bg-ink text-paper px-6 pt-[18px] pb-4">
        <div className="flex justify-between items-end flex-wrap gap-3">
          <div>
            <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-gold">
              KadyLuxe · Fall 26 · Paid Asset Tracker
            </span>
            <h1 className="font-disp font-bold uppercase text-[28px] leading-[0.95] mt-0.5">
              Asset Readiness
            </h1>
          </div>
          <Nav active="tracker" />
        </div>
        <Dashboard stats={stats} />
      </header>

      {(store.error || noteErr) && (
        <div className="bg-badbg text-bad text-xs px-6 py-2 flex justify-between">
          <span>{store.error ?? noteErr}</span>
          <button
            onClick={() => {
              store.clearError();
              setNoteErr(null);
            }}
            className="underline"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Helper strip */}
      <div className="font-mono text-[10px] text-muted px-6 py-1.5 bg-white border-b border-line">
        Click a chip to cycle <b className="text-ink">Not started → In progress → Ready</b>.
        Use the corner <b className="text-ink">+ / ↗</b> to attach or open a final
        link. Hover a chip for its label.
      </div>

      <Controls
        state={controls}
        styles={styleNames}
        phases={phases}
        shown={rows.length}
        total={products.length}
        onChange={(patch) => setControls((c) => ({ ...c, ...patch }))}
      />

      <div className="px-6 pb-12">
        <div className="font-disp uppercase font-bold text-lg mt-5 mb-1">
          Per-Product Assets{" "}
          <span className="font-mono text-[11px] font-normal normal-case text-muted">
            chips come live from each style&apos;s requirements
          </span>
        </div>

        {/* Legend */}
        <div className="font-mono text-[10px] text-muted flex gap-3.5 flex-wrap mb-1">
          <Legend bg="bg-badbg" border="#e7c0cb" label="Not started" />
          <Legend bg="bg-warnbg" border="#ecd49a" label="In progress" />
          <Legend bg="bg-okbg" border="#a9dcc2" label="Ready" />
          <Legend bg="bg-neutralbg" border="#d8d1c2" label="UGC optional" />
        </div>

        <table className="w-full border-collapse mt-2">
          <thead>
            <tr>
              <th className="th th-sort text-center" onClick={() => onSort("priority")}>
                #{sortArrow("priority")}
              </th>
              <th className="th th-sort" onClick={() => onSort("team")}>
                Team{sortArrow("team")}
              </th>
              <th className="th th-sort" onClick={() => onSort("style_name")}>
                Style{sortArrow("style_name")}
              </th>
              <th className="th th-sort text-right" onClick={() => onSort("msrp")}>
                Ovg ${sortArrow("msrp")}
              </th>
              <th className="th text-center">PDP</th>
              <th className="th text-center">Paid Social</th>
              <th className="th text-center">UGC</th>
              <th className="th">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const g = groupsByStyle.get(p.style_number) ?? emptyGroups;
              const phase1 = p.phase === "Phase 1";
              const flagged = p.msrp_flagged && p.dtc_ovg_msrp == null;
              return (
                <tr key={p.id} className="hover:bg-[#fbf9f4]">
                  <td
                    className="px-2 py-1.5 border-b border-line text-center font-mono text-[11px] text-muted"
                    style={phase1 ? { boxShadow: "inset 3px 0 0 #C6A06D" } : undefined}
                  >
                    {priorityMap.get(p.id)}
                  </td>
                  <td className="px-2 py-1.5 border-b border-line font-semibold">
                    {p.team}
                  </td>
                  <td className="px-2 py-1.5 border-b border-line text-[#3f3a32]">
                    {p.style_name}
                  </td>
                  <td className="px-2 py-1.5 border-b border-line text-right font-mono text-[11.5px] tabular-nums">
                    {flagged ? (
                      <span
                        className="text-[#B06A1F] cursor-help"
                        title="MSRP was a $999 placeholder — verify"
                      >
                        ⚠ —
                      </span>
                    ) : (
                      fmtMoney(p.dtc_ovg_msrp)
                    )}
                  </td>
                  <ChipCell
                    entries={g.pdp}
                    productId={p.id}
                    renderChip={renderChip}
                    badge={`${groupReady(p.id, g.pdp)}/${g.pdp.length}`}
                  />
                  <ChipCell
                    entries={g.paid_social}
                    productId={p.id}
                    renderChip={renderChip}
                    badge={`${groupReady(p.id, g.paid_social)}/${g.paid_social.length}`}
                  />
                  <ChipCell
                    entries={g.ugc}
                    productId={p.id}
                    renderChip={renderChip}
                  />
                  <td className="px-2 py-1.5 border-b border-line">
                    <input
                      value={notes[p.id] ?? ""}
                      title={notes[p.id] ?? ""}
                      placeholder="…"
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [p.id]: e.target.value }))
                      }
                      onBlur={(e) => saveNote(p.id, e.target.value)}
                      className="font-body text-[11px] border border-line rounded px-1.5 py-1
                        w-16 focus:w-60 hover:w-60 transition-[width] duration-150
                        focus:outline-none focus:border-gold bg-white"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Hero collections */}
        <div className="font-disp uppercase font-bold text-lg mt-7 mb-1">
          Hero Collections{" "}
          <span className="font-mono text-[11px] font-normal normal-case text-muted">
            group paid-social asset each · UGC for in-scope collections
          </span>
        </div>
        <HeroPanel
          collections={collections}
          groupSlot={groupSlot}
          ugcSlot={ugcCollectionSlot}
          store={store}
        />
      </div>
    </div>
  );
}

function ChipCell({
  entries,
  productId,
  renderChip,
  badge,
}: {
  entries: Entry[];
  productId: number;
  renderChip: (productId: number, e: Entry) => React.ReactNode;
  badge?: string;
}) {
  return (
    <td className="px-2 py-1.5 border-b border-line">
      <span className="flex items-center gap-[3px]">
        {entries.length === 0 ? (
          <span className="font-mono text-[11px] text-[#c4bcab]">—</span>
        ) : (
          entries.map((e) => renderChip(productId, e))
        )}
        {badge && entries.length > 0 && (
          <span className="badge-count">{badge}</span>
        )}
      </span>
    </td>
  );
}

function Legend({ bg, border, label }: { bg: string; border: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i
        className={`w-[11px] h-[11px] rounded-sm border ${bg}`}
        style={{ borderColor: border }}
      />
      {label}
    </span>
  );
}
