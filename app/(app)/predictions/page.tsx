"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { motion } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { Target, Trophy, Check, Info, Medal, Circle, Flame, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";
import { FeatureDisabled } from "@/components/ui/FeatureDisabled";
import { useSearchParams } from "next/navigation";

type Sport = "football" | "cricket" | "rugby";

const SPORTS: { id: Sport; label: string; unit: string; icon: typeof Target }[] = [
  { id: "football", label: "Football", unit: "goals", icon: Target },
  { id: "cricket",  label: "Cricket",  unit: "total runs", icon: Circle },
  { id: "rugby",    label: "Rugby",    unit: "points", icon: Trophy },
];

interface UpcomingMatch {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  matchday: number;
}

interface FinishedPrediction {
  matchId: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  predHome: number;
  predAway: number;
  points: number;
}

interface LeaderboardRow {
  userId: string;
  username: string;
  points: number;
  exact: number;
}

interface GroupPickRow {
  matchId: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  picks: { username: string; home: number; away: number; points: number | null }[];
}

export default function PredictionsPage() {
  return (
    <Suspense>
      <PredictionsPageContent />
    </Suspense>
  );
}

function PredictionsPageContent() {
  const scorePredictionsEnabled = useFeatureFlag("scorePredictions");
  const searchParams = useSearchParams();

  const [sport, setSport] = useState<Sport>(() => {
    const fromUrl = searchParams.get("sport");
    return (fromUrl === "cricket" || fromUrl === "rugby" || fromUrl === "football") ? fromUrl : "football";
  });
  const [season, setSeason] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingMatch[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { home: string; away: string }>>({});
  const [saved, setSaved] = useState<Record<string, { home: number; away: number }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<string | null>(null);
  const [errorByMatch, setErrorByMatch] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<FinishedPrediction[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [myTotal, setMyTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [scopeId, setScopeId] = useState<string>("global");
  const [groupPicks, setGroupPicks] = useState<GroupPickRow[]>([]);

  const activeSport = SPORTS.find((s) => s.id === sport)!;

  // My groups — fetched once, reused across sport switches.
  useEffect(() => {
    async function loadGroups() {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("league_members").select("league_id, leagues(id, name)").eq("user_id", user.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setGroups((data ?? []).map((m: any) => m.leagues).filter(Boolean));
    }
    loadGroups();
  }, []);

  // Default to whichever sport this user actually follows (set at
  // onboarding) instead of always opening on football — a cricket-only
  // fan shouldn't have to click past football every time. Skipped if the
  // URL already named a sport (e.g. arriving from the Games hub).
  useEffect(() => {
    if (searchParams.get("sport")) return;
    async function loadDefaultSport() {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("profiles").select("interested_sports").eq("id", user.id).single();
      const preferred = data?.interested_sports?.find((s: string) => SPORTS.some(sp => sp.id === s));
      if (preferred) setSport(preferred as Sport);
    }
    loadDefaultSport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async (forSport: Sport, forScope: string) => {
    setLoading(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data: { user } } = await supabase.auth.getUser();

    // All matches for this sport once, reused for the upcoming list, the
    // "your results" history, and the leaderboard — avoids extra round trips.
    const { data: sportMatches } = await sb
      .from("matches")
      .select("id, home_team, away_team, kickoff_time, matchday, status, home_score, away_score, season")
      .eq("sport", forSport)
      .order("kickoff_time", { ascending: true });

    const allMatchesRaw = sportMatches ?? [];
    // The leaderboard/history "reset" each season — scope everything to the
    // most recent season present rather than showing an all-time mashup.
    const currentSeason = allMatchesRaw.length > 0 ? allMatchesRaw[allMatchesRaw.length - 1].season : null;
    setSeason(currentSeason);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMatches = allMatchesRaw.filter((m: any) => m.season === currentSeason);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matchById = new Map<string, any>(allMatches.map((m: any) => [m.id, m]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setUpcoming(allMatches.filter((m: any) => m.status === "scheduled").slice(0, 20));

    let newSaved: Record<string, { home: number; away: number }> = {};
    let newHistory: FinishedPrediction[] = [];
    let newTotal = 0;
    let newStreak = 0;

    if (user && allMatches.length > 0) {
      const { data: myPreds } = await sb
        .from("score_predictions")
        .select("match_id, predicted_home_score, predicted_away_score, points_earned")
        .eq("user_id", user.id)
        .in("match_id", allMatches.map((m: { id: string }) => m.id));

      const savedMap: Record<string, { home: number; away: number }> = {};
      const draftMap: Record<string, { home: string; away: string }> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (myPreds ?? []).forEach((p: any) => {
        savedMap[p.match_id] = { home: p.predicted_home_score, away: p.predicted_away_score };
        draftMap[p.match_id] = { home: String(p.predicted_home_score), away: String(p.predicted_away_score) };
      });
      newSaved = savedMap;
      setDrafts(draftMap);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scoredPreds = (myPreds ?? []).filter((p: any) => p.points_earned !== null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newTotal = scoredPreds.reduce((s: number, p: any) => s + p.points_earned, 0);

      newHistory = scoredPreds
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => {
          const m = matchById.get(p.match_id);
          if (!m) return null;
          return {
            matchId: p.match_id, home: m.home_team, away: m.away_team,
            homeScore: m.home_score, awayScore: m.away_score,
            predHome: p.predicted_home_score, predAway: p.predicted_away_score,
            points: p.points_earned,
          };
        })
        .filter(Boolean)
        .slice(0, 10) as FinishedPrediction[];

      const { data: streakData } = await sb.rpc("get_prediction_streak", { p_user_id: user.id, p_sport: forSport });
      newStreak = typeof streakData === "number" ? streakData : 0;
    }
    setSaved(newSaved);
    setHistory(newHistory);
    setMyTotal(newTotal);
    setStreak(newStreak);

    // Leaderboard — aggregate scored predictions on this sport/season's
    // matches, optionally narrowed to one private group's members.
    let newLeaderboard: LeaderboardRow[] = [];
    let newGroupPicks: GroupPickRow[] = [];
    if (allMatches.length > 0) {
      let memberIds: string[] | null = null;
      if (forScope !== "global") {
        const { data: members } = await sb.from("league_members").select("user_id").eq("league_id", forScope);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        memberIds = (members ?? []).map((m: any) => m.user_id);
      }

      let scoredQuery = sb.from("score_predictions").select("user_id, points_earned")
        .not("points_earned", "is", null)
        .in("match_id", allMatches.map((m: { id: string }) => m.id));
      if (memberIds) scoredQuery = scoredQuery.in("user_id", memberIds);
      const { data: allScored } = await scoredQuery;

      const totals = new Map<string, { points: number; exact: number }>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (allScored ?? []).forEach((p: any) => {
        const cur = totals.get(p.user_id) ?? { points: 0, exact: 0 };
        cur.points += p.points_earned;
        if (p.points_earned === 3) cur.exact += 1;
        totals.set(p.user_id, cur);
      });
      const topIds = [...totals.entries()].sort((a, b) => b[1].points - a[1].points).slice(0, 10);
      if (topIds.length > 0) {
        const { data: profs } = await sb.from("profiles").select("id, username").in("id", topIds.map(([id]) => id));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nameById = new Map<string, string>((profs ?? []).map((p: any) => [p.id, p.username]));
        newLeaderboard = topIds.map(([id, v]) => ({ userId: id, username: nameById.get(id) ?? "Manager", points: v.points, exact: v.exact }));
      }

      // Group Picks — what your group predicted on recent live/finished
      // matches. RLS only reveals other users' picks post-kickoff, so this
      // naturally can't be used to copy anyone before a match starts.
      if (memberIds && memberIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const revealedMatches = allMatches.filter((m: any) => m.status === "live" || m.status === "finished").slice(-5).reverse();
        if (revealedMatches.length > 0) {
          const { data: groupPreds } = await sb.from("score_predictions")
            .select("match_id, user_id, predicted_home_score, predicted_away_score, points_earned")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .in("match_id", revealedMatches.map((m: any) => m.id))
            .in("user_id", memberIds);
          const { data: memberProfs } = await sb.from("profiles").select("id, username").in("id", memberIds);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const memberNameById = new Map<string, string>((memberProfs ?? []).map((p: any) => [p.id, p.username]));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          newGroupPicks = revealedMatches.map((m: any) => ({
            matchId: m.id, home: m.home_team, away: m.away_team,
            homeScore: m.home_score, awayScore: m.away_score, status: m.status,
            picks: (groupPreds ?? [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((p: any) => p.match_id === m.id)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((p: any) => ({
                username: memberNameById.get(p.user_id) ?? "Manager",
                home: p.predicted_home_score, away: p.predicted_away_score, points: p.points_earned,
              })),
          }));
        }
      }
    }
    setLeaderboard(newLeaderboard);
    setGroupPicks(newGroupPicks);

    setLoading(false);
  }, []);

  useEffect(() => { load(sport, scopeId); }, [sport, scopeId, load]);

  async function submit(matchId: string) {
    const draft = drafts[matchId];
    const home = parseInt(draft?.home ?? "", 10);
    const away = parseInt(draft?.away ?? "", 10);
    if (isNaN(home) || isNaN(away) || home < 0 || away < 0 || home > 999 || away > 999) {
      setErrorByMatch((prev) => ({ ...prev, [matchId]: `Enter a valid ${activeSport.unit} total for both teams` }));
      return;
    }
    setErrorByMatch((prev) => ({ ...prev, [matchId]: "" }));
    setSaving(matchId);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).rpc("submit_score_prediction", {
      p_match_id: matchId, p_home_score: home, p_away_score: away,
    });
    setSaving(null);
    if (data?.ok) {
      setSaved((prev) => ({ ...prev, [matchId]: { home, away } }));
      setJustSaved(matchId);
      setTimeout(() => setJustSaved((cur) => (cur === matchId ? null : cur)), 2000);
    } else {
      setErrorByMatch((prev) => ({ ...prev, [matchId]: data?.error ?? "Couldn't save your prediction — try again." }));
    }
  }

  if (!scorePredictionsEnabled) {
    return <FeatureDisabled title="Score Predictions" message="Score predictions are temporarily paused. Try My Team instead." />;
  }

  const scopeLabel = scopeId === "global" ? "Global" : groups.find(g => g.id === scopeId)?.name ?? "Group";

  return (
    <div className="min-h-screen">
      <TopBar title="Score Predictions" subtitle="Predict the final score — no squad required" />

      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex gap-2">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSport(s.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-colors",
                sport === s.id ? "bg-zff-green text-white border-zff-green" : "bg-white text-slate-500 border-slate-200 hover:border-zff-green/40"
              )}
            >
              <s.icon className="w-4 h-4" /> {s.label}
            </button>
          ))}
        </div>

        <motion.div key={sport} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-zff-green/10 border border-zff-green/20 shrink-0">
            <Info className="w-4 h-4 text-zff-green" />
          </div>
          <div className="text-sm text-slate-600 leading-relaxed">
            <span className="font-semibold text-zff-black">How it works:</span> predict each team&apos;s final {activeSport.unit} before
            kickoff. Exact score = <span className="font-semibold text-zff-black">3 pts</span>, correct winner/draw + correct margin =
            {" "}<span className="font-semibold text-zff-black">2 pts</span>, correct winner/draw only = <span className="font-semibold text-zff-black">1 pt</span>.
            Predictions lock at kickoff.{season && <span className="text-muted-foreground"> Showing Season {season}.</span>}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card p-6">
              <h2 className="text-base font-bold text-zff-black mb-5 flex items-center gap-2.5">
                <Target className="w-4 h-4 text-zff-green" /> Upcoming {activeSport.label} Matches
              </h2>

              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-8">Loading fixtures…</p>
              ) : upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No upcoming {activeSport.label.toLowerCase()} matches to predict right now.</p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((m) => {
                    const isSaved = !!saved[m.id];
                    const draft = drafts[m.id] ?? { home: "", away: "" };
                    return (
                      <div key={m.id} className={cn("p-4 rounded-xl border", isSaved ? "bg-zff-green/5 border-zff-green/20" : "bg-slate-50 border-slate-200")}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-zff-green font-semibold">MD{m.matchday}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(m.kickoff_time).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-3 sm:gap-5">
                          <span className="font-semibold text-zff-black text-sm flex-1 text-right">{m.home_team}</span>
                          <input
                            type="number" min={0} max={999} inputMode="numeric"
                            value={draft.home}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [m.id]: { home: e.target.value, away: prev[m.id]?.away ?? "" } }))}
                            className="input w-16 text-center px-2 py-1.5"
                            placeholder="-"
                          />
                          <span className="text-muted-foreground text-xs font-medium">—</span>
                          <input
                            type="number" min={0} max={999} inputMode="numeric"
                            value={draft.away}
                            onChange={(e) => setDrafts((prev) => ({ ...prev, [m.id]: { home: prev[m.id]?.home ?? "", away: e.target.value } }))}
                            className="input w-16 text-center px-2 py-1.5"
                            placeholder="-"
                          />
                          <span className="font-semibold text-zff-black text-sm flex-1">{m.away_team}</span>
                        </div>
                        {errorByMatch[m.id] && (
                          <p className="text-xs text-red-600 text-center mt-2">{errorByMatch[m.id]}</p>
                        )}
                        <button
                          onClick={() => submit(m.id)}
                          disabled={saving === m.id}
                          className={cn(
                            "w-full mt-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors",
                            justSaved === m.id ? "bg-zff-green text-white" : isSaved ? "btn-outline" : "btn-primary"
                          )}
                        >
                          {saving === m.id ? "Saving…" : justSaved === m.id ? (<><Check className="w-3.5 h-3.5" /> Saved</>) : isSaved ? "Update Prediction" : "Save Prediction"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {history.length > 0 && (
              <div className="glass-card p-6">
                <h2 className="text-base font-bold text-zff-black mb-5 flex items-center gap-2.5">
                  <Trophy className="w-4 h-4 text-zff-green" /> Your Results
                </h2>
                <div className="space-y-2.5">
                  {history.map((h) => (
                    <div key={h.matchId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm">
                      <div>
                        <p className="font-semibold text-zff-black">{h.home} {h.homeScore} – {h.awayScore} {h.away}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">You predicted {h.predHome} – {h.predAway}</p>
                      </div>
                      <span className={cn(
                        "text-xs font-bold px-2.5 py-1 rounded-full shrink-0",
                        h.points === 3 ? "bg-zff-green/10 text-zff-green" : h.points > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-400"
                      )}>
                        +{h.points} pt{h.points === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {scopeId !== "global" && groupPicks.length > 0 && (
              <div className="glass-card p-6">
                <h2 className="text-base font-bold text-zff-black mb-5 flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-zff-green" /> {scopeLabel}&apos;s Picks
                </h2>
                <div className="space-y-4">
                  {groupPicks.map((gp) => (
                    <div key={gp.matchId} className="border border-slate-200 rounded-xl p-4">
                      <p className="text-sm font-semibold text-zff-black mb-2.5">
                        {gp.home} {gp.status !== "scheduled" && gp.homeScore !== null ? `${gp.homeScore} – ${gp.awayScore}` : "vs"} {gp.away}
                        {gp.status === "live" && <span className="ml-2 text-[10px] font-bold text-red-500">LIVE</span>}
                      </p>
                      {gp.picks.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nobody in your group predicted this one.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {gp.picks.map((pk, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-slate-600">{pk.username}</span>
                              <span className="flex items-center gap-2">
                                <span className="font-medium text-zff-black">{pk.home} – {pk.away}</span>
                                {pk.points !== null && (
                                  <span className={cn("font-bold px-1.5 py-0.5 rounded", pk.points === 3 ? "bg-zff-green/10 text-zff-green" : pk.points > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-400")}>
                                    +{pk.points}
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="glass-card p-6 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Points</p>
                <p className="text-3xl font-display text-zff-green tracking-wider">{myTotal}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
                  <Flame className="w-3 h-3 text-orange-500" /> Streak
                </p>
                <p className="text-3xl font-display text-orange-500 tracking-wider">{streak}</p>
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-zff-black flex items-center gap-2.5">
                  <Medal className="w-4 h-4 text-zff-green" /> Top Predictors
                </h2>
              </div>
              {groups.length > 0 && (
                <select value={scopeId} onChange={(e) => setScopeId(e.target.value)} className="input text-xs py-1.5 mb-4 w-full">
                  <option value="global">🌍 Global</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>👥 {g.name}</option>)}
                </select>
              )}
              {leaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No results yet — check back after the next matchday.</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((row, i) => (
                    <div key={row.userId} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50">
                      <span className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                        i === 0 ? "bg-amber-100 text-amber-600" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-400"
                      )}>
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm font-medium text-zff-black truncate">{row.username}</span>
                      <span className="text-sm font-bold text-zff-green">{row.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
