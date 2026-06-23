"use client";

export type ReadyFilter = "" | "gap" | "done";

export interface ControlsState {
  q: string;
  style: string;
  phase: string;
  ready: ReadyFilter;
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex border border-line rounded overflow-hidden">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`font-mono text-[11px] uppercase tracking-[0.04em] px-2.5 py-1.5
            ${value === o.v ? "bg-ink text-white" : "bg-white text-muted hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Controls({
  state,
  styles,
  phases,
  shown,
  total,
  onChange,
}: {
  state: ControlsState;
  styles: string[];
  phases: string[];
  shown: number;
  total: number;
  onChange: (patch: Partial<ControlsState>) => void;
}) {
  return (
    <div className="flex gap-2.5 items-center flex-wrap px-6 py-2.5 bg-white border-b border-line sticky top-0 z-20">
      <input
        value={state.q}
        onChange={(e) => onChange({ q: e.target.value })}
        placeholder="Search team or style…"
        className="text-[12px] px-2.5 py-1.5 border border-line rounded min-w-[170px]
          focus:outline-none focus:border-gold"
      />
      <select
        value={state.style}
        onChange={(e) => onChange({ style: e.target.value })}
        className="text-[12px] px-2.5 py-1.5 border border-line rounded bg-white
          focus:outline-none focus:border-gold"
      >
        <option value="">All styles</option>
        {styles.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <Seg
        value={state.phase}
        onChange={(v) => onChange({ phase: v })}
        options={[
          { v: "", label: "All" },
          ...phases.map((p) => ({ v: p, label: p })),
        ]}
      />
      <Seg<ReadyFilter>
        value={state.ready}
        onChange={(v) => onChange({ ready: v })}
        options={[
          { v: "", label: "All" },
          { v: "gap", label: "Has gaps" },
          { v: "done", label: "Complete" },
        ]}
      />
      <span className="font-mono text-[11px] text-muted ml-auto">
        {shown} of {total} shown
      </span>
    </div>
  );
}
