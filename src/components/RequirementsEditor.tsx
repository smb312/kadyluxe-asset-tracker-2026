"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ASSET_TYPE_LABEL } from "@/lib/assets";
import type { AssetSlot, AssetType, Style } from "@/lib/types";

type Mode = "required" | "optional" | "off";

// Per-slot state for the selected style: required / optional / off (no row).
function modeOf(present: boolean, required: boolean): Mode {
  if (!present) return "off";
  return required ? "required" : "optional";
}

const TYPE_ORDER: AssetType[] = ["pdp", "paid_social", "ugc"];

export function RequirementsEditor({
  styles,
  slots,
}: {
  styles: Style[];
  slots: AssetSlot[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [styleNumber, setStyleNumber] = useState<number>(
    styles[0]?.style_number ?? 0,
  );
  const [modes, setModes] = useState<Record<number, Mode>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const slotsByType = useMemo(() => {
    const m = new Map<AssetType, AssetSlot[]>();
    for (const s of slots) {
      if (!m.has(s.asset_type)) m.set(s.asset_type, []);
      m.get(s.asset_type)!.push(s);
    }
    return m;
  }, [slots]);

  // Load the current requirements whenever the chosen style changes.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMsg(null);
      setErr(null);
      const { data, error } = await supabase
        .from("style_requirements")
        .select("asset_slot_id, is_required")
        .eq("style_number", styleNumber);
      if (cancelled) return;
      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }
      const next: Record<number, Mode> = {};
      for (const s of slots) next[s.id] = "off";
      for (const r of data ?? [])
        next[r.asset_slot_id] = r.is_required ? "required" : "optional";
      setModes(next);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [styleNumber, slots, supabase]);

  async function setMode(slot: AssetSlot, mode: Mode) {
    const prev = modes[slot.id];
    setModes((m) => ({ ...m, [slot.id]: mode }));
    setMsg(null);
    setErr(null);

    let error;
    if (mode === "off") {
      ({ error } = await supabase
        .from("style_requirements")
        .delete()
        .eq("style_number", styleNumber)
        .eq("asset_slot_id", slot.id));
    } else {
      ({ error } = await supabase.from("style_requirements").upsert(
        {
          style_number: styleNumber,
          asset_slot_id: slot.id,
          is_required: mode === "required",
        },
        { onConflict: "style_number,asset_slot_id" },
      ));
    }

    if (error) {
      setModes((m) => ({ ...m, [slot.id]: prev })); // rollback
      setErr(error.message);
    } else {
      setMsg(`Saved “${slot.label}” → ${mode}.`);
    }
  }

  const styleName =
    styles.find((s) => s.style_number === styleNumber)?.name ?? "";

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <label className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
          Style
        </label>
        <select
          value={styleNumber}
          onChange={(e) => setStyleNumber(Number(e.target.value))}
          className="text-sm px-2.5 py-1.5 border border-line rounded bg-white
            focus:outline-none focus:border-gold min-w-[260px]"
        >
          {styles.map((s) => (
            <option key={s.style_number} value={s.style_number}>
              {s.style_number} — {s.name}
              {s.is_hero ? " ★" : ""}
            </option>
          ))}
        </select>
      </div>

      {err && (
        <p className="text-sm text-bad bg-badbg border border-[#e7c0cb] rounded p-2 mb-3">
          {err}
        </p>
      )}
      {msg && (
        <p className="text-sm text-ok bg-okbg border border-[#a9dcc2] rounded p-2 mb-3">
          {msg}
        </p>
      )}

      <div className={loading ? "opacity-50 pointer-events-none" : ""}>
        {TYPE_ORDER.map((type) => {
          const list = slotsByType.get(type) ?? [];
          if (list.length === 0) return null;
          return (
            <div key={type} className="mb-5">
              <div className="font-disp uppercase font-bold text-base mb-1.5">
                {ASSET_TYPE_LABEL[type]}
              </div>
              <div className="border border-line rounded-lg overflow-hidden bg-white">
                {list.map((slot, i) => (
                  <div
                    key={slot.id}
                    className={`flex items-center justify-between px-3 py-2 ${
                      i > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <div>
                      <span className="text-sm font-medium">{slot.label}</span>
                      <span className="font-mono text-[10px] text-muted ml-2">
                        {slot.code}
                      </span>
                    </div>
                    <ModeToggle
                      value={modes[slot.id] ?? "off"}
                      onChange={(m) => setMode(slot, m)}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="font-mono text-[10px] text-muted mt-2">
        Editing requirements for <b className="text-ink">{styleName}</b>.
        Changes save immediately and are safe — turning a slot{" "}
        <b className="text-ink">Off</b> only removes the requirement; any saved
        status or links for that slot are kept in the database.
      </p>
    </div>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (m: Mode) => void;
}) {
  const opts: { v: Mode; label: string }[] = [
    { v: "required", label: "Required" },
    { v: "optional", label: "Optional" },
    { v: "off", label: "Off" },
  ];
  return (
    <div className="flex border border-line rounded overflow-hidden">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`font-mono text-[10px] uppercase tracking-[0.04em] px-2.5 py-1.5
            ${
              value === o.v
                ? o.v === "off"
                  ? "bg-muted text-white"
                  : "bg-ink text-white"
                : "bg-white text-muted hover:text-ink"
            }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
