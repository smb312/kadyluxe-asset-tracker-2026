// Types mirror the EXACT schema in KL_Tracker_schema.sql. We connect to the
// existing Supabase database — nothing here recreates it.

export type AssetType = "pdp" | "paid_social" | "ugc" | "group";
export type SlotLevel = "product" | "collection";
export type AssetStatus = "not_started" | "in_progress" | "ready" | "na";

export interface Style {
  style_number: number;
  name: string;
  is_hero: boolean;
}

export interface Product {
  id: number;
  team: string;
  style_number: number;
  dtc_ovg_units: number | null;
  dtc_ovg_msrp: number | null;
  msrp_flagged: boolean;
  phase: string; // 'Phase 1' | 'Phase 2' | 'Backlog'
  notes: string | null;
}

export interface AssetSlot {
  id: number;
  asset_type: AssetType;
  code: string;
  label: string;
  level: SlotLevel;
  sort: number;
}

export interface StyleRequirement {
  style_number: number;
  asset_slot_id: number;
  is_required: boolean;
}

export interface ProductAsset {
  id: number;
  product_id: number;
  asset_slot_id: number;
  status: AssetStatus;
  final_url: string | null;
  updated_at: string;
}

export interface Collection {
  id: number;
  name: string;
  style_number: number | null;
  ugc_in_scope: boolean;
}

export interface CollectionAsset {
  id: number;
  collection_id: number;
  asset_slot_id: number;
  status: AssetStatus;
  final_url: string | null;
  updated_at: string;
}

// Convenience shape: a product joined to its style name.
export interface ProductRow extends Product {
  style_name: string;
}

// --- Olivia AI creative briefs (additive tables; see supabase/olivia_briefs.sql) ---

export type BriefStatus = "draft" | "ready" | "delivered";

export interface StyleBrief {
  style_number: number;
  model_notes: string | null;
  lifestyle_environment: string | null;
  model_styling_notes: string | null;
  product_feel_notes: string | null;
  extra_notes: string | null;
  status: BriefStatus;
  updated_at: string;
}

// A team running a given style, with its product id (for per-team briefs).
export interface StyleTeam {
  product_id: number;
  team: string;
}

// Per-team (team × style) overrides of model / environment / styling. A blank
// field inherits the style-level default from StyleBrief.
export interface ProductBrief {
  product_id: number;
  model_notes: string | null;
  lifestyle_environment: string | null;
  model_styling_notes: string | null;
  notes: string | null;
  updated_at: string;
}

export type BriefLinkKind =
  | "styling_guide"
  | "product_photos"
  | "model_reference"
  | "pdf"
  | "other";

export interface BriefLink {
  id: number;
  style_number: number;
  team: string | null; // null = applies to all teams of this style
  kind: BriefLinkKind;
  title: string;
  url: string;
  storage_path: string | null; // set when the file was uploaded to Storage
  updated_at: string;
}
