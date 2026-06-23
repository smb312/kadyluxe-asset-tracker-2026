import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };
import { isAllowed } from "@/lib/allowlist";

// Runs on every matched request: refreshes the Supabase auth cookie and gates
// access. Unauthenticated users (or authenticated users whose email is not on
// the allowlist) are redirected to /login. Auth routes stay public.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path.startsWith("/login") || path.startsWith("/auth");

  const ok = user && isAllowed(user.email);

  if (!ok && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // If a signed-in user is simply not allowlisted, tell them why.
    if (user && !isAllowed(user.email)) url.searchParams.set("denied", "1");
    return NextResponse.redirect(url);
  }

  // Already signed in & allowed but sitting on /login → send to the app.
  if (ok && path.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
