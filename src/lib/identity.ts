"use client";

import { useEffect, useState } from "react";

// Lightweight "who am I" identity for the open (no-login) review loop. Stored in
// the browser so uploads, comments, and approvals can be labeled KadyLuxe vs
// Olivia. Honor-system, matching the rest of the tool.

export type Identity = "KadyLuxe" | "Olivia";
const KEY = "kl_identity";

export function useIdentity(): [Identity, (v: Identity) => void] {
  const [identity, setIdentity] = useState<Identity>("KadyLuxe");

  useEffect(() => {
    const saved = window.localStorage.getItem(KEY) as Identity | null;
    if (saved === "KadyLuxe" || saved === "Olivia") setIdentity(saved);
  }, []);

  const update = (v: Identity) => {
    setIdentity(v);
    try {
      window.localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  };

  return [identity, update];
}
