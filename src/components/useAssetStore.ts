"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  AssetStatus,
  CollectionAsset,
  ProductAsset,
} from "@/lib/types";

export interface AssetCell {
  status: AssetStatus;
  final_url: string | null;
}

const DEFAULT_CELL: AssetCell = { status: "not_started", final_url: null };

type Patch = Partial<AssetCell>;

// Holds the live status/link state for product_assets and collection_assets and
// persists every change to Supabase via upsert (unique on parent+slot). Updates
// optimistically and rolls back on error.
export function useAssetStore(
  initialProduct: ProductAsset[],
  initialCollection: CollectionAsset[],
) {
  const supabase = useMemo(() => createClient(), []);
  const [error, setError] = useState<string | null>(null);

  const [pa, setPa] = useState<Record<string, AssetCell>>(() => {
    const m: Record<string, AssetCell> = {};
    for (const r of initialProduct)
      m[`${r.product_id}:${r.asset_slot_id}`] = {
        status: r.status,
        final_url: r.final_url,
      };
    return m;
  });

  const [ca, setCa] = useState<Record<string, AssetCell>>(() => {
    const m: Record<string, AssetCell> = {};
    for (const r of initialCollection)
      m[`${r.collection_id}:${r.asset_slot_id}`] = {
        status: r.status,
        final_url: r.final_url,
      };
    return m;
  });

  const getProduct = useCallback(
    (productId: number, slotId: number): AssetCell =>
      pa[`${productId}:${slotId}`] ?? DEFAULT_CELL,
    [pa],
  );

  const getCollection = useCallback(
    (collectionId: number, slotId: number): AssetCell =>
      ca[`${collectionId}:${slotId}`] ?? DEFAULT_CELL,
    [ca],
  );

  const writeProduct = useCallback(
    async (productId: number, slotId: number, patch: Patch) => {
      const key = `${productId}:${slotId}`;
      const prev = pa[key] ?? DEFAULT_CELL;
      const next = { ...prev, ...patch };
      setPa((m) => ({ ...m, [key]: next }));

      const { error: e } = await supabase.from("product_assets").upsert(
        {
          product_id: productId,
          asset_slot_id: slotId,
          status: next.status,
          final_url: next.final_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id,asset_slot_id" },
      );

      if (e) {
        setPa((m) => ({ ...m, [key]: prev })); // rollback
        setError(`Could not save: ${e.message}`);
      }
    },
    [pa, supabase],
  );

  const writeCollection = useCallback(
    async (collectionId: number, slotId: number, patch: Patch) => {
      const key = `${collectionId}:${slotId}`;
      const prev = ca[key] ?? DEFAULT_CELL;
      const next = { ...prev, ...patch };
      setCa((m) => ({ ...m, [key]: next }));

      const { error: e } = await supabase.from("collection_assets").upsert(
        {
          collection_id: collectionId,
          asset_slot_id: slotId,
          status: next.status,
          final_url: next.final_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "collection_id,asset_slot_id" },
      );

      if (e) {
        setCa((m) => ({ ...m, [key]: prev }));
        setError(`Could not save: ${e.message}`);
      }
    },
    [ca, supabase],
  );

  return {
    getProduct,
    getCollection,
    writeProduct,
    writeCollection,
    error,
    clearError: () => setError(null),
  };
}
