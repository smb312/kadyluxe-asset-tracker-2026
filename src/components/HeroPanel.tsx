"use client";

import { Chip } from "./Chip";
import type { AssetSlot, AssetStatus, Collection } from "@/lib/types";
import { nextStatus, shortFor } from "@/lib/assets";
import type { useAssetStore } from "./useAssetStore";

type Store = ReturnType<typeof useAssetStore>;

// One hero card per collection: a group paid-social asset, plus a UGC asset when
// the collection is ugc_in_scope. Same chip + link behavior as the grid, backed
// by collection_assets.
export function HeroPanel({
  collections,
  groupSlot,
  ugcSlot,
  store,
}: {
  collections: Collection[];
  groupSlot: AssetSlot | undefined;
  ugcSlot: AssetSlot | undefined;
  store: Store;
}) {
  const renderChip = (collectionId: number, slot: AssetSlot, optional: boolean) => {
    const cell = store.getCollection(collectionId, slot.id);
    return (
      <Chip
        short={shortFor(slot.code)}
        label={slot.label}
        status={cell.status}
        optional={optional}
        finalUrl={cell.final_url}
        onCycle={() =>
          store.writeCollection(collectionId, slot.id, {
            status: nextStatus(cell.status),
          })
        }
        onSetStatus={(s: AssetStatus) =>
          store.writeCollection(collectionId, slot.id, { status: s })
        }
        onSaveLink={(url, markReady) =>
          store.writeCollection(collectionId, slot.id, {
            final_url: url || null,
            ...(markReady ? { status: "ready" as AssetStatus } : {}),
          })
        }
        onRemoveLink={() =>
          store.writeCollection(collectionId, slot.id, { final_url: null })
        }
      />
    );
  };

  return (
    <div className="grid gap-3 mt-2 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
      {collections.map((c) => (
        <div key={c.id} className="bg-white border border-line rounded-lg px-3.5 py-3">
          <h3 className="font-disp font-bold uppercase text-[17px] leading-tight">
            {c.name}
          </h3>
          <div className="font-mono text-[9.5px] text-muted mb-2.5">
            Hero collection
          </div>

          <div className="flex justify-between items-center py-1.5 border-t border-dashed border-line">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
              Group paid social
            </span>
            {groupSlot ? (
              renderChip(c.id, groupSlot, false)
            ) : (
              <span className="text-muted text-xs">—</span>
            )}
          </div>

          <div className="flex justify-between items-center py-1.5 border-t border-dashed border-line">
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
              UGC {c.ugc_in_scope ? "" : "(out of scope)"}
            </span>
            {c.ugc_in_scope && ugcSlot ? (
              renderChip(c.id, ugcSlot, true)
            ) : (
              <span
                className="font-mono text-[11px] text-[#c4bcab]"
                title="UGC = in-scope collections only"
              >
                —
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
