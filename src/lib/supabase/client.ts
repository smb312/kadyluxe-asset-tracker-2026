"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client. Reads the public env vars (safe to expose —
// the anon key is meant for the browser; RLS is what actually protects data).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
