"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { TopBar } from "@/components/layout/TopBar";
import { Radio, Zap, TrendingUp, AlertCircle, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";
import { FeatureDisabled } from "@/components/ui/FeatureDisabled";

type Sport = "football" | "cricket" | "rugby";

const SPORT_TABS: { id: Sport; label: string; emoji: string }[] = [
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "cricket",  label: "Cricket",  emoji: "🏏" },
  { id: "rugby",    label: "Rugby",    emoji: "🏉" },
];

function SportTabs({ value, onChange }: { value: Sport; onChange: (s: Sport) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-5">
      {SPORT_TABS.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5",
            value === s.id ? "bg-white text-zff-black shadow-sm" : "text-muted-foreground hover:text-zff-black"
          )}
        >
          <span>{s.emoji}</span> {s.label}
        </button>
      ))}
    </div>
  );
}

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

// Cricket/rugby matches have no fixed 90-minute duration, so this just counts
// up from kickoff instead of capping — a long cricket innings genuinely can
// run for hours.
function useElapsedMinutes(kickoffTime: string | null) {
  const [minutes, setMinutes] = useState(0);
  useEffect(() => {
    if (!kickoffTime) return;
    function tick() {
      setMinutes(Math.max(0, Math.floor((Date.now() - new Date(kickoffTime!).getTime()) / 60000)));
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

function FootballLive({ sport, onSportChange }: { sport: Sport; onSportChange: (s: Sport) => void }) {
  const [liveMatch, setLiveMatch] = useState<{
    id: string; home: string; away: string;
    homeScore: number; awayScore: number;
    matchday: number; kickoffTime: string;
  } | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myTeam, setMyTeam] = useState<MyTeamPlayer[]>([]);

  const matchTime = useMatchClock(liveMatch?.kickoffTime ?? null);

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

  if (!liveMatch) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden">
        <TopBar title="Live Center" subtitle="No match currently live" />
        <div className="p-4 sm:p-6 lg:p-8">
          <SportTabs value={sport} onChange={onSportChange} />
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <Radio className="w-12 h-12 text-slate-300 mb-4" />
            <h2 className="text-lg font-bold text-zff-black mb-2">No Live Football Match Right Now</h2>
            <p className="text-sm text-muted-foreground max-w-md">Check the Dashboard for upcoming fixtures. This page updates automatically when a football match goes live.</p>
            <Link href="/predictions" className="text-sm text-zff-green font-semibold hover:underline mt-4">
              Following cricket or rugby? Switch tabs above for their live scores →
            </Link>
          </div>
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
        <SportTabs value={sport} onChange={onSportChange} />

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

interface PredictionOnlyMatch {
  id: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  matchday: number;
  kickoffTime: string;
}

interface PredictorRow {
  userId: string;
  username: string;
  predHome: number;
  predAway: number;
  delta: number;
}

// Cricket and rugby have no player roster or event log in this app (see
// lib/actions/admin.ts's finishPredictionOnlyMatchAction) — matches there
// only ever carry a running score for Score Predictions. So instead of a
// match-events feed and per-player fantasy points, this shows the live score
// plus a live "closest predictor" leaderboard, recalculated as the score
// changes (final points are only awarded once the match finishes).
function PredictionOnlyLive({ sport, onSportChange }: { sport: Sport; onSportChange: (s: Sport) => void }) {
  const [match, setMatch] = useState<PredictionOnlyMatch | null>(null);
  const [predictors, setPredictors] = useState<PredictorRow[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const elapsed = useElapsedMinutes(match?.kickoffTime ?? null);

  useEffect(() => {
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setMyUserId(user?.id ?? null);

        const { data: m } = await sb.from("matches").select("*").eq("sport", sport).eq("status", "live")
          .order("kickoff_time", { ascending: false }).limit(1).maybeSingle();
        if (!m) { setMatch(null); setPredictors([]); return; }

        const homeScore = m.home_score ?? 0;
        const awayScore = m.away_score ?? 0;
        setMatch({ id: m.id, home: m.home_team, away: m.away_team, homeScore, awayScore, matchday: m.matchday, kickoffTime: m.kickoff_time });

        const { data: preds } = await sb.from("score_predictions")
          .select("user_id, predicted_home_score, predicted_away_score").eq("match_id", m.id);
        if (!preds?.length) { setPredictors([]); return; }

        const ids = [...new Set(preds.map((p: { user_id: string }) => p.user_id))];
        const { data: profiles } = await sb.from("profiles").select("id, username").in("id", ids);
        const nameMap = new Map<string, string>(
          (profiles ?? []).map((p: { id: string; username: string }) => [p.id, p.username])
        );

        setPredictors(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (preds as any[]).map((p) => ({
            userId: p.user_id,
            username: nameMap.get(p.user_id) ?? "Manager",
            predHome: p.predicted_home_score,
            predAway: p.predicted_away_score,
            delta: Math.abs(p.predicted_home_score - homeScore) + Math.abs(p.predicted_away_score - awayScore),
          })).sort((a, b) => a.delta - b.delta)
        );
      } catch { /* show empty */ }
    }

    load();

    const channel = supabase.channel(`live_updates_${sport}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "matches" }, (payload: any) => {
        if (payload.new.sport !== sport) return;
        load();
      })
      // A new or edited prediction changes the "closest so far" ranking —
      // reload rather than patch in place, since this is low-frequency and
      // the recompute is cheap.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "score_predictions" }, () => load())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "score_predictions" }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sport]);

  const sportLabel = sport === "cricket" ? "Cricket" : "Rugby";

  if (!match) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden">
        <TopBar title="Live Center" subtitle="No match currently live" />
        <div className="p-4 sm:p-6 lg:p-8">
          <SportTabs value={sport} onChange={onSportChange} />
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <Radio className="w-12 h-12 text-slate-300 mb-4" />
            <h2 className="text-lg font-bold text-zff-black mb-2">No Live {sportLabel} Match Right Now</h2>
            <p className="text-sm text-muted-foreground max-w-md">Check Match Stats for results and upcoming fixtures. This page updates automatically when a {sportLabel.toLowerCase()} match goes live.</p>
            <Link href="/predictions" className="text-sm text-zff-green font-semibold hover:underline mt-4">
              Make your Score Predictions →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <TopBar
        title={`${sportLabel} Live Center`}
        subtitle={`Matchday ${match.matchday} — Now Live`}
        rightContent={<div className="live-badge"><Radio className="w-3 h-3" /> LIVE</div>}
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <SportTabs value={sport} onChange={onSportChange} />

        {/* Score Banner */}
        <motion.div className="glass-card p-4 sm:p-6 mb-5 border-zff-green/20 bg-zff-green/5"
          animate={{ boxShadow: ["0 0 20px rgba(21,128,61,0.15)", "0 0 40px rgba(21,128,61,0.3)", "0 0 20px rgba(21,128,61,0.15)"] }}
          transition={{ duration: 2, repeat: Infinity }}>
          <div className="flex items-center justify-between">
            <div className="text-center flex-1 min-w-0 px-2">
              <p className="text-xs text-muted-foreground mb-1">Home</p>
              <p className="text-sm sm:text-xl font-bold truncate text-zff-black">{match.home}</p>
            </div>
            <div className="text-center shrink-0 px-2 sm:px-8">
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="text-4xl sm:text-6xl font-display text-zff-black">{match.homeScore}</span>
                <span className="text-2xl sm:text-3xl text-muted-foreground">&ndash;</span>
                <span className="text-4xl sm:text-6xl font-display text-zff-black">{match.awayScore}</span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-bold text-zff-black">{elapsed}m in</span>
              </div>
            </div>
            <div className="text-center flex-1 min-w-0 px-2">
              <p className="text-xs text-muted-foreground mb-1">Away</p>
              <p className="text-sm sm:text-xl font-bold truncate text-zff-black">{match.away}</p>
            </div>
          </div>
        </motion.div>

        {/* Closest Predictors */}
        <div className="glass-card max-w-2xl">
          <div className="p-5 border-b border-slate-200 flex items-center gap-2.5">
            <Target className="w-4 h-4 text-zff-green" />
            <h2 className="font-bold text-zff-black text-sm">Closest Predictors</h2>
            {predictors.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{predictors.length} predictions</span>}
          </div>
          {predictors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No Score Predictions submitted for this match</p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              <AnimatePresence initial={false}>
                {predictors.map((p, i) => (
                  <motion.div key={p.userId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className={cn("flex items-center gap-3 p-4", p.userId === myUserId ? "bg-zff-green/10" : "hover:bg-slate-50/50")}>
                    <div className={cn("rank-badge text-xs shrink-0", i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "text-muted-foreground border border-slate-200")}>
                      {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs font-semibold truncate", p.userId === myUserId ? "text-zff-green" : "text-zff-black")}>
                        {p.userId === myUserId ? "You" : p.username}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Predicted {p.predHome} – {p.predAway}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-zff-green">±{p.delta}</p>
                      <p className="text-[10px] text-muted-foreground">off current score</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
          <div className="border-t border-slate-200 p-3">
            <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
              <AlertCircle className="w-3 h-3" /> Updates via Supabase Realtime · final points awarded at full time
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LivePage() {
  const [sport, setSport] = useState<Sport>("football");
  const liveScoringEnabled = useFeatureFlag("liveScoring");

  if (!liveScoringEnabled) {
    return <FeatureDisabled title="Live Scoring" message="Live matchday updates are temporarily paused. Check the Dashboard for fixtures." />;
  }

  return sport === "football"
    ? <FootballLive sport={sport} onSportChange={setSport} />
    : <PredictionOnlyLive sport={sport} onSportChange={setSport} />;
}
