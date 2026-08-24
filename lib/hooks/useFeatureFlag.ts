"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_FLAGS: Record<string, boolean> = {
  liveScoring: true, transferWindow: true, chat: true, polls: true,
  leagueCreation: true, notifications: true, marketplace: true, achievements: true,
  fantasyTeams: true, scorePredictions: true,
};

/**
 * Reads a single toggle from the app_config.feature_flags row the Admin
 * panel writes to. Returns `true` (feature enabled) until the row loads, so
 * pages don't flash a "disabled" state on every visit while it fetches.
 */
export function useFeatureFlag(key: keyof typeof DEFAULT_FLAGS): boolean {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("app_config")
          .select("value")
          .eq("key", "feature_flags")
          .single();
        const flags = { ...DEFAULT_FLAGS, ...(data?.value ?? {}) };
        if (!cancelled) setEnabled(flags[key] !== false);
      } catch { /* leave enabled — fail open rather than hiding a working feature */ }
    }
    load();
    return () => { cancelled = true; };
  }, [key]);

  return enabled;
}
