import type { AssetStatus, AssetType } from "./types";

// --- Status cycle: not_started → in_progress → ready → (back to) not_started.
// Matches the prototype's 3-state click cycle. 'na' exists in the schema but is
// not part of the click cycle.
const CYCLE: AssetStatus[] = ["not_started", "in_progress", "ready"];

export function nextStatus(s: AssetStatus): AssetStatus {
  const i = CYCLE.indexOf(s);
  return CYCLE[(i + 1) % CYCLE.length];
}

// Index used by tooltips / palette suffixes (0=not_started, 1=in_progress, 2=ready)
export function statusIndex(s: AssetStatus): number {
  const i = CYCLE.indexOf(s);
  return i < 0 ? 0 : i;
}

// Tailwind classes for a chip, given its status and whether it is optional (UGC).
// Required slots use the red/amber/green palette; optional slots use a neutral
// grey at not_started, then amber/green as work progresses.
export function chipClasses(status: AssetStatus, optional: boolean): string {
  const base =
    "border transition-colors";
  if (status === "ready") return `${base} bg-okbg text-ok border-[#a9dcc2]`;
  if (status === "in_progress") return `${base} bg-warnbg text-warn border-[#ecd49a]`;
  // not_started (or na)
  if (optional) return `${base} bg-neutralbg text-neutral border-[#d8d1c2]`;
  return `${base} bg-badbg text-bad border-[#e7c0cb]`;
}

export const STATUS_LABEL: Record<AssetStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready: "Ready",
  na: "N/A",
};

export const OPTIONAL_STATUS_LABEL: Record<AssetStatus, string> = {
  not_started: "Optional — not started",
  in_progress: "In progress",
  ready: "Ready",
  na: "N/A",
};

// Short letter shown inside a chip, derived from the slot code so new slots get
// a sensible abbreviation automatically. Known codes get the prototype's labels.
const SHORT: Record<string, string> = {
  front: "F",
  back: "B",
  fabric: "Fa",
  long: "L",
  ghost: "G",
  lifestyle: "L",
  editorial: "E",
  studio: "S",
  ugc: "U",
  group: "G",
  ugc_collection: "U",
};

export function shortFor(code: string): string {
  if (SHORT[code]) return SHORT[code];
  // Fallback: first two letters, capitalized.
  return code.slice(0, 2).replace(/^\w/, (c) => c.toUpperCase());
}

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  pdp: "PDP shots",
  paid_social: "Paid Social",
  ugc: "UGC",
  group: "Group",
};

// Order in which asset-type groups are displayed.
export const TYPE_ORDER: AssetType[] = ["pdp", "paid_social", "ugc", "group"];

export const fmtMoney = (n: number | null | undefined): string =>
  n == null ? "—" : "$" + n.toLocaleString();
