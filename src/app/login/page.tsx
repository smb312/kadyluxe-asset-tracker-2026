import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/allowlist";

// Server Action: validate the email against the allowlist, then send a magic
// link. We deliberately do NOT send links to non-allowlisted addresses.
async function sendLink(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/login?error=Enter+your+email");

  if (!isAllowed(email)) {
    // Same message whether the address exists or not — don't leak the allowlist.
    redirect("/login?error=That+email+is+not+on+the+team+allowlist");
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      shouldCreateUser: true,
    },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/login?sent=1");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; denied?: string }>;
}) {
  const sp = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="font-mono text-[11px] tracking-[0.24em] uppercase text-gold">
            KadyLuxe · Fall 26
          </p>
          <h1 className="font-disp font-bold uppercase text-3xl leading-none mt-1">
            Asset Tracker
          </h1>
        </div>

        <div className="bg-white border border-line rounded-lg p-6">
          <p className="text-sm text-muted mb-4">
            Sign in with your team email. We&apos;ll send a one-time magic link —
            no password needed.
          </p>

          {sp.denied && (
            <p className="mb-4 text-sm text-bad bg-badbg border border-[#e7c0cb] rounded p-2">
              Your account is signed in but not on the team allowlist. Ask an
              admin to add your email.
            </p>
          )}
          {sp.error && (
            <p className="mb-4 text-sm text-bad bg-badbg border border-[#e7c0cb] rounded p-2">
              {sp.error}
            </p>
          )}
          {sp.sent ? (
            <p className="text-sm text-ok bg-okbg border border-[#a9dcc2] rounded p-3">
              Check your inbox — we sent a magic link. Open it on this device to
              finish signing in.
            </p>
          ) : (
            <form action={sendLink} className="space-y-3">
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@kadyluxe.com"
                className="w-full border border-line rounded px-3 py-2 text-sm
                  focus:outline-none focus:border-gold"
              />
              <button
                type="submit"
                className="w-full bg-ink text-paper font-mono text-xs uppercase
                  tracking-[0.08em] rounded px-3 py-2.5 hover:bg-black transition-colors"
              >
                Send magic link
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
