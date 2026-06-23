"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  AssetSlot,
  AssetType,
  BriefLink,
  BriefLinkKind,
  BriefStatus,
  ProductBrief,
  Style,
  StyleBrief,
  StyleRequirement,
  StyleTeam,
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
// Order the board groups so the actionable work sits up top.
const STATUS_ORDER: BriefStatus[] = ["ready", "draft", "delivered"];
const STATUS_DOT: Record<BriefStatus, string> = {
  draft: "bg-neutral",
  ready: "bg-warn",
  delivered: "bg-ok",
};

const TYPE_LABEL: Record<string, string> = {
  pdp: "PDP shots",
  paid_social: "Paid Social",
  ugc: "UGC",
};
const TYPE_ORDER: AssetType[] = ["pdp", "paid_social", "ugc"];

type TabKey = "brief" | "teams" | "assets" | "hub";
const TABS: { key: TabKey; label: string }[] = [
  { key: "brief", label: "Brief" },
  { key: "teams", label: "By team" },
  { key: "assets", label: "Assets" },
  { key: "hub", label: "Olivia hub" },
];

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

function emptyProductBrief(product_id: number): ProductBrief {
  return {
    product_id,
    model_notes: "",
    lifestyle_environment: "",
    model_styling_notes: "",
    notes: "",
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
  productBriefs,
  initialStyle,
  initialTab,
  initialTeam,
}: {
  styles: Style[];
  slots: AssetSlot[];
  requirements: StyleRequirement[];
  teamsByStyle: Record<number, StyleTeam[]>;
  briefs: StyleBrief[];
  links: BriefLink[];
  productBriefs: ProductBrief[];
  initialStyle?: number;
  initialTab?: TabKey;
  initialTeam?: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [styleNumber, setStyleNumber] = useState<number>(
    (initialStyle && styles.some((s) => s.style_number === initialStyle)
      ? initialStyle
      : styles[0]?.style_number) ?? 0,
  );
  const [tab, setTab] = useState<TabKey>(initialTab ?? "brief");
  const [highlightTeamId, setHighlightTeamId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<BriefStatus, boolean>>({
    draft: false,
    ready: false,
    delivered: false,
  });

  const [briefMap, setBriefMap] = useState<Record<number, StyleBrief>>(() => {
    const m: Record<number, StyleBrief> = {};
    for (const b of briefs) m[b.style_number] = b;
    return m;
  });
  const [linkList, setLinkList] = useState<BriefLink[]>(links);
  const [pbMap, setPbMap] = useState<Record<number, ProductBrief>>(() => {
    const m: Record<number, ProductBrief> = {};
    for (const pb of productBriefs) m[pb.product_id] = pb;
    return m;
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [newLink, setNewLink] = useState({
    kind: "styling_guide" as BriefLinkKind,
    title: "",
    url: "",
    team: "", // "" = all teams
  });
  const [uploading, setUploading] = useState(false);
  const [assetTeam, setAssetTeam] = useState(""); // "" = all teams
  const [newTeam, setNewTeam] = useState("");

  // Teams (= products) are editable in-app, so keep them in local state seeded
  // from the server prop.
  const [teamsMap, setTeamsMap] = useState<Record<number, StyleTeam[]>>(() => {
    const m: Record<number, StyleTeam[]> = {};
    for (const k of Object.keys(teamsByStyle)) {
      const n = Number(k);
      m[n] = [...teamsByStyle[n]];
    }
    return m;
  });

  const BUCKET = "brief-assets";
  const isImageLink = (l: BriefLink) =>
    !!l.storage_path || /\.(png|jpe?g|webp|gif)$/i.test(l.url);

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
  const teamList = teamsMap[styleNumber] ?? [];
  const teams = teamList.map((t) => t.team);
  const style = styles.find((s) => s.style_number === styleNumber);
  const styleName = style?.name ?? "";
  const styleLinks = linkList.filter((l) => l.style_number === styleNumber);

  // Per-team override helpers. A blank override inherits the style default.
  const pbOf = (productId: number) =>
    pbMap[productId] ?? emptyProductBrief(productId);
  const eff = (
    productId: number,
    field: keyof ProductBrief,
    fallback: string,
  ) => {
    const v = (pbMap[productId]?.[field] as string | null | undefined) ?? "";
    return v.trim() ? v : fallback;
  };

  function setPbField(
    productId: number,
    field: keyof ProductBrief,
    value: string,
  ) {
    setPbMap((m) => ({
      ...m,
      [productId]: { ...pbOf(productId), [field]: value },
    }));
  }

  async function savePb(productId: number) {
    const cur = pbOf(productId);
    setErr(null);
    const { error } = await supabase.from("product_briefs").upsert(
      {
        product_id: productId,
        model_notes: cur.model_notes,
        lifestyle_environment: cur.lifestyle_environment,
        model_styling_notes: cur.model_styling_notes,
        notes: cur.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id" },
    );
    if (error) setErr(error.message);
    else setMsg("Team detail saved.");
  }

  // ── Team (= product) management, by style ──────────────────────────────
  async function addTeam() {
    const name = newTeam.trim();
    if (!name) return;
    if (teamList.some((t) => t.team.toLowerCase() === name.toLowerCase())) {
      setErr(`“${name}” is already a team on this style.`);
      return;
    }
    setErr(null);
    const { data, error } = await supabase
      .from("products")
      .insert({ team: name, style_number: styleNumber, phase: "Backlog" })
      .select("id, team")
      .single();
    if (error || !data) {
      setErr(error?.message ?? "Could not add team.");
      return;
    }
    setTeamsMap((m) => ({
      ...m,
      [styleNumber]: [
        ...(m[styleNumber] ?? []),
        { product_id: data.id as number, team: data.team as string },
      ],
    }));
    setNewTeam("");
    setMsg(`Added team “${name}”.`);
  }

  async function renameTeam(productId: number, current: string, next: string) {
    const name = next.trim();
    if (!name || name === current) return;
    if (
      teamList.some(
        (t) =>
          t.product_id !== productId &&
          t.team.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setErr(`“${name}” is already a team on this style.`);
      return;
    }
    setErr(null);
    const { error } = await supabase
      .from("products")
      .update({ team: name })
      .eq("id", productId);
    if (error) {
      setErr(error.message);
      return;
    }
    // Keep asset tags that referenced the old team name in sync.
    await supabase
      .from("brief_links")
      .update({ team: name })
      .eq("style_number", styleNumber)
      .eq("team", current);
    setTeamsMap((m) => ({
      ...m,
      [styleNumber]: (m[styleNumber] ?? []).map((t) =>
        t.product_id === productId ? { ...t, team: name } : t,
      ),
    }));
    setLinkList((l) =>
      l.map((x) =>
        x.style_number === styleNumber && x.team === current
          ? { ...x, team: name }
          : x,
      ),
    );
    setMsg(`Renamed to “${name}”.`);
  }

  async function deleteTeam(productId: number, name: string) {
    if (
      !window.confirm(
        `Delete team “${name}” from this style?\n\nThis also removes its per-team brief details and any review assets uploaded for it. This can’t be undone.`,
      )
    )
      return;
    setErr(null);
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);
    if (error) {
      setErr(error.message);
      return;
    }
    // Assets tagged to this team become shared (team = null) rather than orphaned.
    await supabase
      .from("brief_links")
      .update({ team: null })
      .eq("style_number", styleNumber)
      .eq("team", name);
    setTeamsMap((m) => ({
      ...m,
      [styleNumber]: (m[styleNumber] ?? []).filter(
        (t) => t.product_id !== productId,
      ),
    }));
    setLinkList((l) =>
      l.map((x) =>
        x.style_number === styleNumber && x.team === name
          ? { ...x, team: null }
          : x,
      ),
    );
    setPbMap((m) => {
      const n = { ...m };
      delete n[productId];
      return n;
    });
    setMsg(`Deleted team “${name}”.`);
  }

  function setField(field: keyof StyleBrief, value: string) {
    setBriefMap((m) => ({
      ...m,
      [styleNumber]: {
        ...(m[styleNumber] ?? emptyBrief(styleNumber)),
        [field]: value,
      },
    }));
  }

  async function saveBrief(next?: Partial<StyleBrief>) {
    const current = {
      ...(briefMap[styleNumber] ?? emptyBrief(styleNumber)),
      ...next,
    };
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
      [styleNumber]: {
        ...(m[styleNumber] ?? emptyBrief(styleNumber)),
        status,
      },
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

  // Upload a PNG/JPG to Storage, then record it as a brief_link with its URL.
  async function uploadFile(file: File) {
    setUploading(true);
    setErr(null);
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${styleNumber}/${Date.now()}-${safe}`;

    const up = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (up.error) {
      setErr(
        up.error.message.includes("Bucket not found")
          ? "Storage isn't set up yet — run supabase/olivia_briefs.sql (section 5) first."
          : up.error.message,
      );
      setUploading(false);
      return;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { data, error } = await supabase
      .from("brief_links")
      .insert({
        style_number: styleNumber,
        team: newLink.team || null,
        kind: newLink.kind,
        title: file.name,
        url: pub.publicUrl,
        storage_path: path,
      })
      .select()
      .single();

    if (error || !data) {
      // Roll back the orphaned file if the row insert failed.
      await supabase.storage.from(BUCKET).remove([path]);
      setErr(error?.message ?? "Could not save the uploaded image.");
      setUploading(false);
      return;
    }
    setLinkList((l) => [...l, data as BriefLink]);
    setMsg("Image uploaded.");
    setUploading(false);
  }

  async function deleteLink(link: BriefLink) {
    const snapshot = linkList;
    setLinkList((l) => l.filter((x) => x.id !== link.id));
    if (link.storage_path) {
      await supabase.storage.from(BUCKET).remove([link.storage_path]);
    }
    const { error } = await supabase
      .from("brief_links")
      .delete()
      .eq("id", link.id);
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
    section("MODEL TO USE (default)", brief.model_notes);
    section("LIFESTYLE SHOT ENVIRONMENT (default)", brief.lifestyle_environment);
    section("MODEL STYLING (outside the product)", brief.model_styling_notes);
    section("PRODUCT LOOK & FEEL", brief.product_feel_notes);
    if (brief.extra_notes?.trim()) section("NOTES", brief.extra_notes);

    // Per-team breakdown (effective = team override, else the default above).
    if (teamList.length) {
      lines.push("PER-TEAM MODEL & ENVIRONMENT:");
      for (const t of teamList) {
        lines.push(`  ${t.team}:`);
        lines.push(
          `    Model: ${eff(t.product_id, "model_notes", brief.model_notes?.trim() || "—")}`,
        );
        lines.push(
          `    Environment: ${eff(t.product_id, "lifestyle_environment", brief.lifestyle_environment?.trim() || "—")}`,
        );
        const styling = eff(t.product_id, "model_styling_notes", "");
        if (styling) lines.push(`    Styling: ${styling}`);
      }
      lines.push("");
    }

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

  // Coverage overview across every style (live as you edit). Powers the rail.
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
        const teamCount = (teamsMap[s.style_number] ?? []).length;
        return { s, status, filled, linkCount, teamCount };
      }),
    [styles, briefMap, linkList, teamsMap],
  );

  const counts = useMemo(() => {
    const c: Record<BriefStatus, number> = { draft: 0, ready: 0, delivered: 0 };
    for (const o of overview) c[o.status]++;
    return c;
  }, [overview]);

  // Group the rail like a Monday board: by status, filtered by the search box.
  const railGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groups: Record<BriefStatus, typeof overview> = {
      draft: [],
      ready: [],
      delivered: [],
    };
    for (const o of overview) {
      if (
        q &&
        !`${o.s.style_number} ${o.s.name}`.toLowerCase().includes(q)
      )
        continue;
      groups[o.status].push(o);
    }
    return groups;
  }, [overview, search]);

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

  // Arriving from the All-SKUs sheet with ?team=… : open the By-team tab and
  // scroll/flash that team's card. Runs once on mount.
  useEffect(() => {
    if (!initialTeam) return;
    const t = (teamsMap[styleNumber] ?? []).find(
      (x) => x.team.toLowerCase() === initialTeam.toLowerCase(),
    );
    if (!t) return;
    setTab("teams");
    setHighlightTeamId(t.product_id);
    const raf = requestAnimationFrame(() => {
      document
        .getElementById(`team-${t.product_id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timer = setTimeout(() => setHighlightTeamId(null), 2600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assetLinks =
    assetTeam === ""
      ? styleLinks
      : styleLinks.filter((l) => !l.team || l.team === assetTeam);

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      {/* ─────────────── Left rail: the style board ─────────────── */}
      <aside className="w-full lg:w-[280px] lg:shrink-0 border border-line rounded-lg bg-white lg:sticky lg:top-4 overflow-hidden">
        <div className="px-3 pt-3 pb-2 border-b border-line">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-disp uppercase font-bold text-base">
              Styles
            </span>
            <span className="font-mono text-[10px] text-muted">
              {styles.length}
            </span>
            <button
              type="button"
              onClick={exportCsv}
              className="ml-auto font-mono text-[9px] uppercase tracking-[0.06em]
                px-2 py-1 rounded border border-line text-muted hover:text-ink"
            >
              Export CSV
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search style # or name…"
            className="w-full text-[12px] px-2.5 py-1.5 border border-line rounded
              focus:outline-none focus:border-gold"
          />
          <div className="flex gap-3 mt-2 font-mono text-[10px] text-muted">
            <span>
              <span className="text-warn">●</span> {counts.ready} ready
            </span>
            <span>
              <span className="text-neutral">●</span> {counts.draft} draft
            </span>
            <span>
              <span className="text-ok">●</span> {counts.delivered} done
            </span>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto">
          {STATUS_ORDER.map((status) => {
            const rows = railGroups[status];
            if (!rows.length) return null;
            const isCollapsed = collapsed[status];
            return (
              <div key={status}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [status]: !c[status] }))
                  }
                  className="w-full flex items-center gap-2 px-3 py-1.5 bg-paper
                    border-b border-line text-left"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                    {STATUS_LABEL[status]}
                  </span>
                  <span className="font-mono text-[10px] text-muted ml-auto">
                    {rows.length} {isCollapsed ? "▸" : "▾"}
                  </span>
                </button>
                {!isCollapsed &&
                  rows.map((o) => {
                    const on = o.s.style_number === styleNumber;
                    return (
                      <button
                        key={o.s.style_number}
                        type="button"
                        onClick={() => {
                          setStyleNumber(o.s.style_number);
                          setMsg(null);
                          setErr(null);
                        }}
                        className={`w-full text-left px-3 py-2 border-b border-line border-l-2
                          ${
                            on
                              ? "bg-[#fbf9f4] border-l-gold"
                              : "border-l-transparent hover:bg-[#fbf9f4]"
                          }`}
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-mono text-[10px] text-muted">
                            {o.s.style_number}
                          </span>
                          <span className="text-sm truncate flex-1">
                            {o.s.name}
                          </span>
                          {o.s.is_hero && (
                            <span className="text-gold text-[11px]">★</span>
                          )}
                        </div>
                        <div className="mt-1.5 h-1 bg-line rounded overflow-hidden">
                          <div
                            className="h-1 bg-gold rounded"
                            style={{ width: `${(o.filled / 4) * 100}%` }}
                          />
                        </div>
                        <div className="mt-1 font-mono text-[9px] text-muted">
                          {o.filled}/4 fields · {o.linkCount} links ·{" "}
                          {o.teamCount} team{o.teamCount === 1 ? "" : "s"}
                        </div>
                      </button>
                    );
                  })}
              </div>
            );
          })}
          {STATUS_ORDER.every((s) => railGroups[s].length === 0) && (
            <p className="px-3 py-4 text-sm text-muted">No styles match.</p>
          )}
        </div>
      </aside>

      {/* ─────────────── Right pane: the selected record ─────────────── */}
      <section className="flex-1 min-w-0 w-full">
        {/* Record header */}
        <div className="border border-line rounded-lg bg-white p-4 mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                Style {styleNumber}
                {style?.is_hero ? " · Hero ★" : ""}
              </div>
              <h2 className="font-disp font-bold uppercase text-[26px] leading-[0.95] mt-0.5 truncate">
                {styleName || "—"}
              </h2>
              {teams.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {teams.map((t) => (
                    <span
                      key={t}
                      className="font-mono text-[10px] uppercase bg-paper border border-line
                        rounded px-2 py-0.5 text-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex border border-line rounded overflow-hidden">
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
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mt-4 -mb-px">
            {TABS.map((t) => {
              const count =
                t.key === "teams"
                  ? teamList.length
                  : t.key === "assets"
                    ? styleLinks.length
                    : t.key === "brief"
                      ? shots.length
                      : undefined;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`font-mono text-[11px] uppercase tracking-[0.06em] px-3 py-2 rounded-t border
                    ${
                      tab === t.key
                        ? "bg-paper border-line border-b-paper text-ink"
                        : "bg-transparent border-transparent text-muted hover:text-ink"
                    }`}
                >
                  {t.label}
                  {count !== undefined && (
                    <span className="ml-1.5 text-muted">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
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

        {/* ─────────── Tab: Brief (style-level defaults) ─────────── */}
        {tab === "brief" && (
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <SectionCard
                title="Defaults — apply to all teams"
                subtitle="Set the baseline here. Any team can override Model & Environment on the “By team” tab."
              >
                <div className="space-y-4">
                  <Field
                    label="Model to use"
                    badge="Overridable per team"
                    placeholder="Default model / look for this style…"
                    value={brief.model_notes ?? ""}
                    onChange={(v) => setField("model_notes", v)}
                    onBlur={() => saveBrief()}
                  />
                  <Field
                    label="Lifestyle shot environment"
                    badge="Overridable per team"
                    placeholder="Default setting / backdrop for lifestyle shots…"
                    value={brief.lifestyle_environment ?? ""}
                    onChange={(v) => setField("lifestyle_environment", v)}
                    onBlur={() => saveBrief()}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Styling & product context"
                subtitle="Shared context so Olivia understands the product itself."
              >
                <div className="space-y-4">
                  <Field
                    label="Model styling (outside the product)"
                    placeholder="Bottoms, shoes, hair, accessories styled around the product…"
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
              </SectionCard>
            </div>

            {/* Shots needed */}
            <div className="space-y-4">
              <SectionCard
                title="PDP shots needed"
                subtitle="Live from this style’s requirements (edit on the Requirements page)."
              >
                {shots.length === 0 ? (
                  <p className="text-sm text-muted">
                    No shots set for this style.
                  </p>
                ) : (
                  TYPE_ORDER.map((type) => {
                    const inType = shots.filter(
                      (s) => s.slot.asset_type === type,
                    );
                    if (!inType.length) return null;
                    return (
                      <div key={type} className="mb-3 last:mb-0">
                        <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted mb-1.5">
                          {TYPE_LABEL[type]}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
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
              </SectionCard>
            </div>
          </div>
        )}

        {/* ─────────── Tab: By team (per-product overrides) ─────────── */}
        {tab === "teams" && (
          <div>
            <p className="text-sm text-muted mb-3">
              One card per team running this style. Rename a team inline, delete
              one you don’t need, or add a new colorway / team below. Leave an
              override blank to inherit the default from the <b>Brief</b> tab.
            </p>

            {/* Add a team */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <input
                value={newTeam}
                onChange={(e) => setNewTeam(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTeam()}
                placeholder="New team / colorway (e.g. Blue)"
                className="text-sm px-2.5 py-1.5 border border-line rounded bg-white
                  focus:outline-none focus:border-gold min-w-[220px]"
              />
              <button
                type="button"
                disabled={!newTeam.trim()}
                onClick={addTeam}
                className="font-mono text-[10px] uppercase tracking-[0.06em] px-3 py-1.5
                  rounded bg-ink text-white disabled:opacity-40"
              >
                + Add team
              </button>
            </div>

            {teamList.length === 0 ? (
              <div className="border border-line rounded-lg bg-white p-6 text-center text-sm text-muted">
                No teams run this style yet. Add the first one above.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {teamList.map((t) => (
                  <div
                    key={t.product_id}
                    id={`team-${t.product_id}`}
                    className={`border rounded-lg bg-white p-3 transition-shadow ${
                      highlightTeamId === t.product_id
                        ? "border-gold ring-2 ring-gold/40"
                        : "border-line"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        key={`${t.product_id}|${t.team}`}
                        defaultValue={t.team}
                        onBlur={(e) =>
                          renameTeam(t.product_id, t.team, e.target.value)
                        }
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.target as HTMLInputElement).blur()
                        }
                        title="Rename team"
                        className="font-disp uppercase font-bold text-base bg-transparent flex-1 min-w-0
                          border-b border-transparent hover:border-line focus:border-gold focus:outline-none"
                      />
                      <span className="font-mono text-[9px] uppercase text-muted border border-line rounded px-1.5 py-0.5 shrink-0">
                        #{t.product_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteTeam(t.product_id, t.team)}
                        title="Delete team"
                        className="text-muted hover:text-bad shrink-0"
                      >
                        🗑
                      </button>
                    </div>
                    <div className="space-y-3">
                      <OverrideField
                        label="Model"
                        def={brief.model_notes ?? ""}
                        value={
                          (pbMap[t.product_id]?.model_notes as string) ?? ""
                        }
                        onChange={(v) =>
                          setPbField(t.product_id, "model_notes", v)
                        }
                        onBlur={() => savePb(t.product_id)}
                      />
                      <OverrideField
                        label="Lifestyle environment"
                        def={brief.lifestyle_environment ?? ""}
                        value={
                          (pbMap[t.product_id]
                            ?.lifestyle_environment as string) ?? ""
                        }
                        onChange={(v) =>
                          setPbField(t.product_id, "lifestyle_environment", v)
                        }
                        onBlur={() => savePb(t.product_id)}
                      />
                      <OverrideField
                        label="Styling (optional)"
                        def={brief.model_styling_notes ?? ""}
                        value={
                          (pbMap[t.product_id]
                            ?.model_styling_notes as string) ?? ""
                        }
                        onChange={(v) =>
                          setPbField(t.product_id, "model_styling_notes", v)
                        }
                        onBlur={() => savePb(t.product_id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─────────── Tab: Assets & links ─────────── */}
        {tab === "assets" && (
          <div className="space-y-4">
            {/* Add panel */}
            <SectionCard
              title="Add a styling guide, photo set, ref or PDF"
              subtitle="Paste a Google Slides / Drive / PDF URL, or upload a PNG/JPG. Tag it to a team or leave it for all."
            >
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
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
                      focus:outline-none focus:border-gold"
                  >
                    <option value="">All teams</option>
                    {teams.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    value={newLink.title}
                    onChange={(e) =>
                      setNewLink((n) => ({ ...n, title: e.target.value }))
                    }
                    placeholder="Label (optional)"
                    className="flex-1 min-w-[140px] text-[12px] px-2 py-1.5 border border-line rounded
                      focus:outline-none focus:border-gold"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <input
                    value={newLink.url}
                    onChange={(e) =>
                      setNewLink((n) => ({ ...n, url: e.target.value }))
                    }
                    onKeyDown={(e) => e.key === "Enter" && addLink()}
                    placeholder="Paste Google Slides / Drive / PDF URL…"
                    className="flex-1 min-w-[200px] text-[12px] px-2 py-1.5 border border-line rounded
                      focus:outline-none focus:border-gold"
                  />
                  <button
                    type="button"
                    disabled={!newLink.url.trim()}
                    onClick={addLink}
                    className="font-mono text-[10px] uppercase tracking-[0.04em] px-3 py-1.5
                      rounded bg-ink text-white disabled:opacity-40"
                  >
                    + Add link
                  </button>
                  <label
                    className={`font-mono text-[10px] uppercase tracking-[0.04em] px-3 py-1.5
                      rounded border border-line cursor-pointer hover:border-gold
                      ${uploading ? "opacity-50 pointer-events-none" : "text-ink"}`}
                  >
                    {uploading ? "Uploading…" : "⬆ Upload PNG / JPG"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadFile(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </SectionCard>

            {/* Filter + grouped library */}
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                Showing
              </span>
              <select
                value={assetTeam}
                onChange={(e) => setAssetTeam(e.target.value)}
                className="text-[12px] px-2 py-1 border border-line rounded bg-white
                  focus:outline-none focus:border-gold"
              >
                <option value="">All teams</option>
                {teams.map((t) => (
                  <option key={t} value={t}>
                    {t} (+ shared)
                  </option>
                ))}
              </select>
              <span className="font-mono text-[10px] text-muted">
                {assetLinks.length} item{assetLinks.length === 1 ? "" : "s"}
              </span>
            </div>

            {assetLinks.length === 0 ? (
              <div className="border border-line rounded-lg bg-white p-6 text-center text-sm text-muted">
                No assets yet. Add styling guides, product photos, model refs or
                PDFs above.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {KIND_ORDER.map((kind) => {
                  const inKind = assetLinks.filter((l) => l.kind === kind);
                  if (!inKind.length) return null;
                  return (
                    <SectionCard key={kind} title={KIND_LABEL[kind]}>
                      <ul className="space-y-1.5">
                        {inKind.map((l) => (
                          <li
                            key={l.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            {isImageLink(l) && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <a
                                href={l.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <img
                                  src={l.url}
                                  alt={l.title}
                                  className="w-9 h-9 object-cover rounded border border-line shrink-0"
                                />
                              </a>
                            )}
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-ink underline truncate"
                              title={l.url}
                            >
                              {l.title}
                            </a>
                            {l.storage_path && (
                              <span className="font-mono text-[9px] uppercase text-gold shrink-0">
                                uploaded
                              </span>
                            )}
                            {l.team && (
                              <span className="font-mono text-[9px] uppercase bg-paper border border-line rounded px-1 py-0.5 text-muted shrink-0">
                                {l.team}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteLink(l)}
                              title="Delete link"
                              className="ml-auto text-muted hover:text-bad shrink-0"
                            >
                              🗑
                            </button>
                          </li>
                        ))}
                      </ul>
                    </SectionCard>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─────────── Tab: Olivia hub (read-only deliverable) ─────────── */}
        {tab === "hub" && (
          <div className="border border-line rounded-lg bg-white">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
              <div>
                <div className="font-disp uppercase font-bold text-lg leading-none">
                  Everything to shoot Style {styleNumber}
                </div>
                <p className="font-mono text-[10px] text-muted mt-1">
                  Read-only summary for the Olivia team — the brief, teams and
                  assets in one place.
                </p>
              </div>
              <button
                type="button"
                onClick={copyBrief}
                className="ml-auto font-mono text-[10px] uppercase tracking-[0.06em] px-3 py-1.5
                  rounded border border-gold text-ink hover:bg-gold/20"
              >
                Copy as text
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Shots */}
              <HubSection title="Shots needed">
                {shots.length === 0 ? (
                  <p className="text-sm text-muted">No shots set.</p>
                ) : (
                  <div className="flex flex-wrap gap-4">
                    {TYPE_ORDER.map((type) => {
                      const inType = shots.filter(
                        (s) => s.slot.asset_type === type,
                      );
                      if (!inType.length) return null;
                      return (
                        <div key={type}>
                          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted mb-1">
                            {TYPE_LABEL[type]}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
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
                    })}
                  </div>
                )}
              </HubSection>

              {/* Defaults */}
              <HubSection title="The brief">
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
                  <HubField label="Model" value={brief.model_notes} />
                  <HubField
                    label="Lifestyle environment"
                    value={brief.lifestyle_environment}
                  />
                  <HubField
                    label="Model styling"
                    value={brief.model_styling_notes}
                  />
                  <HubField
                    label="Product look & feel"
                    value={brief.product_feel_notes}
                  />
                  {brief.extra_notes?.trim() && (
                    <HubField label="Other notes" value={brief.extra_notes} />
                  )}
                </dl>
              </HubSection>

              {/* Per-team */}
              {teamList.length > 0 && (
                <HubSection title="By team">
                  <div className="grid md:grid-cols-2 gap-3">
                    {teamList.map((t) => {
                      const model = eff(
                        t.product_id,
                        "model_notes",
                        brief.model_notes?.trim() || "—",
                      );
                      const env = eff(
                        t.product_id,
                        "lifestyle_environment",
                        brief.lifestyle_environment?.trim() || "—",
                      );
                      const styling = eff(
                        t.product_id,
                        "model_styling_notes",
                        "",
                      );
                      return (
                        <div
                          key={t.product_id}
                          className="border border-line rounded p-2.5"
                        >
                          <div className="font-disp uppercase font-bold text-sm mb-1.5">
                            {t.team}
                          </div>
                          <dl className="space-y-1 text-sm">
                            <HubInline label="Model" value={model} />
                            <HubInline label="Environment" value={env} />
                            {styling && (
                              <HubInline label="Styling" value={styling} />
                            )}
                          </dl>
                        </div>
                      );
                    })}
                  </div>
                </HubSection>
              )}

              {/* Resources */}
              {styleLinks.length > 0 && (
                <HubSection title="Resources & assets">
                  <div className="space-y-3">
                    {KIND_ORDER.map((kind) => {
                      const inKind = styleLinks.filter((l) => l.kind === kind);
                      if (!inKind.length) return null;
                      return (
                        <div key={kind}>
                          <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted mb-1">
                            {KIND_LABEL[kind]}
                          </div>
                          <ul className="flex flex-wrap gap-2">
                            {inKind.map((l) => (
                              <li key={l.id}>
                                <a
                                  href={l.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm text-ink underline
                                    border border-line rounded px-2 py-1 hover:border-gold"
                                  title={l.url}
                                >
                                  {l.title}
                                  {l.team && (
                                    <span className="font-mono text-[9px] uppercase text-muted no-underline">
                                      [{l.team}]
                                    </span>
                                  )}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                </HubSection>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-line rounded-lg bg-white p-4">
      <div className="font-disp uppercase font-bold text-base leading-none">
        {title}
      </div>
      {subtitle && (
        <p className="font-mono text-[10px] text-muted mt-1 mb-3 leading-relaxed">
          {subtitle}
        </p>
      )}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

function Field({
  label,
  badge,
  placeholder,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  badge?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
          {label}
        </label>
        {badge && (
          <span className="font-mono text-[8.5px] uppercase tracking-[0.04em] text-gold border border-gold/50 rounded px-1 py-0.5">
            {badge}
          </span>
        )}
      </div>
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

// A per-team field that visibly shows whether it's inheriting the style default
// or overriding it.
function OverrideField({
  label,
  def,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  def: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  const overriding = value.trim().length > 0;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
          {label}
        </label>
        <span
          className={`font-mono text-[8.5px] uppercase tracking-[0.04em] px-1 py-0.5 rounded border ${
            overriding
              ? "text-gold border-gold/50"
              : "text-muted border-line"
          }`}
        >
          {overriding ? "Override" : "Inherited"}
        </span>
      </div>
      <textarea
        rows={2}
        value={value}
        placeholder={def.trim() ? `Inherit: ${def.trim()}` : "(none set)"}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full text-[12px] px-2 py-1.5 border border-line rounded
          focus:outline-none focus:border-gold resize-y"
      />
    </div>
  );
}

function HubSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-gold border-b border-line pb-1 mb-2.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function HubField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
        {label}
      </dt>
      <dd className="text-sm mt-0.5 whitespace-pre-wrap">
        {value && value.trim() ? value.trim() : <span className="text-muted">—</span>}
      </dd>
    </div>
  );
}

function HubInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.06em] text-muted shrink-0 w-20 pt-0.5">
        {label}
      </span>
      <span className="whitespace-pre-wrap">{value}</span>
    </div>
  );
}
