"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { Target, Trophy, Users, ChevronRight, Crown, ShoppingCart, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";

type Sport = "football" | "cricket" | "rugby";

const SPORTS: { id: Sport; label: string; emoji: string }[] = [
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "cricket",  label: "Cricket",  emoji: "🏏" },
  { id: "rugby",    label: "Rugby",    emoji: "🏉" },
];

export default function GamesPage() {
  const scorePredictionsEnabled = useFeatureFlag("scorePredictions");
  const fantasyTeamsEnabled = useFeatureFlag("fantasyTeams");
  const pollsEnabled = useFeatureFlag("polls");

  const [predictionPoints, setPredictionPoints] = useState<Record<Sport, number>>({ football: 0, cricket: 0, rugby: 0 });
  const [interested, setInterested] = useState<string[]>([]);
  const [groupsJoined, setGroupsJoined] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const [{ data: profile }, { data: preds }, { count: groupCount }] = await Promise.all([
        sb.from("profiles").select("interested_sports").eq("id", user.id).single(),
        sb.from("score_predictions")
          .select("points_earned, matches(sport)")
          .eq("user_id", user.id).not("points_earned", "is", null),
        sb.from("league_members").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      setInterested(profile?.interested_sports ?? ["football"]);
      setGroupsJoined(groupCount ?? 0);

      const totals: Record<Sport, number> = { football: 0, cricket: 0, rugby: 0 };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (preds ?? []).forEach((p: any) => {
        const s = p.matches?.sport as Sport | undefined;
        if (s && s in totals) totals[s] += p.points_earned;
      });
      setPredictionPoints(totals);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen">
      <TopBar title="Games" subtitle="Everything you can play, in one place" />

      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h2 className="text-base font-bold text-zff-black mb-4">By Sport</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {SPORTS.map((s, i) => {
              const isFollowed = interested.includes(s.id);
              return (
                <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={cn("glass-card p-6 relative overflow-hidden", isFollowed && "border-zff-green/30")}>
                  {isFollowed && (
                    <span className="absolute top-4 right-4 text-[10px] font-bold text-zff-green bg-zff-green/10 border border-zff-green/20 rounded-full px-2 py-0.5">
                      Following
                    </span>
                  )}
                  <div className="text-3xl mb-3">{s.emoji}</div>
                  <h3 className="font-bold text-zff-black text-lg mb-1">{s.label}</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    {loading ? "Loading…" : `${predictionPoints[s.id]} prediction pts`}
                  </p>

                  <div className="space-y-2">
                    {scorePredictionsEnabled && (
                      <Link href={`/predictions?sport=${s.id}`}
                        className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-zff-green/30 hover:bg-slate-50 transition-all group">
                        <Target className="w-4 h-4 text-zff-green shrink-0" />
                        <span className="text-sm text-zff-black font-medium flex-1">Score Predictions</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-zff-green transition-colors" />
                      </Link>
                    )}
                    {s.id === "football" && fantasyTeamsEnabled && (
                      <Link href="/my-team"
                        className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-zff-green/30 hover:bg-slate-50 transition-all group">
                        <Crown className="w-4 h-4 text-zff-green shrink-0" />
                        <span className="text-sm text-zff-black font-medium flex-1">Fantasy Team</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-zff-green transition-colors" />
                      </Link>
                    )}
                    {s.id === "football" && fantasyTeamsEnabled && (
                      <Link href="/market"
                        className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-zff-green/30 hover:bg-slate-50 transition-all group">
                        <ShoppingCart className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="text-sm text-zff-black font-medium flex-1">Player Market</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-zff-green transition-colors" />
                      </Link>
                    )}
                    {s.id !== "football" && !scorePredictionsEnabled && (
                      <p className="text-xs text-muted-foreground text-center py-3">No games available right now</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-base font-bold text-zff-black mb-4">Community</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="glass-card p-6">
              <div className="flex items-center gap-2.5 mb-3">
                <Trophy className="w-5 h-5 text-zff-green" />
                <h3 className="font-bold text-zff-black">Private Groups</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {loading ? "Loading…" : `You're in ${groupsJoined} group${groupsJoined === 1 ? "" : "s"}. Groups get their own predictions leaderboard and can run their own polls.`}
              </p>
              <Link href="/leagues" className="btn-outline w-full flex items-center justify-center gap-2 py-2.5 text-sm">
                <Users className="w-3.5 h-3.5" /> View My Groups
              </Link>
            </div>
            {pollsEnabled && (
              <div className="glass-card p-6">
                <div className="flex items-center gap-2.5 mb-3">
                  <MessageSquare className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold text-zff-black">Fan Polls</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Vote on admin polls or create your own for a group you belong to.
                </p>
                <Link href="/polls" className="btn-outline w-full flex items-center justify-center gap-2 py-2.5 text-sm">
                  <MessageSquare className="w-3.5 h-3.5" /> Go to Fan Polls
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
