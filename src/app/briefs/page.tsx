import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { BriefsEditor } from "@/components/BriefsEditor";
import type {
  AssetSlot,
  BriefLink,
  StyleBrief,
  StyleRequirement,
  Style,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BriefsPage() {
  const supabase = await createClient();

  const [stylesRes, slotsRes, reqRes, productsRes, briefsRes, linksRes] =
    await Promise.all([
      supabase.from("styles").select("*").order("style_number"),
      supabase.from("asset_slots").select("*").order("sort"),
      supabase.from("style_requirements").select("*"),
      supabase.from("products").select("team, style_number"),
      supabase.from("style_briefs").select("*"),
      supabase.from("brief_links").select("*").order("id"),
    ]);

  // The brief tables are optional (created by supabase/olivia_briefs.sql). If
  // they're missing, show a friendly setup note instead of crashing.
  const briefsMissing =
    briefsRes.error?.message?.includes("style_briefs") ||
    linksRes.error?.message?.includes("brief_links");

  const fatal =
    stylesRes.error || slotsRes.error || reqRes.error || productsRes.error;
  if (fatal) throw new Error(fatal.message);

  // teams running each style, for context on the brief.
  const teamsByStyle: Record<number, string[]> = {};
  for (const p of (productsRes.data ?? []) as {
    team: string;
    style_number: number;
  }[]) {
    (teamsByStyle[p.style_number] ??= []).push(p.team);
  }
  for (const k of Object.keys(teamsByStyle))
    teamsByStyle[Number(k)] = [...new Set(teamsByStyle[Number(k)])].sort();

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
          />
        </div>
      )}
    </div>
  );
}
