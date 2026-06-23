"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ASSET_TYPE_LABEL } from "@/lib/assets";
import type { AssetSlot, AssetType, Style } from "@/lib/types";

type Mode = "required" | "optional" | "off";

const TYPE_ORDER: AssetType[] = ["pdp", "paid_social", "ugc"];

// Turn a human label into a unique snake_case code for asset_slots.code.
function slugify(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "shot"
  );
}

export function RequirementsEditor({
  styles,
  slots,
}: {
  styles: Style[];
  slots: AssetSlot[];
}) {
  const supabase = useMemo(() => createClient(), []);

  // The shot catalog lives in component state so add/rename/delete update the
  // UI immediately. Initialized from the server-loaded product-level slots.
  const [slotList, setSlotList] = useState<AssetSlot[]>(slots);

  const [styleNumber, setStyleNumber] = useState<number>(
    styles[0]?.style_number ?? 0,
  );
  const [modes, setModes] = useState<Record<number, Mode>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Inline label editing + per-group "add shot" inputs.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [addLabel, setAddLabel] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const slotsByType = useMemo(() => {
    const m = new Map<AssetType, AssetSlot[]>();
    for (const s of [...slotList].sort((a, b) => a.sort - b.sort)) {
      if (!m.has(s.asset_type)) m.set(s.asset_type, []);
      m.get(s.asset_type)!.push(s);
    }
    return m;
  }, [slotList]);

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
      for (const s of slotList) next[s.id] = "off";
      for (const r of data ?? [])
        next[r.asset_slot_id] = r.is_required ? "required" : "optional";
      setModes(next);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // slotList intentionally excluded: catalog edits patch `modes` directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleNumber, supabase]);

  // --- Per-style requirement (Required / Optional / Off) ---
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
      setModes((m) => ({ ...m, [slot.id]: prev }));
      setErr(error.message);
    } else {
      setMsg(`Saved “${slot.label}” → ${mode}.`);
    }
  }

  // --- Catalog: rename a shot's label (GLOBAL — affects every style) ---
  async function renameSlot(slot: AssetSlot, rawLabel: string) {
    const label = rawLabel.trim();
    setEditingId(null);
    if (!label || label === slot.label) return;
    setErr(null);
    setMsg(null);

    setSlotList((list) =>
      list.map((s) => (s.id === slot.id ? { ...s, label } : s)),
    );
    const { error } = await supabase
      .from("asset_slots")
      .update({ label })
      .eq("id", slot.id);
    if (error) {
      setSlotList((list) =>
        list.map((s) => (s.id === slot.id ? { ...s, label: slot.label } : s)),
      );
      setErr(error.message);
    } else {
      setMsg(`Renamed to “${label}” (applies to all styles using this shot).`);
    }
  }

  // --- Catalog: add a new shot to a group, and require it for this style ---
  async function addSlot(type: AssetType) {
    const label = (addLabel[type] ?? "").trim();
    if (!label) return;
    setBusy(true);
    setErr(null);
    setMsg(null);

    const existingCodes = new Set(slotList.map((s) => s.code));
    let code = slugify(label);
    let n = 2;
    while (existingCodes.has(code)) code = `${slugify(label)}_${n++}`;
    const sort = slotList.reduce((mx, s) => Math.max(mx, s.sort), 0) + 1;

    const { data, error } = await supabase
      .from("asset_slots")
      .insert({
        asset_type: type,
        code,
        label,
        level: "product",
        sort,
      })
      .select()
      .single();

    if (error || !data) {
      setErr(error?.message ?? "Could not add shot.");
      setBusy(false);
      return;
    }

    const newSlot = data as AssetSlot;
    setSlotList((list) => [...list, newSlot]);
    setAddLabel((a) => ({ ...a, [type]: "" }));

    // Require it for the current style by default.
    const { error: reqErr } = await supabase.from("style_requirements").upsert(
      {
        style_number: styleNumber,
        asset_slot_id: newSlot.id,
        is_required: true,
      },
      { onConflict: "style_number,asset_slot_id" },
    );
    setModes((m) => ({ ...m, [newSlot.id]: reqErr ? "off" : "required" }));
    setMsg(
      `Added “${label}” to ${ASSET_TYPE_LABEL[type]} and required it for this style.`,
    );
    setBusy(false);
  }

  // --- Catalog: delete a shot entirely (GLOBAL + clears saved data) ---
  async function deleteSlot(slot: AssetSlot) {
    const ok = window.confirm(
      `Delete the “${slot.label}” shot from the catalog?\n\n` +
        `This removes it from EVERY style and permanently deletes any saved ` +
        `status or final links for this shot across all products. This cannot ` +
        `be undone.`,
    );
    if (!ok) return;
    setErr(null);
    setMsg(null);
    const snapshot = slotList;
    setSlotList((list) => list.filter((s) => s.id !== slot.id));

    const { error } = await supabase
      .from("asset_slots")
      .delete()
      .eq("id", slot.id);
    if (error) {
      setSlotList(snapshot);
      setErr(error.message);
    } else {
      setMsg(`Deleted “${slot.label}” from the catalog.`);
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
          return (
            <div key={type} className="mb-5">
              <div className="font-disp uppercase font-bold text-base mb-1.5">
                {ASSET_TYPE_LABEL[type]}
              </div>
              <div className="border border-line rounded-lg overflow-hidden bg-white">
                {list.map((slot, i) => (
                  <div
                    key={slot.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 ${
                      i > 0 ? "border-t border-line" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {editingId === slot.id ? (
                        <input
                          autoFocus
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => renameSlot(slot, editingValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameSlot(slot, editingValue);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="text-sm px-2 py-1 border border-gold rounded
                            focus:outline-none min-w-0 flex-1"
                        />
                      ) : (
                        <>
                          <span className="text-sm font-medium truncate">
                            {slot.label}
                          </span>
                          <button
                            type="button"
                            title="Rename shot (applies to all styles)"
                            onClick={() => {
                              setEditingId(slot.id);
                              setEditingValue(slot.label);
                            }}
                            className="font-mono text-[11px] text-muted hover:text-ink"
                          >
                            ✎
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <ModeToggle
                        value={modes[slot.id] ?? "off"}
                        onChange={(m) => setMode(slot, m)}
                      />
                      <button
                        type="button"
                        title="Delete shot from catalog (all styles)"
                        onClick={() => deleteSlot(slot)}
                        className="font-mono text-[13px] leading-none text-muted
                          hover:text-bad px-1"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add a new shot to this group */}
                <div className="flex items-center gap-2 px-3 py-2 border-t border-line bg-paper/40">
                  <input
                    value={addLabel[type] ?? ""}
                    onChange={(e) =>
                      setAddLabel((a) => ({ ...a, [type]: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && addSlot(type)}
                    placeholder={`Add a ${ASSET_TYPE_LABEL[type]} shot…`}
                    className="text-sm px-2 py-1 border border-line rounded bg-white
                      focus:outline-none focus:border-gold flex-1 min-w-0"
                  />
                  <button
                    type="button"
                    disabled={busy || !(addLabel[type] ?? "").trim()}
                    onClick={() => addSlot(type)}
                    className="font-mono text-[10px] uppercase tracking-[0.04em]
                      px-3 py-1.5 rounded bg-ink text-white disabled:opacity-40"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="font-mono text-[10px] text-muted mt-2 leading-relaxed">
        <p>
          Editing requirements for <b className="text-ink">{styleName}</b>.
        </p>
        <p className="mt-1">
          <b className="text-ink">Required / Optional / Off</b> is per style.{" "}
          <b className="text-ink">Renaming</b>, <b className="text-ink">adding</b>,
          and <b className="text-ink">deleting</b> shots edit the shared catalog,
          so they apply to every style that uses the shot. Turning a shot{" "}
          <b className="text-ink">Off</b> only removes it from this style and
          keeps its data; <b className="text-ink">Delete</b> removes it
          everywhere and clears its saved statuses/links.
        </p>
      </div>
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
