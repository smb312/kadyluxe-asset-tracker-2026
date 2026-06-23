import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowed } from "@/lib/allowlist";
import { loadTrackerData } from "@/lib/data";
import { Tracker } from "@/components/Tracker";

// Server Component: auth-guard, then load data and hand off to the client grid.
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAllowed(user.email)) redirect("/login");

  const data = await loadTrackerData();
  return <Tracker data={data} userEmail={user.email ?? ""} />;
}
