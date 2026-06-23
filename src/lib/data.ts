import { createClient } from "@/lib/supabase/server";
import type {
  AssetSlot,
  Collection,
  CollectionAsset,
  ProductAsset,
  ProductRow,
  StyleRequirement,
} from "./types";

export interface TrackerData {
  products: ProductRow[];
  slots: AssetSlot[];
  requirements: StyleRequirement[];
  productAssets: ProductAsset[];
  collections: Collection[];
  collectionAssets: CollectionAsset[];
}

// Loads everything the tracker needs in one server round-trip group. Reads only
// — never writes or mutates the schema.
export async function loadTrackerData(): Promise<TrackerData> {
  const supabase = await createClient();

  const [
    productsRes,
    slotsRes,
    reqRes,
    paRes,
    colRes,
    caRes,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*, styles(name)")
      .order("dtc_ovg_msrp", { ascending: false, nullsFirst: false }),
    supabase.from("asset_slots").select("*").order("sort"),
    supabase.from("style_requirements").select("*"),
    supabase.from("product_assets").select("*"),
    supabase.from("collections").select("*").order("id"),
    supabase.from("collection_assets").select("*"),
  ]);

  const firstErr =
    productsRes.error ||
    slotsRes.error ||
    reqRes.error ||
    paRes.error ||
    colRes.error ||
    caRes.error;
  if (firstErr) throw new Error(firstErr.message);

  // Flatten the joined style name onto each product row.
  const products: ProductRow[] = (productsRes.data ?? []).map(
    (p: Record<string, unknown> & { styles?: { name?: string } | null }) => ({
      id: p.id as number,
      team: p.team as string,
      style_number: p.style_number as number,
      dtc_ovg_units: (p.dtc_ovg_units as number) ?? null,
      dtc_ovg_msrp: (p.dtc_ovg_msrp as number) ?? null,
      msrp_flagged: p.msrp_flagged as boolean,
      phase: p.phase as string,
      notes: (p.notes as string) ?? null,
      style_name: p.styles?.name ?? `Style ${p.style_number}`,
    }),
  );

  return {
    products,
    slots: (slotsRes.data ?? []) as AssetSlot[],
    requirements: (reqRes.data ?? []) as StyleRequirement[],
    productAssets: (paRes.data ?? []) as ProductAsset[],
    collections: (colRes.data ?? []) as Collection[],
    collectionAssets: (caRes.data ?? []) as CollectionAsset[],
  };
}
