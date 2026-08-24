"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { Radio, Zap, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";
import { FeatureDisabled } from "@/components/ui/FeatureDisabled";

interface LiveEvent {
  id: string;
  minute: number;
  event_type: string;
  player_name: string;
  player_id: string | null;
}

interface MyTeamPlayer {
  player_id: string;
  position: string;
  is_captain: boolean;
  is_vice_captain: boolean;
}

const GOAL_PTS: Record<string, number> = { GK: 10, DEF: 6, MID: 5, FWD: 4 };

function calcLivePoints(events: LiveEvent[], myTeam: MyTeamPlayer[]): number {
  let total = 0;
  for (const tp of myTeam) {
    const playerEvents = events.filter(e => e.player_id === tp.player_id);
    let pts = 0;
    for (const ev of playerEvents) {
      if (ev.event_type === "goal")             pts += GOAL_PTS[tp.position] ?? 4;
      else if (ev.event_type === "assist")      pts += 3;
      else if (ev.event_type === "yellow_card") pts -= 1;
      else if (ev.event_type === "red_card")    pts -= 3;
    }
    const mult = tp.is_captain ? 2 : tp.is_vice_captain ? 1.5 : 1;
    total += Math.floor(Math.max(0, pts) * mult);
  }
  return total;
}

interface LeaderboardEntry {
  rank: number;
  username: string;
  teamName: string;
  total: number;
}

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + increment, value);
      setDisplay(Math.floor(current));
      if (current >= value) clearInterval(timer);
    }, 800 / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}</span>;
}

function useMatchClock(kickoffTime: string | null) {
  const [minutes, setMinutes] = useState(0);
  useEffect(() => {
    if (!kickoffTime) return;
    function tick() {
      const elapsed = Math.floor((Date.now() - new Date(kickoffTime!).getTime()) / 60000);
      setMinutes(Math.max(0, Math.min(90, elapsed)));
    }
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [kickoffTime]);
  return minutes;
}

const EVENT_CONFIG: Record<string, { icon: string; label: string; pts: string; bg: string; text: string }> = {
  goal:              { icon: "⚽", label: "GOAL!",         pts: "+4", bg: "bg-zff-green/20 border-zff-green/30",     text: "text-zff-green"    },
  own_goal:          { icon: "🔴", label: "OWN GOAL",      pts: "-",  bg: "bg-orange-500/20 border-orange-500/30", text: "text-orange-500"  },
  opponent_own_goal: { icon: "🔵", label: "OWN GOAL",      pts: "-",  bg: "bg-teal-500/20 border-teal-500/30",     text: "text-teal-600"    },
  opponent_goal:     { icon: "⚫", label: "GOAL",           pts: "-",  bg: "bg-slate-200 border-slate-300",           text: "text-slate-500"   },
  assist:            { icon: "🎯", label: "ASSIST",         pts: "+3", bg: "bg-purple-500/20 border-purple-500/30", text: "text-purple-400"  },
  yellow_card:       { icon: "🟨", label: "YELLOW CARD",   pts: "-1", bg: "bg-amber-500/20 border-amber-500/30",   text: "text-amber-400"   },
  red_card:          { icon: "🟥", label: "RED CARD",       pts: "-3", bg: "bg-red-500/20 border-red-500/30",       text: "text-red-400"     },
};

export default function LivePage() {
  const [liveMatch, setLiveMatch] = useState<{
    id: string; home: string; away: string;
    homeScore: number; awayScore: number;
    matchday: number; kickoffTime: string;
  } | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myTeam, setMyTeam] = useState<MyTeamPlayer[]>([]);

  const matchTime = useMatchClock(liveMatch?.kickoffTime ?? null);
  const liveScoringEnabled = useFeatureFlag("liveScoring");

  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // Live match
        const { data: match } = await sb.from("matches").select("*").eq("sport", "football").eq("status", "live")
          .order("kickoff_time", { ascending: false }).limit(1).maybeSingle();
        if (!match) { setLiveMatch(null); return; }

        setLiveMatch({
          id: match.id,
          home: match.home_team, away: match.away_team,
          homeScore: match.home_score ?? 0, awayScore: match.away_score ?? 0,
          matchday: match.matchday, kickoffTime: match.kickoff_time,
        });

        // Real match events
        const { data: evData } = await sb.from("match_events").select("*")
          .eq("match_id", match.id).order("minute", { ascending: true });
        setEvents(evData ?? []);

        // Leaderboard
        const { data: profiles } = await sb.from("profiles").select("id, username, fantasy_points")
          .order("fantasy_points", { ascending: false }).limit(7);
        if (profiles?.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setLiveLeaderboard((profiles as any[]).map((p: any, i: number) => ({
            rank: i + 1,
            username: user && p.id === user.id ? "YourTeam" : p.username,
            teamName: `${p.username}'s XI`,
            total: p.fantasy_points ?? 0,
          })));
        }

        // User's starting XI for live point calculation
        if (user) {
          const { data: ft } = await sb.from("fantasy_teams").select("id").eq("user_id", user.id).maybeSingle();
          if (ft) {
            const { data: ftp } = await sb
              .from("fantasy_team_players")
              .select("player_id, is_captain, is_vice_captain, players(position)")
              .eq("fantasy_team_id", ft.id)
              .eq("is_starting", true);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setMyTeam((ftp ?? []).map((tp: any) => ({
              player_id: tp.player_id,
              position: tp.players?.position ?? "MID",
              is_captain: tp.is_captain,
              is_vice_captain: tp.is_vice_captain,
            })));
          }
        }
      } catch { /* show empty */ }
    }

    load();

    const channel = supabase.channel("live_updates")
      // Score updates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches" }, (payload: any) => {
        const m = payload.new;
        if (m.status === "live") {
          setLiveMatch(prev => prev ? { ...prev, homeScore: m.home_score ?? 0, awayScore: m.away_score ?? 0 } : null);
        } else if (m.status !== "live") {
          setLiveMatch(null);
        }
      })
      // New events appear instantly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_events" }, (payload: any) => {
        setEvents(prev => [...prev, payload.new as LiveEvent].sort((a, b) => a.minute - b.minute));
      })
      // Deleted events removed instantly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "match_events" }, (payload: any) => {
        setEvents(prev => prev.filter(e => e.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!liveScoringEnabled) {
    return <FeatureDisabled title="Live Scoring" message="Live matchday updates are temporarily paused. Check the Dashboard for fixtures." />;
  }

  if (!liveMatch) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden">
        <TopBar title="Football Live Center" subtitle="No match currently live" />
        <div className="p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
          <Radio className="w-12 h-12 text-slate-300 mb-4" />
          <h2 className="text-lg font-bold text-zff-black mb-2">No Live Football Match Right Now</h2>
          <p className="text-sm text-muted-foreground max-w-md">Check the Dashboard for upcoming fixtures. This page updates automatically when a football match goes live.</p>
          <Link href="/predictions" className="text-sm text-zff-green font-semibold hover:underline mt-4">
            Following cricket or rugby? Head to Score Predictions →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <TopBar
        title="Football Live Center"
        subtitle={`Matchday ${liveMatch.matchday} — Now Live`}
        rightContent={<div className="live-badge"><Radio className="w-3 h-3" /> LIVE</div>}
      />

      <div className="p-4 sm:p-6 lg:p-8">
        {/* Score Banner */}
        <motion.div className="glass-card p-4 sm:p-6 mb-5 border-zff-green/20 bg-zff-green/5"
          animate={{ boxShadow: ["0 0 20px rgba(21,128,61,0.15)", "0 0 40px rgba(21,128,61,0.3)", "0 0 20px rgba(21,128,61,0.15)"] }}
          transition={{ duration: 2, repeat: Infinity }}>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1 min-w-0 px-2">
              <p className="text-xs text-muted-foreground mb-1">Home</p>
              <p className="text-sm sm:text-xl font-bold truncate text-zff-black">{liveMatch.home}</p>
            </div>
            <div className="text-center shrink-0 px-2 sm:px-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-4xl sm:text-6xl font-display text-zff-black">{liveMatch.homeScore}</span>
                <span className="text-2xl sm:text-3xl text-muted-foreground">&ndash;</span>
                <span className="text-4xl sm:text-6xl font-display text-zff-black">{liveMatch.awayScore}</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-bold text-zff-black">{matchTime > 0 ? `${matchTime}'` : "KO"}</span>
              </div>
            </div>
            <div className="text-center flex-1 min-w-0 px-2">
              <p className="text-xs text-muted-foreground mb-1">Away</p>
              <p className="text-sm sm:text-xl font-bold truncate text-zff-black">{liveMatch.away}</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Match Events Feed */}
          <div className="glass-card">
            <div className="p-5 border-b border-slate-200 flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-zff-green animate-pulse" />
              <h2 className="font-bold text-zff-black text-sm">Match Events</h2>
              {events.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{events.length} events</span>}
            </div>
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No events logged yet</p>
              ) : (
                <AnimatePresence initial={false}>
                  {[...events].reverse().map((ev) => {
                    const cfg = EVENT_CONFIG[ev.event_type] ?? { icon: "📋", label: ev.event_type, pts: "", bg: "bg-slate-100 border-slate-200", text: "text-muted-foreground" };
                    return (
                      <motion.div key={ev.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="p-3">
                        <div className="flex items-start gap-3">
                          <div className={cn("px-2 py-1 rounded-lg border text-xs font-bold shrink-0", cfg.bg, cfg.text)}>{ev.minute}&apos;</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-zff-black">{cfg.icon} {cfg.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{ev.player_name}</p>
                          </div>
                          {cfg.pts && <span className={cn("text-xs font-bold shrink-0", cfg.pts.startsWith("+") ? "text-zff-green" : "text-red-400")}>{cfg.pts}</span>}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Your Live Score */}
          <div className="glass-card">
            <div className="p-5 border-b border-slate-200 flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="font-bold text-zff-black text-sm">Live Points</h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Big total */}
              <div className="text-center py-2">
                <p className="text-xs text-muted-foreground mb-1">From this match</p>
                <p className="text-5xl font-display text-zff-green">
                  <AnimatedCounter value={calcLivePoints(events, myTeam)} />
                </p>
              </div>

              {/* Per-player breakdown */}
              {(() => {
                const rows = myTeam.map(tp => {
                  const playerEvents = events.filter(e =>
                    e.player_id === tp.player_id &&
                    ["goal","assist","yellow_card","red_card"].includes(e.event_type)
                  );
                  if (playerEvents.length === 0) return null;

                  let rawPts = 0;
                  const icons: string[] = [];
                  for (const ev of playerEvents) {
                    if (ev.event_type === "goal")        { rawPts += GOAL_PTS[tp.position] ?? 4; icons.push("⚽"); }
                    else if (ev.event_type === "assist") { rawPts += 3; icons.push("🎯"); }
                    else if (ev.event_type === "yellow_card") { rawPts -= 1; icons.push("🟨"); }
                    else if (ev.event_type === "red_card")    { rawPts -= 3; icons.push("🟥"); }
                  }
                  const mult = tp.is_captain ? 2 : tp.is_vice_captain ? 1.5 : 1;
                  const finalPts = Math.floor(Math.max(0, rawPts) * mult);
                  return { name: playerEvents[0].player_name, tp, icons, rawPts, finalPts, mult };
                }).filter(Boolean);

                if (rows.length === 0) return (
                  <p className="text-xs text-muted-foreground text-center py-2">None of your players involved yet</p>
                );

                return (
                  <div className="border-t border-slate-100 pt-3 space-y-2.5">
                    {rows.map((row, i) => row && (
                      <div key={i} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-zff-black truncate">{row.name}</span>
                            {row.tp.is_captain && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded leading-none">C</span>}
                            {row.tp.is_vice_captain && <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded leading-none">VC</span>}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {row.icons.join(" ")}
                            {row.mult > 1 && <span className="ml-1 text-amber-500">×{row.mult}</span>}
                          </p>
                        </div>
                        <span className={cn("text-sm font-bold shrink-0", row.finalPts >= 0 ? "text-zff-green" : "text-red-400")}>
                          {row.finalPts >= 0 ? "+" : ""}{row.finalPts}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <p className="text-[10px] text-muted-foreground text-center border-t border-slate-100 pt-3">
                Minutes + clean sheet added at full time
              </p>
            </div>
          </div>

          {/* Live Leaderboard */}
          <div className="glass-card">
            <div className="p-5 border-b border-slate-200 flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-zff-green" />
              <h2 className="font-bold text-zff-black text-sm">Live Leaderboard</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {liveLeaderboard.map((entry, i) => (
                <motion.div key={entry.rank} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className={cn("flex items-center gap-3 p-4", entry.username === "YourTeam" ? "bg-zff-green/10" : "hover:bg-slate-50/50")}>
                  <div className={cn("rank-badge text-xs shrink-0", entry.rank === 1 ? "rank-1" : entry.rank === 2 ? "rank-2" : entry.rank === 3 ? "rank-3" : "text-muted-foreground border border-slate-200")}>
                    {entry.rank <= 3 ? ["🥇","🥈","🥉"][entry.rank - 1] : entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-semibold truncate", entry.username === "YourTeam" ? "text-zff-green" : "text-zff-black")}>
                      {entry.username === "YourTeam" ? "You" : entry.teamName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">@{entry.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-zff-green">{entry.total.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">total pts</p>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="border-t border-slate-200 p-3">
              <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3" /> Updates via Supabase Realtime
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
