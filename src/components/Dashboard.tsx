"use client";

export interface DashStats {
  pdpReady: number;
  pdpTotal: number;
  paidReady: number;
  paidTotal: number;
  ugcReady: number;
  ugcInProgress: number;
  ugcTotal: number;
}

function Tile({
  label,
  big,
  pct,
  sub,
}: {
  label: string;
  big: string;
  pct: number;
  sub: string;
}) {
  return (
    <div className="bg-[#262019] border border-[#3a342c] rounded-md px-3 py-2.5">
      <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#b7ad9c]">
        {label}
      </div>
      <div className="font-disp font-bold text-2xl leading-none my-1 text-white">
        {big}
      </div>
      <div className="h-[5px] rounded bg-[#3a342c] overflow-hidden">
        <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
      </div>
      <div className="font-mono text-[9.5px] text-[#9a9182] mt-1.5">{sub}</div>
    </div>
  );
}

// Live readiness tiles. Percentages recompute whenever statuses change because
// the parent recomputes `stats` from current state on every render.
export function Dashboard({ stats }: { stats: DashStats }) {
  const pct = (r: number, t: number) => (t ? Math.round((r / t) * 100) : 0);
  return (
    <div className="grid grid-cols-3 gap-2.5 mt-3.5">
      <Tile
        label="PDP shots"
        big={`${pct(stats.pdpReady, stats.pdpTotal)}%`}
        pct={pct(stats.pdpReady, stats.pdpTotal)}
        sub={`${stats.pdpReady} / ${stats.pdpTotal} shots ready`}
      />
      <Tile
        label="Paid Social"
        big={`${pct(stats.paidReady, stats.paidTotal)}%`}
        pct={pct(stats.paidReady, stats.paidTotal)}
        sub={`${stats.paidReady} / ${stats.paidTotal} assets ready`}
      />
      <Tile
        label="UGC (optional)"
        big={`${stats.ugcReady}`}
        pct={pct(stats.ugcReady, stats.ugcTotal)}
        sub={`${stats.ugcReady} ready · ${stats.ugcInProgress} in progress · optional`}
      />
    </div>
  );
}
