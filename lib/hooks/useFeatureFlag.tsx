"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_FLAGS: Record<string, boolean> = {
  liveScoring: true, transferWindow: true, chat: true, polls: true,
  leagueCreation: true, notifications: true, marketplace: true, achievements: true,
  fantasyTeams: true, scorePredictions: true,
};

type Flags = typeof DEFAULT_FLAGS;

const FeatureFlagsContext = createContext<Flags>(DEFAULT_FLAGS);

/**
 * Seeds every `useFeatureFlag()` call on the page from a single value
 * resolved server-side in app/(app)/layout.tsx — so a disabled feature
 * never has a moment where the UI shows it as enabled, and every page load
 * fires exactly one Supabase query for this instead of one per component
 * that calls the hook (previously the sidebar alone fired ~5 identical
 * queries for the same row on every navigation).
 *
 * Still re-fetches once in the background after mount so an admin flipping
 * a flag while a user has the app open is picked up without a full reload
 * — just from one place now, not from every consumer independently.
 */
export function FeatureFlagsProvider({ initialFlags, children }: { initialFlags: Partial<Flags>; children: ReactNode }) {
  const [flags, setFlags] = useState<Flags>({ ...DEFAULT_FLAGS, ...initialFlags } as Flags);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("app_config")
          .select("value")
          .eq("key", "feature_flags")
          .single();
        if (!cancelled && data?.value) setFlags({ ...DEFAULT_FLAGS, ...data.value });
      } catch { /* keep the server-resolved value */ }
    }
    refresh();
    return () => { cancelled = true; };
  }, []);

  return <FeatureFlagsContext.Provider value={flags}>{children}</FeatureFlagsContext.Provider>;
}

/** Reads a single toggle from the shared flags context — no fetch, no flash. */
export function useFeatureFlag(key: keyof Flags): boolean {
  return useContext(FeatureFlagsContext)[key] !== false;
}
