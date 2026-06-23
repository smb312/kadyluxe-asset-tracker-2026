"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BriefStatus } from "@/lib/types";
import { fmtMoney } from "@/lib/assets";

export interface HubRow {
  productId: number;
  styleNumber: number;
  styleName: string;
  isHero: boolean;
  team: string;
  phase: string;
  units: number | null;
  msrp: number | null;
  msrpFlagged: boolean;
  pdpReady: number;
  pdpTotal: number;
  paidReady: number;
  paidTotal: number;
  ugcReady: number;
  ugcTotal: number;
  reqReady: number;
  reqTotal: number;
  pct: number;
  briefStatus: BriefStatus | null;
  pendingReviews: number;
  approvedReviews: number;
  linkCount: number;
  notes: string | null;
}

const BRIEF_LABEL: Record<BriefStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  delivered: "Delivered",
};
const PHASE_ORDER = ["Phase 1", "Phase 2", "Backlog"];

type SortCol =
  | "style"
  | "team"
  | "phase"
  | "units"
  | "msrp"
  | "pct"
  | "pending";

export function SkuHub({ rows }: { rows: HubRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [style, setStyle] = useState("");
  const [phase, setPhase] = useState("");
  const [brief, setBrief] = useState<"" | BriefStatus>("");
  const [ready, setReady] = useState<"" | "done" | "gap">("");
  const [sort, setSort] = useState<{ col: SortCol; dir: 1 | -1 }>({
    col: "msrp",
    dir: -1,
  });

  const styleNames = useMemo(
    () => [...new Set(rows.map((r) => r.styleName))].sort(),
    [rows],
  );
  const phases = useMemo(() => {
    const present = new Set(rows.map((r) => r.phase));
    return PHASE_ORDER.filter((p) => present.has(p)).concat(
      [...present].filter((p) => !PHASE_ORDER.includes(p)),
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (
        needle &&
        !`${r.styleNumber} ${r.styleName} ${r.team}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      if (style && r.styleName !== style) return false;
      if (phase && r.phase !== phase) return false;
      if (brief && r.briefStatus !== brief) return false;
      if (ready === "done" && !(r.reqTotal > 0 && r.pct === 100)) return false;
      if (ready === "gap" && r.reqTotal > 0 && r.pct === 100) return false;
      return true;
    });

    const { col, dir } = sort;
    list = list.slice().sort((a, b) => {
      switch (col) {
        case "style":
          return (a.styleNumber - b.styleNumber) * dir;
        case "team":
          return a.team.localeCompare(b.team) * dir;
        case "phase":
          return a.phase.localeCompare(b.phase) * dir;
        case "units":
          return ((a.units ?? -1) - (b.units ?? -1)) * dir;
        case "msrp":
          return ((a.msrp ?? -1) - (b.msrp ?? -1)) * dir;
        case "pct":
          return (a.pct - b.pct) * dir;
        case "pending":
          return (a.pendingReviews - b.pendingReviews) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [rows, q, style, phase, brief, ready, sort]);

  const totals = useMemo(() => {
    let units = 0,
      msrp = 0,
      pctSum = 0,
      pctN = 0,
      pending = 0;
    for (const r of filtered) {
      units += r.units ?? 0;
      msrp += r.msrp ?? 0;
      pending += r.pendingReviews;
      if (r.reqTotal > 0) {
        pctSum += r.pct;
        pctN++;
      }
    }
    return {
      units,
      msrp,
      pending,
      avgPct: pctN ? Math.round(pctSum / pctN) : 0,
    };
  }, [filtered]);

  const onSort = (col: SortCol) =>
    setSort((s) =>
      s.col === col
        ? { col, dir: (s.dir * -1) as 1 | -1 }
        : { col, dir: col === "team" || col === "phase" || col === "style" ? 1 : -1 },
    );
  const arrow = (col: SortCol) =>
    sort.col === col ? (sort.dir === 1 ? " ↑" : " ↓") : "";

  function exportCsv() {
    const head = [
      "Style #",
      "Style",
      "Hero",
      "Team",
      "Phase",
      "OVG Units",
      "OVG $",
      "MSRP flagged",
      "PDP ready",
      "PDP total",
      "Paid ready",
      "Paid total",
      "UGC ready",
      "UGC total",
      "Required %",
      "Brief status",
      "Pending reviews",
      "Approved reviews",
      "Style links",
      "Notes",
    ];
    const data = filtered.map((r) => [
      r.styleNumber,
      r.styleName,
      r.isHero ? "yes" : "",
      r.team,
      r.phase,
      r.units ?? "",
      r.msrp ?? "",
      r.msrpFlagged ? "yes" : "",
      r.pdpReady,
      r.pdpTotal,
      r.paidReady,
      r.paidTotal,
      r.ugcReady,
      r.ugcTotal,
      r.pct,
      r.briefStatus ? BRIEF_LABEL[r.briefStatus] : "",
      r.pendingReviews,
      r.approvedReviews,
      r.linkCount,
      r.notes ?? "",
    ]);
    const csv = [head, ...data]
      .map((row) =>
        row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "kadyluxe-all-skus.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const selCls =
    "text-[12px] px-2 py-1.5 border border-line rounded bg-white focus:outline-none focus:border-gold";

  return (
    <div>
      {/* Controls */}
      <div className="px-6 py-3 bg-white border-b border-line flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search team, style # or name…"
          className="text-sm px-2.5 py-1.5 border border-line rounded focus:outline-none focus:border-gold min-w-[220px]"
        />
        <select value={style} onChange={(e) => setStyle(e.target.value)} className={selCls}>
          <option value="">All styles</option>
          {styleNames.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={phase} onChange={(e) => setPhase(e.target.value)} className={selCls}>
          <option value="">All phases</option>
          {phases.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={brief}
          onChange={(e) => setBrief(e.target.value as "" | BriefStatus)}
          className={selCls}
        >
          <option value="">Any brief</option>
          <option value="draft">Brief: Draft</option>
          <option value="ready">Brief: Ready</option>
          <option value="delivered">Brief: Delivered</option>
        </select>
        <select
          value={ready}
          onChange={(e) => setReady(e.target.value as "" | "done" | "gap")}
          className={selCls}
        >
          <option value="">Any readiness</option>
          <option value="done">Assets complete</option>
          <option value="gap">Has gaps</option>
        </select>
        <button
          type="button"
          onClick={exportCsv}
          className="ml-auto font-mono text-[10px] uppercase tracking-[0.06em] px-3 py-1.5
            rounded border border-gold text-ink hover:bg-gold/20"
        >
          Export CSV
        </button>
      </div>

      {/* Summary strip */}
      <div className="px-6 py-2 bg-paper border-b border-line font-mono text-[11px] text-muted flex flex-wrap gap-x-6 gap-y-1">
        <span>
          <b className="text-ink">{filtered.length}</b> / {rows.length} SKUs
        </span>
        <span>
          OVG units <b className="text-ink">{totals.units.toLocaleString()}</b>
        </span>
        <span>
          OVG $ <b className="text-ink">{fmtMoney(totals.msrp)}</b>
        </span>
        <span>
          Avg assets <b className="text-ink">{totals.avgPct}%</b>
        </span>
        <span>
          Pending reviews <b className="text-ink">{totals.pending}</b>
        </span>
        <span className="ml-auto text-[#b3aa99]">
          Click a row for its team brief · the Review cell for its board
        </span>
      </div>

      {/* Sheet */}
      <div className="px-6 pb-12 overflow-x-auto">
        <table className="w-full border-collapse mt-3 min-w-[1100px]">
          <thead>
            <tr>
              <th className="th th-sort" onClick={() => onSort("style")}>
                Style{arrow("style")}
              </th>
              <th className="th th-sort" onClick={() => onSort("team")}>
                Team{arrow("team")}
              </th>
              <th className="th th-sort" onClick={() => onSort("phase")}>
                Phase{arrow("phase")}
              </th>
              <th className="th th-sort text-right" onClick={() => onSort("units")}>
                Units{arrow("units")}
              </th>
              <th className="th th-sort text-right" onClick={() => onSort("msrp")}>
                Ovg ${arrow("msrp")}
              </th>
              <th className="th text-center">PDP</th>
              <th className="th text-center">Paid</th>
              <th className="th text-center">UGC</th>
              <th className="th th-sort" onClick={() => onSort("pct")}>
                Assets{arrow("pct")}
              </th>
              <th className="th text-center">Brief</th>
              <th className="th th-sort text-center" onClick={() => onSort("pending")}>
                Review{arrow("pending")}
              </th>
              <th className="th text-center">Links</th>
              <th className="th">Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.productId}
                onClick={() =>
                  router.push(
                    `/briefs?style=${r.styleNumber}&tab=teams&team=${encodeURIComponent(r.team)}`,
                  )
                }
                title="Open this team’s brief card"
                className="hover:bg-[#fbf9f4] align-top cursor-pointer"
              >
                <td className="px-2 py-1.5 border-b border-line text-[#3f3a32] whitespace-nowrap">
                  <span className="font-mono text-[10px] text-muted mr-1">
                    {r.styleNumber}
                  </span>
                  {r.styleName}
                  {r.isHero && <span className="text-gold ml-1">★</span>}
                </td>
                <td className="px-2 py-1.5 border-b border-line font-semibold whitespace-nowrap">
                  {r.team}
                </td>
                <td className="px-2 py-1.5 border-b border-line font-mono text-[11px] text-muted whitespace-nowrap">
                  {r.phase}
                </td>
                <td className="px-2 py-1.5 border-b border-line text-right font-mono text-[11.5px] tabular-nums">
                  {r.units == null ? "—" : r.units.toLocaleString()}
                </td>
                <td className="px-2 py-1.5 border-b border-line text-right font-mono text-[11.5px] tabular-nums">
                  {r.msrpFlagged && r.msrp == null ? (
                    <span className="text-[#B06A1F]" title="MSRP placeholder — verify">
                      ⚠ —
                    </span>
                  ) : (
                    fmtMoney(r.msrp)
                  )}
                </td>
                <Ratio ready={r.pdpReady} total={r.pdpTotal} />
                <Ratio ready={r.paidReady} total={r.paidTotal} />
                <Ratio ready={r.ugcReady} total={r.ugcTotal} muted />
                <td className="px-2 py-1.5 border-b border-line min-w-[120px]">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-line rounded overflow-hidden">
                      <div
                        className={`h-1.5 rounded ${r.pct === 100 ? "bg-ok" : "bg-gold"}`}
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[10px] text-muted w-8 text-right">
                      {r.reqTotal ? `${r.pct}%` : "—"}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5 border-b border-line text-center">
                  {r.briefStatus ? (
                    <span className={briefPill(r.briefStatus)}>
                      {BRIEF_LABEL[r.briefStatus]}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-[#c4bcab]">—</span>
                  )}
                </td>
                <td
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/reviews?style=${r.styleNumber}&product=${r.productId}`,
                    );
                  }}
                  title="Open this SKU’s review board"
                  className="px-2 py-1.5 border-b border-line text-center font-mono text-[11px] hover:bg-[#f3eee2]"
                >
                  {r.pendingReviews > 0 ? (
                    <span className="text-warn">{r.pendingReviews} ⏳</span>
                  ) : r.approvedReviews > 0 ? (
                    <span className="text-ok">{r.approvedReviews} ✓</span>
                  ) : (
                    <span className="text-[#c4bcab]">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5 border-b border-line text-center font-mono text-[11px] text-muted">
                  {r.linkCount || "—"}
                </td>
                <td className="px-2 py-1.5 border-b border-line text-[11px] text-[#5a544a] max-w-[200px]">
                  <span className="line-clamp-2" title={r.notes ?? ""}>
                    {r.notes || ""}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-sm text-muted">
                  No SKUs match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Ratio({
  ready,
  total,
  muted,
}: {
  ready: number;
  total: number;
  muted?: boolean;
}) {
  const complete = total > 0 && ready === total;
  return (
    <td className="px-2 py-1.5 border-b border-line text-center font-mono text-[11px] whitespace-nowrap">
      {total === 0 ? (
        <span className="text-[#c4bcab]">—</span>
      ) : (
        <span
          className={
            complete ? "text-ok font-semibold" : muted ? "text-muted" : "text-ink"
          }
        >
          {ready}/{total}
        </span>
      )}
    </td>
  );
}

function briefPill(status: BriefStatus) {
  return `font-mono text-[9px] uppercase tracking-[0.04em] px-1.5 py-0.5 rounded border ${
    status === "delivered"
      ? "bg-okbg text-ok border-[#a9dcc2]"
      : status === "ready"
        ? "bg-warnbg text-warn border-[#ecd49a]"
        : "bg-neutralbg text-neutral border-[#d8d1c2]"
  }`;
}
