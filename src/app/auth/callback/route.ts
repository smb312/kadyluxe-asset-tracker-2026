import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/allowlist";

// PKCE fallback: some Supabase email templates use ?code=... instead of a
// token_hash. Exchange it for a session, then enforce the allowlist.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (isAllowed(user?.email)) {
        return NextResponse.redirect(new URL(next, request.url));
      }
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/login?denied=1", request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=Invalid+or+expired+link", request.url),
  );
}
