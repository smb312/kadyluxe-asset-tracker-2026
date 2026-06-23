import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { BriefsEditor } from "@/components/BriefsEditor";
import type {
  AssetSlot,
  BriefLink,
  ProductBrief,
  StyleBrief,
  StyleRequirement,
  Style,
  StyleTeam,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BriefsPage({
  searchParams,
}: {
  searchParams: { style?: string; tab?: string; team?: string };
}) {
  const supabase = await createClient();
  const initialStyle = searchParams.style ? Number(searchParams.style) : undefined;
  const initialTab = searchParams.tab as
    | "brief"
    | "teams"
    | "assets"
    | "hub"
    | undefined;
  const initialTeam = searchParams.team;

  const [
    stylesRes,
    slotsRes,
    reqRes,
    productsRes,
    briefsRes,
    linksRes,
    pbRes,
  ] = await Promise.all([
    supabase.from("styles").select("*").order("style_number"),
    supabase.from("asset_slots").select("*").order("sort"),
    supabase.from("style_requirements").select("*"),
    supabase.from("products").select("id, team, style_number").order("team"),
    supabase.from("style_briefs").select("*"),
    supabase.from("brief_links").select("*").order("id"),
    supabase.from("product_briefs").select("*"),
  ]);

  // The brief tables are optional (created by supabase/olivia_briefs.sql). If
  // they're missing, show a friendly setup note instead of crashing.
  const briefsMissing =
    briefsRes.error?.message?.includes("style_briefs") ||
    linksRes.error?.message?.includes("brief_links") ||
    pbRes.error?.message?.includes("product_briefs");

  const fatal =
    stylesRes.error || slotsRes.error || reqRes.error || productsRes.error;
  if (fatal) throw new Error(fatal.message);

  // Teams (with product ids) running each style.
  const teamsByStyle: Record<number, StyleTeam[]> = {};
  for (const p of (productsRes.data ?? []) as {
    id: number;
    team: string;
    style_number: number;
  }[]) {
    (teamsByStyle[p.style_number] ??= []).push({
      product_id: p.id,
      team: p.team,
    });
  }

  return (
    <div>
      <header className="bg-ink text-paper px-6 pt-[18px] pb-4">
        <div className="flex justify-between items-end flex-wrap gap-3">
          <div>
            <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-gold">
              KadyLuxe · Olivia AI
            </span>
            <h1 className="font-disp font-bold uppercase text-[28px] leading-[0.95] mt-0.5">
              Creative Briefs
            </h1>
          </div>
          <Nav active="briefs" />
        </div>
      </header>

      {briefsMissing ? (
        <div className="px-6 py-6 max-w-2xl">
          <div className="bg-warnbg border border-[#ecd49a] rounded-lg p-4 text-sm">
            <p className="font-semibold mb-1">One-time setup needed</p>
            <p>
              Run <span className="font-mono">supabase/olivia_briefs.sql</span> in
              your Supabase SQL editor to create the brief tables, then refresh
              this page.
            </p>
          </div>
        </div>
      ) : (
        <div className="px-6 py-5">
          <BriefsEditor
            styles={stylesRes.data as Style[]}
            slots={slotsRes.data as AssetSlot[]}
            requirements={reqRes.data as StyleRequirement[]}
            teamsByStyle={teamsByStyle}
            briefs={(briefsRes.data ?? []) as StyleBrief[]}
            links={(linksRes.data ?? []) as BriefLink[]}
            productBriefs={(pbRes.data ?? []) as ProductBrief[]}
            initialStyle={initialStyle}
            initialTab={initialTab}
            initialTeam={initialTeam}
          />
        </div>
      )}
    </div>
  );
}
