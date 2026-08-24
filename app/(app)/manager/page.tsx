"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { Radio, Trophy, Edit, Plus, Zap, X, Clock, CheckCircle, XCircle } from "lucide-react";
import { cn, getPositionColor } from "@/lib/utils";
import { cancelMatchLiveAction, logMatchEventAction, deleteMatchEventAction, reopenMatchAction } from "@/lib/actions/admin";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";
import { FeatureDisabled } from "@/components/ui/FeatureDisabled";

interface AdminMatch {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_time: string;
  status: string;
  matchday: number;
  season: string;
}

interface PlayerStatRow {
  player_id: string;
  name: string;
  position: string;
  club: string;
  minutes: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheet: boolean;
  fantasy_points: number;
}

export default function ManagerPage() {
  // Managers sit below admin in the role hierarchy, but this whole page —
  // fixtures, live scoring, player stats, injury flags — only exists to
  // operate the football fantasy engine. If an admin has switched Fantasy
  // Teams off (the same flag app/(app)/my-team/page.tsx checks), a manager
  // shouldn't still have full access to the tooling behind it.
  const fantasyTeamsEnabled = useFeatureFlag("fantasyTeams");
  // Live scoring is a separate, more granular flag — an admin might pause
  // just the live matchday stream without pausing fixture/stats management,
  // so this only gates the "go live" action, not the whole page.
  const liveScoringEnabled = useFeatureFlag("liveScoring");
  const [activeTab, setActiveTab] = useState<"matches" | "players">("matches");

  // ── Matches ──────────────────────────────────────────────────────────────
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [scoringMatch, setScoringMatch] = useState<AdminMatch | null>(null);
  const [playerStatRows, setPlayerStatRows] = useState<PlayerStatRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [savingStats, setSavingStats] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);
  const [addFixtureOpen, setAddFixtureOpen] = useState(false);
  const [fixtureForm, setFixtureForm] = useState({ home: "", away: "", matchday: "", kickoff: "", season: "2026" });
  const [savingFixture, setSavingFixture] = useState(false);

  // ── Live Scoring ─────────────────────────────────────────────────────────
  const [liveScoreMatch, setLiveScoreMatch] = useState<AdminMatch | null>(null);
  const [liveEvents, setLiveEvents] = useState<{ id: string; minute: number; event_type: string; side: string; player_name: string }[]>([]);
  const [eventForm, setEventForm] = useState({ minute: "", event_type: "goal", side: "home", player_id: "", player_name: "" });
  const [loggingEvent, setLoggingEvent] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [matchPlayers, setMatchPlayers] = useState<{ id: string; name: string; position: string; club: string }[]>([]);

  // ── Players ───────────────────────────────────────────────────────────────
  const [players, setPlayers] = useState<{ id: string; name: string; position: string; club: string; total_points: number; is_injured: boolean }[]>([]);
  const [togglingInjury, setTogglingInjury] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: m }, { data: p }] = await Promise.all([
        supabase.from("matches").select("*").eq("sport", "football").order("matchday", { ascending: false }),
        supabase.from("players").select("id, name, position, club, total_points, is_injured").order("position").order("total_points", { ascending: false }),
      ]);
      if (m) {
        setMatches(m as AdminMatch[]);
        const currentSeason = (m as AdminMatch[])[0]?.season ?? "2026";
        setFixtureForm(prev => ({ ...prev, season: currentSeason }));
      }
      if (p) setPlayers(p as typeof players);
    }
    load();
  }, []);

  async function openScoring(match: AdminMatch) {
    setScoringMatch(match);
    setStatsLoading(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const [{ data: allPlayers }, { data: existingStats }, { data: events }] = await Promise.all([
        supabase.from("players").select("id, name, position, club").in("club", [match.home_team, match.away_team]).order("position").order("total_points", { ascending: false }),
        sb.from("player_match_stats").select("*").eq("match_id", match.id),
        sb.from("match_events").select("*").eq("match_id", match.id),
      ]);

      const statsMap: Record<string, Partial<PlayerStatRow>> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (existingStats ?? []).forEach((s: any) => { statsMap[s.player_id] = { ...s, minutes: s.minutes_played }; });

      // Aggregate live events by player_id for pre-fill when no saved stats exist yet
      const eventsMap: Record<string, { goals: number; assists: number; yellow_cards: number; red_cards: number }> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (events ?? []).forEach((ev: any) => {
        if (!ev.player_id) return;
        if (!eventsMap[ev.player_id]) eventsMap[ev.player_id] = { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0 };
        if (ev.event_type === "goal")        eventsMap[ev.player_id].goals++;
        if (ev.event_type === "assist")      eventsMap[ev.player_id].assists++;
        if (ev.event_type === "yellow_card") eventsMap[ev.player_id].yellow_cards++;
        if (ev.event_type === "red_card")    eventsMap[ev.player_id].red_cards++;
      });

      setMatchPlayers((allPlayers ?? []) as typeof matchPlayers);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPlayerStatRows((allPlayers ?? []).map((p: any) => {
        const saved = statsMap[p.id];
        const live  = eventsMap[p.id];
        return {
          player_id: p.id, name: p.name, position: p.position, club: p.club,
          minutes:      saved?.minutes      ?? 0,
          goals:        saved?.goals        ?? live?.goals        ?? 0,
          assists:      saved?.assists      ?? live?.assists      ?? 0,
          yellow_cards: saved?.yellow_cards ?? live?.yellow_cards ?? 0,
          red_cards:    saved?.red_cards    ?? live?.red_cards    ?? 0,
          clean_sheet:  saved?.clean_sheet  ?? false,
          fantasy_points: saved?.fantasy_points ?? 0,
        };
      }));
    } finally { setStatsLoading(false); }
  }

  function updateStat(playerId: string, field: keyof PlayerStatRow, value: number | boolean) {
    setPlayerStatRows(prev => prev.map(r => r.player_id === playerId ? { ...r, [field]: value } : r));
  }

  async function saveAndFinalise() {
    if (!scoringMatch) return;
    setSavingStats(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const played = playerStatRows.filter(r => r.minutes > 0);
      if (played.length > 0) {
        await sb.from("player_match_stats").upsert(
          played.map(r => ({
            player_id: r.player_id, match_id: scoringMatch.id,
            goals: r.goals, assists: r.assists, yellow_cards: r.yellow_cards,
            red_cards: r.red_cards, clean_sheet: r.clean_sheet, minutes_played: r.minutes,
          })),
          { onConflict: "player_id,match_id" }
        );
      }
      let homeGoals = 0, awayGoals = 0;
      for (const r of played) {
        if (r.club === scoringMatch.home_team) homeGoals += r.goals;
        else if (r.club === scoringMatch.away_team) awayGoals += r.goals;
      }
      await sb.from("matches").update({
        status: "finished",
        home_score: homeGoals,
        away_score: awayGoals,
      }).eq("id", scoringMatch.id);

      setCalculating(true);
      await sb.rpc("recalculate_matchday_team_points", { p_matchday: scoringMatch.matchday, p_season: scoringMatch.season });

      const { data: fresh } = await supabase.from("matches").select("*").eq("sport", "football").order("matchday", { ascending: false });
      if (fresh) setMatches(fresh as AdminMatch[]);
      setScoringMatch(null);
    } finally { setSavingStats(false); setCalculating(false); }
  }

  async function updateMatchStatus(matchId: string, status: string) {
    setStatusUpdating(matchId);
    try {
      const supabase = createClient();
      const update: Record<string, string> = { status };
      if (status === "live") update.kickoff_time = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("matches").update(update).eq("id", matchId);
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status, ...(status === "live" ? { kickoff_time: update.kickoff_time } : {}) } : m));
    } finally { setStatusUpdating(null); }
  }

  async function saveFixture() {
    if (!fixtureForm.home || !fixtureForm.away || !fixtureForm.matchday || !fixtureForm.kickoff) return;
    setSavingFixture(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("matches").insert({
        home_team: fixtureForm.home, away_team: fixtureForm.away,
        matchday: parseInt(fixtureForm.matchday), kickoff_time: fixtureForm.kickoff,
        season: fixtureForm.season, status: "scheduled", sport: "football",
      }).select().single();
      if (data) setMatches(prev => [data as AdminMatch, ...prev].sort((a, b) => b.matchday - a.matchday));
      setAddFixtureOpen(false);
      setFixtureForm({ home: "", away: "", matchday: "", kickoff: "", season: "2026" });
    } finally { setSavingFixture(false); }
  }

  async function openLiveScoring(match: AdminMatch) {
    setLiveScoreMatch(match);
    const supabase = createClient();
    const [{ data }, { data: mp }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("match_events").select("*").eq("match_id", match.id).order("minute", { ascending: true }),
      supabase.from("players").select("id, name, position, club").in("club", [match.home_team, match.away_team]).order("position"),
    ]);
    setLiveEvents(data ?? []);
    setMatchPlayers((mp ?? []) as typeof matchPlayers);
    setEventForm({ minute: "", event_type: "goal", side: "home", player_id: "", player_name: "" });
  }

  async function submitEvent() {
    if (!liveScoreMatch || !eventForm.minute || !eventForm.player_name) return;
    setLoggingEvent(true);
    try {
      const result = await logMatchEventAction({
        match_id: liveScoreMatch.id,
        player_id: eventForm.player_id || null,
        player_name: eventForm.player_name,
        event_type: eventForm.event_type as "goal" | "own_goal" | "assist" | "yellow_card" | "red_card",
        side: eventForm.side as "home" | "away",
        minute: parseInt(eventForm.minute),
      });
      if (result.success && result.event) {
        setLiveEvents(prev => [...prev, result.event].sort((a, b) => a.minute - b.minute));
        // Refresh match score
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: fresh } = await (supabase as any).from("matches").select("*").eq("id", liveScoreMatch.id).single();
        if (fresh) {
          setMatches(prev => prev.map(m => m.id === liveScoreMatch.id ? fresh as AdminMatch : m));
          setLiveScoreMatch(fresh as AdminMatch);
        }
        setEventForm(p => ({ ...p, minute: "", player_id: "", player_name: "" }));
      }
    } finally { setLoggingEvent(false); }
  }

  async function deleteEvent(eventId: string) {
    await deleteMatchEventAction(eventId, liveScoreMatch!.id);
    setLiveEvents(prev => prev.filter(e => e.id !== eventId));
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fresh } = await (supabase as any).from("matches").select("*").eq("id", liveScoreMatch!.id).single();
    if (fresh) {
      setMatches(prev => prev.map(m => m.id === liveScoreMatch!.id ? fresh as AdminMatch : m));
      setLiveScoreMatch(fresh as AdminMatch);
    }
  }

  async function handleReopen(match: AdminMatch) {
    if (!confirm(`Reopen "${match.home_team} vs ${match.away_team}"?\n\nThis will:\n• Reverse all fantasy points from this match\n• Delete saved player stats\n• Set the match back to Live so you can re-score`)) return;
    setReopening(true);
    try {
      const result = await reopenMatchAction(match.id, match.matchday, match.season);
      if (result.success) {
        setMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: "live", home_score: null, away_score: null } : m));
        setScoringMatch(null);
      }
    } finally { setReopening(false); }
  }

  async function toggleInjury(id: string, current: boolean) {
    setTogglingInjury(id);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("players").update({ is_injured: !current }).eq("id", id);
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, is_injured: !current } : p));
    } finally { setTogglingInjury(null); }
  }

  if (!fantasyTeamsEnabled) {
    return <FeatureDisabled title="Manager Panel" message="Fantasy Teams is temporarily paused, so match scoring and player management are unavailable too." />;
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Manager Panel" subtitle="Match scoring and player management" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Tab nav */}
        <div className="flex gap-2">
          {[
            { id: "matches", label: "Matches & Scoring", short: "Matches", icon: Radio },
            { id: "players", label: "Players",           short: "Players", icon: Trophy },
          ].map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-1.5 px-3 sm:px-5 py-2.5 rounded-xl text-sm font-medium border transition-all",
                activeTab === tab.id
                  ? "bg-zff-green/10 border-zff-green/30 text-zff-green"
                  : "border-slate-200 text-muted-foreground hover:border-zff-green/20 hover:text-zff-black"
              )}
            >
              <tab.icon className="w-4 h-4 shrink-0" />
              <span className="sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Matches tab ── */}
          {activeTab === "matches" && (
            <motion.div key="matches" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-zff-black">Fixture Management</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Set match status · Enter stats · Finalise points</p>
                  </div>
                  <button onClick={() => setAddFixtureOpen(true)} className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0">
                    <Plus className="w-3 h-3" /> Add Fixture
                  </button>
                </div>

                <AnimatePresence>
                  {addFixtureOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-b border-slate-200 bg-slate-50 overflow-hidden">
                      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Home Team *</label>
                          <input value={fixtureForm.home} onChange={e => setFixtureForm(p => ({ ...p, home: e.target.value }))} placeholder="e.g. Highlanders FC" className="input text-sm py-2" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Away Team *</label>
                          <input value={fixtureForm.away} onChange={e => setFixtureForm(p => ({ ...p, away: e.target.value }))} placeholder="e.g. Dynamos FC" className="input text-sm py-2" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Matchday *</label>
                          <input type="number" value={fixtureForm.matchday} onChange={e => setFixtureForm(p => ({ ...p, matchday: e.target.value }))} placeholder="12" className="input text-sm py-2" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Kickoff *</label>
                          <input type="datetime-local" value={fixtureForm.kickoff} onChange={e => setFixtureForm(p => ({ ...p, kickoff: e.target.value }))} className="input text-sm py-2" /></div>
                        <div><label className="text-xs font-medium text-muted-foreground mb-1 block">Season</label>
                          <input value={fixtureForm.season} onChange={e => setFixtureForm(p => ({ ...p, season: e.target.value }))} className="input text-sm py-2" /></div>
                        <div className="flex items-end gap-2">
                          <button onClick={saveFixture} disabled={savingFixture || !fixtureForm.home || !fixtureForm.away} className="btn-primary text-xs py-2 px-4 flex-1 disabled:opacity-60">
                            {savingFixture ? "Saving…" : "Save Fixture"}</button>
                          <button onClick={() => setAddFixtureOpen(false)} className="btn-outline text-xs py-2 px-3">Cancel</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="divide-y divide-slate-100">
                  {matches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No fixtures yet</p>
                  ) : matches.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4 hover:bg-slate-50/50 transition-colors">
                      {/* Matchday + date */}
                      <div className="w-14 sm:w-24 shrink-0">
                        <p className="text-xs font-bold text-zff-green">MD{m.matchday}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                          {new Date(m.kickoff_time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          <span className="hidden sm:inline"> · {new Date(m.kickoff_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                        </p>
                      </div>

                      {/* Teams + score */}
                      <div className="flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-3">
                        <span className="text-xs sm:text-sm font-bold text-right flex-1 truncate text-zff-black">{m.home_team}</span>
                        <span className="text-xs sm:text-sm font-bold text-zff-black shrink-0 w-10 sm:w-12 text-center">
                          {m.status === "finished" || m.status === "live" ? `${m.home_score ?? 0} – ${m.away_score ?? 0}` : "vs"}
                        </span>
                        <span className="text-xs sm:text-sm font-bold flex-1 truncate text-zff-black">{m.away_team}</span>
                      </div>

                      {/* Status badge — hidden on mobile to save space */}
                      <span className={cn("hidden sm:inline text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0",
                        m.status === "live" ? "bg-red-500/20 border-red-500/30 text-red-500 animate-pulse" :
                        m.status === "finished" ? "bg-slate-100 border-slate-200 text-muted-foreground" :
                        "bg-zff-green/10 border-zff-green/30 text-zff-green")}>
                        {m.status.toUpperCase()}
                      </span>

                      {/* Action */}
                      <div className="shrink-0">
                        {m.status === "scheduled" && (
                          <button onClick={() => updateMatchStatus(m.id, "live")} disabled={statusUpdating === m.id || !liveScoringEnabled}
                            title={liveScoringEnabled ? undefined : "Live Scoring is disabled in Feature Flags"}
                            className="text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-colors disabled:opacity-50 whitespace-nowrap">
                            {statusUpdating === m.id ? "…" : "▶ Live"}
                          </button>
                        )}
                        {m.status === "live" && (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openLiveScoring(m)}
                              className="text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-colors flex items-center gap-1 whitespace-nowrap">
                              <Zap className="w-3 h-3" /> Live
                            </button>
                            <button onClick={() => openScoring(m)}
                              className="text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-lg bg-zff-green/10 border border-zff-green/30 text-zff-green hover:bg-zff-green/20 transition-colors flex items-center gap-1 whitespace-nowrap">
                              <Edit className="w-3 h-3" /> Stats
                            </button>
                            <button
                              onClick={async () => {
                                setStatusUpdating(m.id);
                                try { await cancelMatchLiveAction(m.id); setMatches(prev => prev.map(x => x.id === m.id ? { ...x, status: "scheduled" } : x)); }
                                finally { setStatusUpdating(null); }
                              }}
                              disabled={statusUpdating === m.id}
                              className="text-[10px] font-bold px-2 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-muted-foreground hover:border-red-400/40 hover:text-red-400 transition-colors whitespace-nowrap disabled:opacity-50"
                              title="Cancel live — reverts status and removes notifications">
                              ✕
                            </button>
                          </div>
                        )}
                        {m.status === "finished" && (
                          <button onClick={() => openScoring(m)}
                            className="text-[10px] font-bold px-2 sm:px-3 py-1.5 rounded-lg border border-slate-200 text-muted-foreground hover:border-zff-green/30 hover:text-zff-green transition-colors flex items-center gap-1 whitespace-nowrap">
                            <Edit className="w-3 h-3" /> Edit
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Players tab ── */}
          {activeTab === "players" && (
            <motion.div key="players" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card">
                <div className="p-4 sm:p-5 border-b border-slate-200">
                  <h2 className="font-bold text-zff-black">Player Availability</h2>
                  <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Toggle injury status — affects market visibility and fantasy selection</p>
                </div>

                {/* Mobile: card list */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {players.map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-display text-zff-green/70 shrink-0">
                        {p.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zff-black truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getPositionColor(p.position))}>{p.position}</span>
                          <span className="text-xs font-bold text-zff-green">{p.total_points}pts</span>
                          {p.is_injured && <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">INJ</span>}
                        </div>
                      </div>
                      <button onClick={() => toggleInjury(p.id, p.is_injured)} disabled={togglingInjury === p.id}
                        className="transition-opacity disabled:opacity-50 shrink-0">
                        {togglingInjury === p.id
                          ? <span className="w-5 h-5 border-2 border-slate-300 border-t-zff-green rounded-full animate-spin inline-block" />
                          : p.is_injured
                            ? <XCircle className="w-5 h-5 text-red-400" />
                            : <CheckCircle className="w-5 h-5 text-zff-green" />}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Player</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Position</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Total Pts</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Availability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {players.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-display text-zff-green/70">
                                {p.name.split(" ").map(n => n[0]).join("")}
                              </div>
                              <span className="text-sm font-medium text-zff-black">{p.name}</span>
                              {p.is_injured && <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">INJ</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getPositionColor(p.position))}>{p.position}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm font-bold text-zff-green">{p.total_points}</td>
                          <td className="px-4 py-3.5 text-center">
                            <button onClick={() => toggleInjury(p.id, p.is_injured)} disabled={togglingInjury === p.id}
                              className="transition-opacity disabled:opacity-50">
                              {togglingInjury === p.id
                                ? <span className="w-5 h-5 border-2 border-slate-300 border-t-zff-green rounded-full animate-spin inline-block" />
                                : p.is_injured
                                  ? <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                                  : <CheckCircle className="w-5 h-5 text-zff-green mx-auto" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Live Scoring Modal ── */}
      <AnimatePresence>
        {liveScoreMatch && (
          <>
            <motion.div key="ls-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setLiveScoreMatch(null)} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <motion.div key="ls-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

                {/* Header + score */}
                <div className="p-5 border-b border-slate-200 shrink-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-zff-black flex items-center gap-2"><Zap className="w-4 h-4 text-red-500" /> Live Scoring</h2>
                    <button onClick={() => setLiveScoreMatch(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center justify-between text-center">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1 truncate">{liveScoreMatch.home_team}</p>
                    </div>
                    <div className="px-6">
                      <p className="text-4xl font-display text-zff-black">{liveScoreMatch.home_score ?? 0} – {liveScoreMatch.away_score ?? 0}</p>
                      <p className="text-xs text-red-500 font-bold mt-1">● LIVE</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1 truncate">{liveScoreMatch.away_team}</p>
                    </div>
                  </div>
                </div>

                {/* Log event form */}
                <div className="p-5 border-b border-slate-200 shrink-0 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Log Event</p>

                  {/* Event type buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { type: "goal",        label: "⚽ Goal",     color: "bg-zff-green/10 border-zff-green/30 text-zff-green" },
                      { type: "own_goal",    label: "🔴 Own Goal", color: "bg-orange-500/10 border-orange-500/30 text-orange-500" },
                      { type: "assist",      label: "🎯 Assist",   color: "bg-purple-500/10 border-purple-500/30 text-purple-500" },
                      { type: "yellow_card", label: "🟨 Yellow",   color: "bg-amber-500/10 border-amber-500/30 text-amber-500" },
                      { type: "red_card",    label: "🟥 Red",      color: "bg-red-500/10 border-red-500/30 text-red-500" },
                    ].map(({ type, label, color }) => (
                      <button key={type}
                        onClick={() => setEventForm(p => ({ ...p, event_type: type, player_id: "", player_name: "" }))}
                        className={cn("text-[10px] font-bold py-2 rounded-xl border transition-all", eventForm.event_type === type ? color : "border-slate-200 text-muted-foreground hover:border-slate-300")}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Side toggle — which team the selected player is on */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["home", "away"] as const).map(side => (
                      <button key={side}
                        onClick={() => setEventForm(p => ({ ...p, side, player_id: "", player_name: "" }))}
                        className={cn("text-xs font-bold py-2 rounded-xl border transition-all truncate",
                          eventForm.side === side ? "bg-zff-green/10 border-zff-green/30 text-zff-green" : "border-slate-200 text-muted-foreground hover:border-slate-300")}>
                        {side === "home" ? liveScoreMatch.home_team : liveScoreMatch.away_team}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <select className="select text-sm py-2 flex-1" value={eventForm.player_id}
                      onChange={e => {
                        const p = matchPlayers.find(pl => pl.id === e.target.value);
                        setEventForm(prev => ({ ...prev, player_id: e.target.value, player_name: p?.name ?? "" }));
                      }}>
                      <option value="">Select player…</option>
                      {["GK","DEF","MID","FWD"].map(pos => (
                        <optgroup key={pos} label={pos}>
                          {matchPlayers.filter(p => p.position === pos && p.club === (eventForm.side === "home" ? liveScoreMatch.home_team : liveScoreMatch.away_team)).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {/* Minute */}
                    <input type="number" min={0} max={120} placeholder="Min" value={eventForm.minute}
                      onChange={e => setEventForm(p => ({ ...p, minute: e.target.value }))}
                      className="input text-sm py-2 w-20 shrink-0" />
                    <button onClick={submitEvent}
                      disabled={loggingEvent || !eventForm.minute || !eventForm.player_name}
                      className="btn-primary text-sm py-2 px-4 shrink-0 disabled:opacity-60">
                      {loggingEvent ? "…" : "Log"}
                    </button>
                  </div>
                </div>

                {/* Events list */}
                <div className="overflow-y-auto flex-1">
                  {liveEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No events yet</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {[...liveEvents].reverse().map(ev => {
                        const icons: Record<string, string> = { goal:"⚽", own_goal:"🔴", assist:"🎯", yellow_card:"🟨", red_card:"🟥" };
                        return (
                          <div key={ev.id} className="flex items-center gap-3 px-5 py-3">
                            <span className="text-xs font-bold text-zff-green w-8 shrink-0">{ev.minute}&apos;</span>
                            <span className="text-base">{icons[ev.event_type] ?? "📋"}</span>
                            <span className="text-sm flex-1">{ev.player_name}</span>
                            <button onClick={() => deleteEvent(ev.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Scoring Modal (identical to admin) ── */}
      <AnimatePresence>
        {scoringMatch && (
          <>
            <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !savingStats && setScoringMatch(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <motion.div key="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-full sm:max-w-4xl max-h-[92vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
                  <div>
                    <h2 className="font-bold text-zff-black text-lg">{scoringMatch.home_team} vs {scoringMatch.away_team}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">MD{scoringMatch.matchday} · {scoringMatch.season} · Enter minutes + events for each player</p>
                  </div>
                  <button onClick={() => setScoringMatch(null)} disabled={savingStats} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1">
                  {statsLoading ? (
                    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading players…</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Player</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-20">Mins</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-16">⚽ G</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-16">🎯 A</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-16">🟨 YC</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-16">🟥 RC</th>
                          <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground w-20">CS</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-zff-green w-16">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(["GK","DEF","MID","FWD"] as const).map(pos => {
                          const rows = playerStatRows.filter(r => r.position === pos);
                          if (!rows.length) return null;
                          return (
                            <>
                              <tr key={`h-${pos}`} className="bg-slate-50/80">
                                <td colSpan={8} className="px-4 py-1.5">
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", getPositionColor(pos))}>{pos}</span>
                                </td>
                              </tr>
                              {rows.map(row => (
                                <tr key={row.player_id} className={cn("hover:bg-slate-50/50 transition-colors", row.minutes > 0 && "bg-zff-green/[0.02]")}>
                                  <td className="px-4 py-2.5"><p className="text-sm font-medium text-zff-black">{row.name}</p></td>
                                  <td className="px-3 py-2.5">
                                    <input type="number" min={0} max={120} value={row.minutes}
                                      onChange={e => updateStat(row.player_id, "minutes", Math.max(0, Math.min(120, parseInt(e.target.value)||0)))}
                                      className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-zff-green/50 bg-white" />
                                  </td>
                                  {(["goals","assists","yellow_cards","red_cards"] as const).map(field => (
                                    <td key={field} className="px-3 py-2.5">
                                      <input type="number" min={0} max={field.includes("cards") ? 2 : 10} value={row[field] as number}
                                        onChange={e => updateStat(row.player_id, field, Math.max(0, parseInt(e.target.value)||0))}
                                        className="w-12 text-center border border-slate-200 rounded-lg px-1 py-1 text-sm focus:outline-none focus:border-zff-green/50 bg-white mx-auto block" />
                                    </td>
                                  ))}
                                  <td className="px-3 py-2.5 text-center">
                                    {pos !== "FWD" ? (
                                      <input type="checkbox" checked={row.clean_sheet}
                                        onChange={e => updateStat(row.player_id, "clean_sheet", e.target.checked)}
                                        className="w-4 h-4 accent-zff-green cursor-pointer" />
                                    ) : <span className="text-muted-foreground text-xs">—</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <span className={cn("text-sm font-bold", row.minutes > 0 ? "text-zff-green" : "text-slate-300")}>{row.fantasy_points}</span>
                                  </td>
                                </tr>
                              ))}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="p-4 sm:p-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 bg-slate-50/50">
                  <p className="text-xs text-muted-foreground hidden sm:block flex-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Set minutes to 0 to exclude a player. Points auto-calculate on save.
                  </p>
                  <div className="flex items-center gap-3 sm:shrink-0 justify-end flex-wrap">
                    <button onClick={() => setScoringMatch(null)} disabled={savingStats} className="btn-outline text-sm px-4 sm:px-5 py-2.5">Cancel</button>
                    {scoringMatch?.status === "finished" && (
                      <button onClick={() => handleReopen(scoringMatch)} disabled={reopening || savingStats}
                        className="text-sm px-4 py-2.5 rounded-xl border border-amber-400/40 text-amber-600 hover:bg-amber-50 transition-colors flex items-center gap-2 disabled:opacity-50">
                        {reopening ? <span className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-500 rounded-full animate-spin" /> : "↩"}
                        Reopen Match
                      </button>
                    )}
                    <button onClick={saveAndFinalise} disabled={savingStats || statsLoading}
                      className="btn-primary text-sm px-4 sm:px-6 py-2.5 flex items-center gap-2 disabled:opacity-60">
                      {savingStats
                        ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />{calculating ? "Calculating…" : "Saving…"}</>
                        : <><Zap className="w-4 h-4" /> <span className="hidden sm:inline">Finalise &amp; Calculate </span>Points</>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
