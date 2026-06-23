import { loadTrackerData } from "@/lib/data";
import { Tracker } from "@/components/Tracker";

// Open internal tool — no auth. Loads data on the server, hands off to the
// client grid. Dynamic so each visit gets fresh statuses.
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await loadTrackerData();
  return <Tracker data={data} />;
}
