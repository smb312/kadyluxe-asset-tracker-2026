"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useIdentity } from "@/lib/identity";
import type { ReviewProduct } from "@/app/reviews/page";
import type {
  AssetSlot,
  ReviewAsset,
  ReviewComment,
  ReviewKind,
  ReviewStatus,
  Style,
  StyleRequirement,
} from "@/lib/types";

const BUCKET = "review-assets";
const TYPE_LABEL: Record<string, string> = {
  pdp: "PDP",
  paid_social: "Paid Social",
  ugc: "UGC",
};

const statusPill = (s: ReviewStatus) =>
  `font-mono text-[9px] uppercase tracking-[0.04em] px-1.5 py-0.5 rounded border ${
    s === "approved"
      ? "bg-okbg text-ok border-[#a9dcc2]"
      : s === "rejected"
        ? "bg-badbg text-bad border-[#e7c0cb]"
        : "bg-warnbg text-warn border-[#ecd49a]"
  }`;

export function ReviewsBoard({
  styles,
  slots,
  requirements,
  products,
  assets,
  comments,
  initialStyle,
  initialProductId,
}: {
  styles: Style[];
  slots: AssetSlot[];
  requirements: StyleRequirement[];
  products: ReviewProduct[];
  assets: ReviewAsset[];
  comments: ReviewComment[];
  initialStyle?: number;
  initialProductId?: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [identity, setIdentity] = useIdentity();

  const [assetList, setAssetList] = useState<ReviewAsset[]>(assets);
  const [commentList, setCommentList] = useState<ReviewComment[]>(comments);
  const [err, setErr] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("all");

  // Per-shot "add link" + per-asset reject/comment inputs.
  const [newBySlot, setNewBySlot] = useState<
    Record<number, { kind: ReviewKind; url: string; title: string }>
  >({});
  const [rejectOpen, setRejectOpen] = useState<Record<number, boolean>>({});
  const [reasonByAsset, setReasonByAsset] = useState<Record<number, string>>({});
  const [commentByAsset, setCommentByAsset] = useState<Record<number, string>>(
    {},
  );

  // Style/team selection.
  const stylesWithProducts = useMemo(() => {
    const ids = new Set(products.map((p) => p.style_number));
    return styles.filter((s) => ids.has(s.style_number));
  }, [styles, products]);
  const [styleNumber, setStyleNumber] = useState<number>(
    (initialStyle &&
    stylesWithProducts.some((s) => s.style_number === initialStyle)
      ? initialStyle
      : stylesWithProducts[0]?.style_number) ?? 0,
  );
  const teamsForStyle = useMemo(
    () =>
      products
        .filter((p) => p.style_number === styleNumber)
        .sort((a, b) => a.team.localeCompare(b.team)),
    [products, styleNumber],
  );
  const [productId, setProductId] = useState<number>(
    (initialProductId && teamsForStyle.some((t) => t.id === initialProductId)
      ? initialProductId
      : teamsForStyle[0]?.id) ?? 0,
  );
  // Keep productId valid when the style changes.
  const effectiveProductId = teamsForStyle.some((t) => t.id === productId)
    ? productId
    : (teamsForStyle[0]?.id ?? 0);

  const slotsById = useMemo(() => {
    const m = new Map<number, AssetSlot>();
    for (const s of slots) m.set(s.id, s);
    return m;
  }, [slots]);

  // Shots for the selected style (from requirements), sorted.
  const shots = useMemo(() => {
    const list: { slot: AssetSlot; required: boolean }[] = [];
    for (const r of requirements) {
      const slot = slotsById.get(r.asset_slot_id);
      if (!slot || slot.level !== "product" || r.style_number !== styleNumber)
        continue;
      list.push({ slot, required: r.is_required });
    }
    return list.sort((a, b) => a.slot.sort - b.slot.sort);
  }, [requirements, slotsById, styleNumber]);

  const assetsForSlot = (slotId: number | null) =>
    assetList.filter(
      (a) =>
        a.product_id === effectiveProductId &&
        a.asset_slot_id === slotId &&
        (statusFilter === "all" || a.review_status === statusFilter),
    );
  const commentsFor = (assetId: number) =>
    commentList.filter((c) => c.review_asset_id === assetId);

  const pendingTotal = assetList.filter(
    (a) => a.review_status === "pending",
  ).length;

  const isImage = (a: ReviewAsset) =>
    a.kind === "image" ||
    !!a.storage_path ||
    /\.(png|jpe?g|webp|gif)$/i.test(a.url);

  // --- Mutations ---
  async function insertAsset(
    row: Omit<
      ReviewAsset,
      "id" | "created_at" | "updated_at" | "review_status" | "reviewed_by" | "reviewed_at" | "review_reason"
    >,
  ) {
    const { data, error } = await supabase
      .from("review_assets")
      .insert(row)
      .select()
      .single();
    if (error || !data) {
      setErr(error?.message ?? "Could not save.");
      return null;
    }
    setAssetList((l) => [...l, data as ReviewAsset]);
    return data as ReviewAsset;
  }

  async function uploadReview(slotId: number | null, file: File) {
    setUploadingSlot(slotId ?? 0);
    setErr(null);
    const safe = file.name.replace(/[^\w.\-]/g, "_");
    const path = `${effectiveProductId}/${slotId ?? "general"}/${Date.now()}-${safe}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (up.error) {
      setErr(
        up.error.message.includes("Bucket not found")
          ? "Storage isn't set up — run supabase/olivia_briefs.sql first."
          : up.error.message,
      );
      setUploadingSlot(null);
      return;
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const created = await insertAsset({
      product_id: effectiveProductId,
      asset_slot_id: slotId,
      kind: "image",
      title: file.name,
      url: pub.publicUrl,
      storage_path: path,
      created_by: identity,
    });
    if (!created) await supabase.storage.from(BUCKET).remove([path]);
    setUploadingSlot(null);
  }

  async function addLinkAsset(slotId: number | null) {
    const key = slotId ?? 0;
    const n = newBySlot[key];
    if (!n?.url.trim()) return;
    await insertAsset({
      product_id: effectiveProductId,
      asset_slot_id: slotId,
      kind: n.kind,
      title: n.title.trim() || (n.kind === "loom" ? "Loom" : "Link"),
      url: n.url.trim(),
      storage_path: null,
      created_by: identity,
    });
    setNewBySlot((m) => ({
      ...m,
      [key]: { kind: n.kind, url: "", title: "" },
    }));
  }

  async function setStatus(
    asset: ReviewAsset,
    status: ReviewStatus,
    reason?: string,
  ) {
    const prev = assetList;
    const patch = {
      review_status: status,
      review_reason: reason ?? null,
      reviewed_by: status === "pending" ? null : identity,
      reviewed_at: status === "pending" ? null : new Date().toISOString(),
    };
    setAssetList((l) =>
      l.map((a) => (a.id === asset.id ? { ...a, ...patch } : a)),
    );
    const { error } = await supabase
      .from("review_assets")
      .update(patch)
      .eq("id", asset.id);
    if (error) {
      setAssetList(prev);
      setErr(error.message);
      return;
    }
    // Approving a shot-tagged asset marks that shot Ready in the tracker, with
    // this asset as the link. Product-level (untagged) approvals don't touch a
    // specific shot.
    if (status === "approved" && asset.asset_slot_id != null) {
      await supabase.from("product_assets").upsert(
        {
          product_id: asset.product_id,
          asset_slot_id: asset.asset_slot_id,
          status: "ready",
          final_url: asset.url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id,asset_slot_id" },
      );
    }
  }

  async function deleteAsset(asset: ReviewAsset) {
    if (!window.confirm("Delete this review asset and its comments?")) return;
    const prev = assetList;
    setAssetList((l) => l.filter((a) => a.id !== asset.id));
    if (asset.storage_path)
      await supabase.storage.from(BUCKET).remove([asset.storage_path]);
    const { error } = await supabase
      .from("review_assets")
      .delete()
      .eq("id", asset.id);
    if (error) {
      setAssetList(prev);
      setErr(error.message);
    }
  }

  async function addComment(assetId: number) {
    const body = (commentByAsset[assetId] ?? "").trim();
    if (!body) return;
    const { data, error } = await supabase
      .from("review_comments")
      .insert({ review_asset_id: assetId, author: identity, body })
      .select()
      .single();
    if (error || !data) {
      setErr(error?.message ?? "Could not add comment.");
      return;
    }
    setCommentList((l) => [...l, data as ReviewComment]);
    setCommentByAsset((m) => ({ ...m, [assetId]: "" }));
  }

  const product = teamsForStyle.find((t) => t.id === effectiveProductId);

  return (
    <div className="max-w-4xl">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex border border-line rounded overflow-hidden">
          {(["KadyLuxe", "Olivia"] as const).map((who) => (
            <button
              key={who}
              type="button"
              onClick={() => setIdentity(who)}
              className={`font-mono text-[10px] uppercase tracking-[0.04em] px-2.5 py-1.5
                ${identity === who ? "bg-gold text-ink" : "bg-white text-muted hover:text-ink"}`}
            >
              {who}
            </button>
          ))}
        </div>
        <span className="font-mono text-[10px] text-muted">
          acting as <b className="text-ink">{identity}</b>
        </span>

        <select
          value={styleNumber}
          onChange={(e) => setStyleNumber(Number(e.target.value))}
          className="text-sm px-2.5 py-1.5 border border-line rounded bg-white
            focus:outline-none focus:border-gold ml-auto"
        >
          {stylesWithProducts.map((s) => (
            <option key={s.style_number} value={s.style_number}>
              {s.style_number} — {s.name}
            </option>
          ))}
        </select>
        <select
          value={effectiveProductId}
          onChange={(e) => setProductId(Number(e.target.value))}
          className="text-sm px-2.5 py-1.5 border border-line rounded bg-white
            focus:outline-none focus:border-gold"
        >
          {teamsForStyle.map((t) => (
            <option key={t.id} value={t.id}>
              {t.team}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | ReviewStatus)
          }
          className="text-[12px] px-2 py-1.5 border border-line rounded bg-white
            focus:outline-none focus:border-gold"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <p className="font-mono text-[10px] text-muted mb-3">
        {pendingTotal} asset{pendingTotal === 1 ? "" : "s"} pending review across
        all products ·{" "}
        {product ? `${product.team} — style ${styleNumber}` : "no product"}
      </p>

      {err && (
        <p className="text-sm text-bad bg-badbg border border-[#e7c0cb] rounded p-2 mb-3">
          {err}
        </p>
      )}

      {/* One card per shot */}
      <div className="space-y-3">
        {shots.length === 0 && (
          <p className="text-sm text-muted">
            No shots defined for this style — set them on the Requirements page.
          </p>
        )}
        {[{ slot: null, required: false }, ...shots].map(({ slot, required }) => {
          const slotId = slot ? slot.id : null;
          const mapKey = slot ? slot.id : 0;
          const cardAssets = assetsForSlot(slotId);
          const nl = newBySlot[mapKey] ?? {
            kind: "loom" as ReviewKind,
            url: "",
            title: "",
          };
          return (
            <div
              key={slot ? slot.id : "general"}
              className="border border-line rounded-lg bg-white p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-disp uppercase font-bold text-base">
                  {slot ? slot.label : "General — no specific shot"}
                </span>
                {slot && (
                  <span className="font-mono text-[9px] uppercase text-muted border border-line rounded px-1.5 py-0.5">
                    {TYPE_LABEL[slot.asset_type] ?? slot.asset_type}
                  </span>
                )}
                {slot && !required && (
                  <span className="font-mono text-[9px] uppercase text-muted">
                    optional
                  </span>
                )}
                <span className="ml-auto font-mono text-[10px] text-muted">
                  {cardAssets.length} asset{cardAssets.length === 1 ? "" : "s"}
                </span>
              </div>

              {/* Existing review assets */}
              <div className="space-y-2">
                {cardAssets.map((a) => (
                  <div
                    key={a.id}
                    className="border border-line rounded-md p-2 flex gap-3"
                  >
                    <a href={a.url} target="_blank" rel="noopener noreferrer">
                      {isImage(a) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.url}
                          alt={a.title}
                          className="w-16 h-16 object-cover rounded border border-line"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded border border-line flex items-center justify-center text-2xl">
                          {a.kind === "loom" ? "▶" : "🔗"}
                        </div>
                      )}
                    </a>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-ink underline truncate max-w-[220px]"
                          title={a.url}
                        >
                          {a.title || a.url}
                        </a>
                        <span className={statusPill(a.review_status)}>
                          {a.review_status}
                        </span>
                        {a.created_by && (
                          <span className="font-mono text-[9px] text-muted">
                            by {a.created_by}
                          </span>
                        )}
                      </div>

                      {a.review_status === "rejected" && a.review_reason && (
                        <p className="text-[12px] text-bad mt-1">
                          Rejected{a.reviewed_by ? ` by ${a.reviewed_by}` : ""}:{" "}
                          {a.review_reason}
                        </p>
                      )}
                      {a.review_status === "approved" && a.reviewed_by && (
                        <p className="text-[12px] text-ok mt-1">
                          Approved by {a.reviewed_by} · marked Ready in the
                          tracker
                        </p>
                      )}

                      {/* Review actions */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {a.review_status !== "approved" && (
                          <button
                            type="button"
                            onClick={() => setStatus(a, "approved")}
                            className="font-mono text-[10px] uppercase px-2 py-1 rounded
                              bg-ok text-white"
                          >
                            Approve
                          </button>
                        )}
                        {a.review_status !== "rejected" && (
                          <button
                            type="button"
                            onClick={() =>
                              setRejectOpen((m) => ({ ...m, [a.id]: !m[a.id] }))
                            }
                            className="font-mono text-[10px] uppercase px-2 py-1 rounded
                              border border-bad text-bad"
                          >
                            Reject
                          </button>
                        )}
                        {a.review_status !== "pending" && (
                          <button
                            type="button"
                            onClick={() => setStatus(a, "pending")}
                            className="font-mono text-[10px] uppercase px-2 py-1 rounded
                              border border-line text-muted"
                          >
                            Reopen
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteAsset(a)}
                          className="font-mono text-[10px] uppercase px-2 py-1 rounded
                            text-muted hover:text-bad ml-auto"
                        >
                          Delete
                        </button>
                      </div>

                      {rejectOpen[a.id] && (
                        <div className="flex gap-1.5 mt-1.5">
                          <input
                            value={reasonByAsset[a.id] ?? ""}
                            onChange={(e) =>
                              setReasonByAsset((m) => ({
                                ...m,
                                [a.id]: e.target.value,
                              }))
                            }
                            placeholder="Reason for rejection…"
                            className="flex-1 text-[12px] px-2 py-1 border border-line rounded
                              focus:outline-none focus:border-gold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setStatus(a, "rejected", reasonByAsset[a.id] ?? "");
                              setRejectOpen((m) => ({ ...m, [a.id]: false }));
                            }}
                            className="font-mono text-[10px] uppercase px-2 py-1 rounded
                              bg-bad text-white"
                          >
                            Confirm
                          </button>
                        </div>
                      )}

                      {/* Comments */}
                      <div className="mt-2 border-t border-line pt-1.5">
                        {commentsFor(a.id).map((c) => (
                          <div key={c.id} className="text-[12px] mb-1">
                            <span className="font-semibold">
                              {c.author ?? "—"}:
                            </span>{" "}
                            {c.body}
                          </div>
                        ))}
                        <div className="flex gap-1.5 mt-1">
                          <input
                            value={commentByAsset[a.id] ?? ""}
                            onChange={(e) =>
                              setCommentByAsset((m) => ({
                                ...m,
                                [a.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) =>
                              e.key === "Enter" && addComment(a.id)
                            }
                            placeholder={`Comment as ${identity}…`}
                            className="flex-1 text-[12px] px-2 py-1 border border-line rounded
                              focus:outline-none focus:border-gold"
                          />
                          <button
                            type="button"
                            onClick={() => addComment(a.id)}
                            className="font-mono text-[10px] uppercase px-2 py-1 rounded
                              border border-line text-muted hover:text-ink"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {cardAssets.length === 0 && (
                  <p className="text-[12px] text-muted">
                    No assets yet for this shot.
                  </p>
                )}
              </div>

              {/* Add deliverable */}
              <div className="mt-2.5 border-t border-line pt-2.5 flex items-center gap-2 flex-wrap">
                <label
                  className={`font-mono text-[10px] uppercase tracking-[0.04em] px-3 py-1.5
                    rounded border border-line cursor-pointer hover:border-gold
                    ${uploadingSlot === mapKey ? "opacity-50 pointer-events-none" : "text-ink"}`}
                >
                  {uploadingSlot === mapKey ? "Uploading…" : "⬆ Upload image"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingSlot === mapKey}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadReview(slotId, f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="font-mono text-[10px] text-muted">or</span>
                <select
                  value={nl.kind}
                  onChange={(e) =>
                    setNewBySlot((m) => ({
                      ...m,
                      [mapKey]: { ...nl, kind: e.target.value as ReviewKind },
                    }))
                  }
                  className="text-[12px] px-2 py-1.5 border border-line rounded bg-white
                    focus:outline-none focus:border-gold"
                >
                  <option value="loom">Loom</option>
                  <option value="link">Link</option>
                </select>
                <input
                  value={nl.url}
                  onChange={(e) =>
                    setNewBySlot((m) => ({
                      ...m,
                      [mapKey]: { ...nl, url: e.target.value },
                    }))
                  }
                  onKeyDown={(e) => e.key === "Enter" && addLinkAsset(slotId)}
                  placeholder="Paste Loom / link URL…"
                  className="flex-1 min-w-[160px] text-[12px] px-2 py-1.5 border border-line rounded
                    focus:outline-none focus:border-gold"
                />
                <button
                  type="button"
                  disabled={!nl.url.trim()}
                  onClick={() => addLinkAsset(slotId)}
                  className="font-mono text-[10px] uppercase tracking-[0.04em] px-3 py-1.5
                    rounded bg-ink text-white disabled:opacity-40"
                >
                  + Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
