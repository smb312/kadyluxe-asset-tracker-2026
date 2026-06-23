"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  AssetSlot,
  AssetType,
  BriefLink,
  BriefLinkKind,
  BriefStatus,
  Style,
  StyleBrief,
  StyleRequirement,
} from "@/lib/types";

const KIND_LABEL: Record<BriefLinkKind, string> = {
  styling_guide: "Styling guide (Slides)",
  product_photos: "Product photos (Drive)",
  model_reference: "Model reference",
  pdf: "PDF / deck",
  other: "Other",
};
const KIND_ORDER: BriefLinkKind[] = [
  "styling_guide",
  "product_photos",
  "model_reference",
  "pdf",
  "other",
];

const STATUS_LABEL: Record<BriefStatus, string> = {
  draft: "Draft",
  ready: "Ready for Olivia",
  delivered: "Delivered",
};

const TYPE_LABEL: Record<string, string> = {
  pdp: "PDP shots",
  paid_social: "Paid Social",
  ugc: "UGC",
};
const TYPE_ORDER: AssetType[] = ["pdp", "paid_social", "ugc"];

function emptyBrief(style_number: number): StyleBrief {
  return {
    style_number,
    model_notes: "",
    lifestyle_environment: "",
    model_styling_notes: "",
    product_feel_notes: "",
    extra_notes: "",
    status: "draft",
    updated_at: "",
  };
}

export function BriefsEditor({
  styles,
  slots,
  requirements,
  teamsByStyle,
  briefs,
  links,
}: {
  styles: Style[];
  slots: AssetSlot[];
  requirements: StyleRequirement[];
  teamsByStyle: Record<number, string[]>;
  briefs: StyleBrief[];
  links: BriefLink[];
}) {
  const supabase = useMemo(() => createClient(), []);

  const [styleNumber, setStyleNumber] = useState<number>(
    styles[0]?.style_number ?? 0,
  );
  const [briefMap, setBriefMap] = useState<Record<number, StyleBrief>>(() => {
    const m: Record<number, StyleBrief> = {};
    for (const b of briefs) m[b.style_number] = b;
    return m;
  });
  const [linkList, setLinkList] = useState<BriefLink[]>(links);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [newLink, setNewLink] = useState({
    kind: "styling_guide" as BriefLinkKind,
    title: "",
    url: "",
    team: "", // "" = all teams
  });

  const slotsById = useMemo(() => {
    const m = new Map<number, AssetSlot>();
    for (const s of slots) m.set(s.id, s);
    return m;
  }, [slots]);

  // Required + optional shots for a style, grouped by type (for the shot list).
  const shotsByStyle = useMemo(() => {
    const m = new Map<number, { slot: AssetSlot; required: boolean }[]>();
    for (const r of requirements) {
      const slot = slotsById.get(r.asset_slot_id);
      if (!slot || slot.level !== "product") continue;
      if (!m.has(r.style_number)) m.set(r.style_number, []);
      m.get(r.style_number)!.push({ slot, required: r.is_required });
    }
    for (const arr of m.values()) arr.sort((a, b) => a.slot.sort - b.slot.sort);
    return m;
  }, [requirements, slotsById]);

  const brief = briefMap[styleNumber] ?? emptyBrief(styleNumber);
  const teams = teamsByStyle[styleNumber] ?? [];
  const styleName =
    styles.find((s) => s.style_number === styleNumber)?.name ?? "";
  const styleLinks = linkList.filter((l) => l.style_number === styleNumber);

  function setField(field: keyof StyleBrief, value: string) {
    setBriefMap((m) => ({
      ...m,
      [styleNumber]: { ...(m[styleNumber] ?? emptyBrief(styleNumber)), [field]: value },
    }));
  }

  async function saveBrief(next?: Partial<StyleBrief>) {
    const current = { ...(briefMap[styleNumber] ?? emptyBrief(styleNumber)), ...next };
    setErr(null);
    const { error } = await supabase.from("style_briefs").upsert(
      {
        style_number: styleNumber,
        model_notes: current.model_notes,
        lifestyle_environment: current.lifestyle_environment,
        model_styling_notes: current.model_styling_notes,
        product_feel_notes: current.product_feel_notes,
        extra_notes: current.extra_notes,
        status: current.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "style_number" },
    );
    if (error) setErr(error.message);
    else setMsg("Brief saved.");
  }

  async function setStatus(status: BriefStatus) {
    setBriefMap((m) => ({
      ...m,
      [styleNumber]: { ...(m[styleNumber] ?? emptyBrief(styleNumber)), status },
    }));
    await saveBrief({ status });
  }

  async function addLink() {
    const url = newLink.url.trim();
    if (!url) return;
    setErr(null);
    const row = {
      style_number: styleNumber,
      team: newLink.team || null,
      kind: newLink.kind,
      title: newLink.title.trim() || KIND_LABEL[newLink.kind],
      url,
    };
    const { data, error } = await supabase
      .from("brief_links")
      .insert(row)
      .select()
      .single();
    if (error || !data) {
      setErr(error?.message ?? "Could not add link.");
      return;
    }
    setLinkList((l) => [...l, data as BriefLink]);
    setNewLink({ kind: newLink.kind, title: "", url: "", team: "" });
    setMsg("Link added.");
  }

  async function deleteLink(id: number) {
    const snapshot = linkList;
    setLinkList((l) => l.filter((x) => x.id !== id));
    const { error } = await supabase.from("brief_links").delete().eq("id", id);
    if (error) {
      setLinkList(snapshot);
      setErr(error.message);
    }
  }

  function buildBriefText(): string {
    const lines: string[] = [];
    lines.push(`KADYLUXE — PDP CREATIVE BRIEF`);
    lines.push(`Style ${styleNumber} — ${styleName}`);
    if (teams.length) lines.push(`Teams: ${teams.join(", ")}`);
    lines.push(`Status: ${STATUS_LABEL[brief.status]}`);
    lines.push("");

    const shots = shotsByStyle.get(styleNumber) ?? [];
    for (const type of TYPE_ORDER) {
      const inType = shots.filter((s) => s.slot.asset_type === type);
      if (!inType.length) continue;
      lines.push(`${TYPE_LABEL[type].toUpperCase()}:`);
      for (const s of inType)
        lines.push(`  - ${s.slot.label}${s.required ? "" : " (optional)"}`);
    }
    lines.push("");

    const section = (label: string, val: string | null) => {
      lines.push(`${label}:`);
      lines.push(val && val.trim() ? val.trim() : "  —");
      lines.push("");
    };
    section("MODEL TO USE", brief.model_notes);
    section("LIFESTYLE SHOT ENVIRONMENT", brief.lifestyle_environment);
    section("MODEL STYLING (outside the product)", brief.model_styling_notes);
    section("PRODUCT LOOK & FEEL", brief.product_feel_notes);
    if (brief.extra_notes?.trim()) section("NOTES", brief.extra_notes);

    if (styleLinks.length) {
      lines.push("RESOURCES / LINKS:");
      for (const kind of KIND_ORDER) {
        const inKind = styleLinks.filter((l) => l.kind === kind);
        if (!inKind.length) continue;
        lines.push(`  ${KIND_LABEL[kind]}:`);
        for (const l of inKind)
          lines.push(
            `    - ${l.title}${l.team ? ` [${l.team}]` : ""}: ${l.url}`,
          );
      }
    }
    return lines.join("\n");
  }

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(buildBriefText());
      setMsg("Brief copied to clipboard — paste it to Olivia.");
    } catch {
      setErr("Couldn't access the clipboard. Select the text manually.");
    }
  }

  const shots = shotsByStyle.get(styleNumber) ?? [];

  // Coverage overview across every style (live as you edit).
  const overview = useMemo(
    () =>
      styles.map((s) => {
        const b = briefMap[s.style_number];
        const status: BriefStatus = b?.status ?? "draft";
        const core = [
          b?.model_notes,
          b?.lifestyle_environment,
          b?.model_styling_notes,
          b?.product_feel_notes,
        ];
        const filled = core.filter((v) => (v ?? "").trim()).length;
        const linkCount = linkList.filter(
          (l) => l.style_number === s.style_number,
        ).length;
        const teamCount = (teamsByStyle[s.style_number] ?? []).length;
        return { s, status, filled, linkCount, teamCount };
      }),
    [styles, briefMap, linkList, teamsByStyle],
  );

  function exportCsv() {
    const rows: string[][] = [
      ["Style #", "Name", "Hero", "Status", "Fields filled (of 4)", "Links", "Teams"],
    ];
    for (const o of overview)
      rows.push([
        String(o.s.style_number),
        o.s.name,
        o.s.is_hero ? "yes" : "",
        STATUS_LABEL[o.status],
        String(o.filled),
        String(o.linkCount),
        String(o.teamCount),
      ]);
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "kadyluxe-briefs.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusPill = (status: BriefStatus) =>
    `font-mono text-[9px] uppercase tracking-[0.04em] px-1.5 py-0.5 rounded border ${
      status === "delivered"
        ? "bg-okbg text-ok border-[#a9dcc2]"
        : status === "ready"
          ? "bg-warnbg text-warn border-[#ecd49a]"
          : "bg-neutralbg text-neutral border-[#d8d1c2]"
    }`;

  return (
    <div className="max-w-4xl">
      {/* Coverage overview — all briefs at a glance */}
      <details className="mb-5 border border-line rounded-lg bg-white" open>
        <summary className="cursor-pointer px-3 py-2 flex items-center gap-2">
          <span className="font-disp uppercase font-bold text-base">
            Coverage — all briefs
          </span>
          <span className="font-mono text-[10px] text-muted">
            {overview.filter((o) => o.status === "delivered").length} delivered ·{" "}
            {overview.filter((o) => o.status === "ready").length} ready ·{" "}
            {overview.filter((o) => o.status === "draft").length} draft
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              exportCsv();
            }}
            className="ml-auto font-mono text-[10px] uppercase tracking-[0.06em]
              px-2.5 py-1 rounded border border-line text-muted hover:text-ink"
          >
            Export CSV
          </button>
        </summary>
        <div className="max-h-72 overflow-auto border-t border-line">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-paper">
              <tr>
                <th className="th">Style</th>
                <th className="th text-center">Status</th>
                <th className="th text-center">Fields</th>
                <th className="th text-center">Links</th>
                <th className="th text-center">Teams</th>
              </tr>
            </thead>
            <tbody>
              {overview.map((o) => (
                <tr
                  key={o.s.style_number}
                  onClick={() => {
                    setStyleNumber(o.s.style_number);
                    setMsg(null);
                    setErr(null);
                  }}
                  className={`cursor-pointer hover:bg-[#fbf9f4] ${
                    o.s.style_number === styleNumber ? "bg-[#fbf9f4]" : ""
                  }`}
                >
                  <td className="px-2 py-1.5 border-b border-line text-sm">
                    <span className="font-mono text-[11px] text-muted mr-1">
                      {o.s.style_number}
                    </span>
                    {o.s.name}
                    {o.s.is_hero ? " ★" : ""}
                  </td>
                  <td className="px-2 py-1.5 border-b border-line text-center">
                    <span className={statusPill(o.status)}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 border-b border-line text-center font-mono text-[11px]">
                    {o.filled}/4
                  </td>
                  <td className="px-2 py-1.5 border-b border-line text-center font-mono text-[11px]">
                    {o.linkCount}
                  </td>
                  <td className="px-2 py-1.5 border-b border-line text-center font-mono text-[11px]">
                    {o.teamCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {/* Style picker + status */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <label className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
          Style
        </label>
        <select
          value={styleNumber}
          onChange={(e) => {
            setStyleNumber(Number(e.target.value));
            setMsg(null);
            setErr(null);
          }}
          className="text-sm px-2.5 py-1.5 border border-line rounded bg-white
            focus:outline-none focus:border-gold min-w-[280px]"
        >
          {styles.map((s) => (
            <option key={s.style_number} value={s.style_number}>
              {s.style_number} — {s.name}
              {s.is_hero ? " ★" : ""}
            </option>
          ))}
        </select>

        <div className="flex border border-line rounded overflow-hidden ml-auto">
          {(["draft", "ready", "delivered"] as BriefStatus[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatus(st)}
              className={`font-mono text-[10px] uppercase tracking-[0.04em] px-2.5 py-1.5
                ${
                  brief.status === st
                    ? st === "ready"
                      ? "bg-warn text-white"
                      : st === "delivered"
                        ? "bg-ok text-white"
                        : "bg-ink text-white"
                    : "bg-white text-muted hover:text-ink"
                }`}
            >
              {STATUS_LABEL[st]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copyBrief}
          className="font-mono text-[10px] uppercase tracking-[0.06em] px-3 py-1.5
            rounded border border-gold text-ink hover:bg-gold/20"
        >
          Copy brief for Olivia
        </button>
      </div>

      {teams.length > 0 && (
        <p className="font-mono text-[10px] text-muted mb-3">
          Teams running this style: {teams.join(" · ")}
        </p>
      )}

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

      <div className="grid md:grid-cols-2 gap-4">
        {/* Left: brief fields */}
        <div className="space-y-4">
          <Field
            label="Model to use"
            placeholder="Which model / look Olivia should generate the product on…"
            value={brief.model_notes ?? ""}
            onChange={(v) => setField("model_notes", v)}
            onBlur={() => saveBrief()}
          />
          <Field
            label="Lifestyle shot environment"
            placeholder="Setting / backdrop for the lifestyle shot (e.g., cozy cabin, stadium tailgate)…"
            value={brief.lifestyle_environment ?? ""}
            onChange={(v) => setField("lifestyle_environment", v)}
            onBlur={() => saveBrief()}
          />
          <Field
            label="Model styling (outside the product)"
            placeholder="How the model is styled around the product — bottoms, shoes, hair, accessories…"
            value={brief.model_styling_notes ?? ""}
            onChange={(v) => setField("model_styling_notes", v)}
            onBlur={() => saveBrief()}
          />
          <Field
            label="Product look & feel"
            placeholder="Fabric, fit, drape, texture — context so the AI knows the product…"
            value={brief.product_feel_notes ?? ""}
            onChange={(v) => setField("product_feel_notes", v)}
            onBlur={() => saveBrief()}
          />
          <Field
            label="Other notes"
            placeholder="Anything else Olivia needs…"
            value={brief.extra_notes ?? ""}
            onChange={(v) => setField("extra_notes", v)}
            onBlur={() => saveBrief()}
          />
        </div>

        {/* Right: shots needed + links */}
        <div className="space-y-4">
          <div className="border border-line rounded-lg bg-white p-3">
            <div className="font-disp uppercase font-bold text-base mb-1">
              PDP shots needed
            </div>
            <p className="font-mono text-[10px] text-muted mb-2">
              Pulled live from this style&apos;s requirements (edit on the
              Requirements page).
            </p>
            {shots.length === 0 ? (
              <p className="text-sm text-muted">No shots set for this style.</p>
            ) : (
              TYPE_ORDER.map((type) => {
                const inType = shots.filter((s) => s.slot.asset_type === type);
                if (!inType.length) return null;
                return (
                  <div key={type} className="mb-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                      {TYPE_LABEL[type]}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {inType.map((s) => (
                        <span
                          key={s.slot.id}
                          className={`font-mono text-[11px] px-2 py-0.5 rounded border ${
                            s.required
                              ? "border-line"
                              : "border-dashed border-line text-muted"
                          }`}
                        >
                          {s.slot.label}
                          {s.required ? "" : " (opt)"}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Links */}
          <div className="border border-line rounded-lg bg-white p-3">
            <div className="font-disp uppercase font-bold text-base mb-2">
              Styling guides & assets
            </div>

            {styleLinks.length === 0 && (
              <p className="text-sm text-muted mb-2">
                No links yet. Add Google Slides styling guides, Drive product
                photos, model refs, or PDFs below.
              </p>
            )}

            {KIND_ORDER.map((kind) => {
              const inKind = styleLinks.filter((l) => l.kind === kind);
              if (!inKind.length) return null;
              return (
                <div key={kind} className="mb-2.5">
                  <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted mb-1">
                    {KIND_LABEL[kind]}
                  </div>
                  <ul className="space-y-1">
                    {inKind.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ink underline truncate"
                          title={l.url}
                        >
                          {l.title}
                        </a>
                        {l.team && (
                          <span className="font-mono text-[9px] uppercase bg-paper border border-line rounded px-1 py-0.5 text-muted shrink-0">
                            {l.team}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteLink(l.id)}
                          title="Delete link"
                          className="ml-auto text-muted hover:text-bad shrink-0"
                        >
                          🗑
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {/* Add link */}
            <div className="border-t border-line pt-2.5 mt-1 space-y-2">
              <div className="flex gap-2">
                <select
                  value={newLink.kind}
                  onChange={(e) =>
                    setNewLink((n) => ({
                      ...n,
                      kind: e.target.value as BriefLinkKind,
                    }))
                  }
                  className="text-[12px] px-2 py-1.5 border border-line rounded bg-white
                    focus:outline-none focus:border-gold"
                >
                  {KIND_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <select
                  value={newLink.team}
                  onChange={(e) =>
                    setNewLink((n) => ({ ...n, team: e.target.value }))
                  }
                  className="text-[12px] px-2 py-1.5 border border-line rounded bg-white
                    focus:outline-none focus:border-gold flex-1 min-w-0"
                >
                  <option value="">All teams</option>
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={newLink.title}
                onChange={(e) =>
                  setNewLink((n) => ({ ...n, title: e.target.value }))
                }
                placeholder="Label (optional)"
                className="w-full text-[12px] px-2 py-1.5 border border-line rounded
                  focus:outline-none focus:border-gold"
              />
              <div className="flex gap-2">
                <input
                  value={newLink.url}
                  onChange={(e) =>
                    setNewLink((n) => ({ ...n, url: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && addLink()}
                  placeholder="Paste Google Slides / Drive / PDF URL…"
                  className="flex-1 min-w-0 text-[12px] px-2 py-1.5 border border-line rounded
                    focus:outline-none focus:border-gold"
                />
                <button
                  type="button"
                  disabled={!newLink.url.trim()}
                  onClick={addLink}
                  className="font-mono text-[10px] uppercase tracking-[0.04em] px-3 py-1.5
                    rounded bg-ink text-white disabled:opacity-40"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted block mb-1">
        {label}
      </label>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={3}
        className="w-full text-sm px-2.5 py-2 border border-line rounded bg-white
          focus:outline-none focus:border-gold resize-y"
      />
    </div>
  );
}
