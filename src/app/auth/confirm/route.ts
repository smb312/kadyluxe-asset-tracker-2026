import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/allowlist";

// Magic-link landing route. Supabase appends ?token_hash=...&type=magiclink.
// We verify the OTP (which sets the session cookie), then enforce the allowlist
// one more time server-side before letting the user in.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

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
