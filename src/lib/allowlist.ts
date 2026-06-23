// Single source of truth for the app-level email allowlist. Reads the
// comma-separated ALLOWED_EMAILS env var. Matching is case-insensitive and
// trims whitespace. Keep this in sync with the allowlist table in
// supabase/rls_and_auth.sql (which enforces the same rule inside the DB).

export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = allowedEmails();
  // If no allowlist is configured, fail closed (deny) to be safe.
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}
