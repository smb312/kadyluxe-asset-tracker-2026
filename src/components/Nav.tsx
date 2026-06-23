import Link from "next/link";

// Top-of-header navigation + sign out. Rendered inside the ink header.
export function Nav({ email, active }: { email: string; active: "tracker" | "settings" }) {
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
      <span className="font-mono text-[10px] text-[#9a9182] ml-1 hidden sm:inline">
        {email}
      </span>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="font-mono text-[10px] uppercase tracking-[0.08em] px-2.5 py-1
            rounded border border-[#44403a] text-[#cfc8ba] hover:text-paper"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
