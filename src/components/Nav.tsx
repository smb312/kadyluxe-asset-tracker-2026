import Link from "next/link";

// Header navigation between the tracker grid and the requirements editor.
export function Nav({ active }: { active: "tracker" | "settings" }) {
  const linkCls = (on: boolean) =>
    `font-mono text-[10px] uppercase tracking-[0.08em] px-2.5 py-1 rounded border ${
      on
        ? "bg-gold/20 border-gold text-paper"
        : "border-[#44403a] text-[#cfc8ba] hover:text-paper"
    }`;

  return (
    <div className="flex items-center gap-2">
      <Link href="/" className={linkCls(active === "tracker")}>
        Tracker
      </Link>
      <Link href="/settings" className={linkCls(active === "settings")}>
        Requirements
      </Link>
    </div>
  );
}
