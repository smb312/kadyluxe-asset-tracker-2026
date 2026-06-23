import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { RequirementsEditor } from "@/components/RequirementsEditor";
import type { AssetSlot, Style } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [stylesRes, slotsRes] = await Promise.all([
    supabase.from("styles").select("*").order("style_number"),
    supabase
      .from("asset_slots")
      .select("*")
      .eq("level", "product")
      .order("sort"),
  ]);

  if (stylesRes.error || slotsRes.error) {
    throw new Error(stylesRes.error?.message || slotsRes.error?.message);
  }

  return (
    <div>
      <header className="bg-ink text-paper px-6 pt-[18px] pb-4">
        <div className="flex justify-between items-end flex-wrap gap-3">
          <div>
            <span className="font-mono text-[11px] tracking-[0.24em] uppercase text-gold">
              KadyLuxe · Settings
            </span>
            <h1 className="font-disp font-bold uppercase text-[28px] leading-[0.95] mt-0.5">
              Requirements Editor
            </h1>
          </div>
          <Nav active="settings" />
        </div>
      </header>

      <div className="px-6 py-5 max-w-3xl">
        <p className="text-sm text-muted mb-4">
          Pick a style and choose which asset slots it needs. This writes the{" "}
          <span className="font-mono">style_requirements</span> matrix — the
          tracker grid reads it live, so changing a style&apos;s PDP shot count
          here instantly changes the chips for every product of that style.{" "}
          <Link href="/" className="underline text-ink">
            Back to tracker
          </Link>
        </p>
        <RequirementsEditor
          styles={stylesRes.data as Style[]}
          slots={slotsRes.data as AssetSlot[]}
        />
      </div>
    </div>
  );
}
