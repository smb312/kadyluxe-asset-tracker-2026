import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { ReviewsBoard } from "@/components/ReviewsBoard";
import type {
  AssetSlot,
  ReviewAsset,
  ReviewComment,
  Style,
  StyleRequirement,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export interface ReviewProduct {
  id: number;
  team: string;
  style_number: number;
}

export default async function ReviewsPage() {
  const supabase = await createClient();

  const [stylesRes, slotsRes, reqRes, productsRes, assetsRes, commentsRes] =
    await Promise.all([
      supabase.from("styles").select("*").order("style_number"),
      supabase.from("asset_slots").select("*").order("sort"),
      supabase.from("style_requirements").select("*"),
      supabase.from("products").select("id, team, style_number").order("team"),
      supabase.from("review_assets").select("*").order("created_at"),
      supabase.from("review_comments").select("*").order("created_at"),
    ]);

  const reviewsMissing =
    assetsRes.error?.message?.includes("review_assets") ||
    commentsRes.error?.message?.includes("review_comments");

  const fatal =
    stylesRes.error || slotsRes.error || reqRes.error || productsRes.error;
  if (fatal) throw new Error(fatal.message);

  return (
    <div>
      <header className="bg-ink text-paper px-6 pt-[18px] pb-4">
        <div className="flex justify-between items-end flex-wrap gap-3">
          <div>
            <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-gold">
              KadyLuxe · Olivia AI
            </span>
            <h1 className="font-disp font-bold uppercase text-[28px] leading-[0.95] mt-0.5">
              Asset Review
            </h1>
          </div>
          <Nav active="reviews" />
        </div>
      </header>

      {reviewsMissing ? (
        <div className="px-6 py-6 max-w-2xl">
          <div className="bg-warnbg border border-[#ecd49a] rounded-lg p-4 text-sm">
            <p className="font-semibold mb-1">One-time setup needed</p>
            <p>
              Run <span className="font-mono">supabase/olivia_briefs.sql</span> in
              your Supabase SQL editor (it now also creates the review tables),
              then refresh this page.
            </p>
          </div>
        </div>
      ) : (
        <div className="px-6 py-5">
          <ReviewsBoard
            styles={stylesRes.data as Style[]}
            slots={slotsRes.data as AssetSlot[]}
            requirements={reqRes.data as StyleRequirement[]}
            products={(productsRes.data ?? []) as ReviewProduct[]}
            assets={(assetsRes.data ?? []) as ReviewAsset[]}
            comments={(commentsRes.data ?? []) as ReviewComment[]}
          />
        </div>
      )}
    </div>
  );
}
