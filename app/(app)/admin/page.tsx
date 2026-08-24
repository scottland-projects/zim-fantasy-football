"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveFlagsAction, updateMatchStatusAction, cancelMatchLiveAction, saveFixtureAction, saveMatchStatsAction, savePrizesAction, updateUserRoleAction, broadcastNotificationAction, addPlayerAction, editPlayerAction, deletePlayerAction, adminResetPasswordAction, logMatchEventAction, deleteMatchEventAction, reopenMatchAction, listUserEmailsAction } from "@/lib/actions/admin";
import { deleteLeagueAction } from "@/lib/actions/leagues";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import {
  Users, Trophy, Radio, Bell, BarChart2,
  Plus, Edit, Trash2, CheckCircle, XCircle, Send,
  TrendingUp, AlertTriangle, Database, Eye, EyeOff, ToggleLeft,
  Gift, Globe, Save, Zap, X, Clock, KeyRound,
} from "lucide-react";

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
import { cn, formatPrice, getPositionColor } from "@/lib/utils";


const FLAG_DEFS = [
  { key: "liveScoring",     label: "Live Scoring",       desc: "Stream live fantasy points during matches" },
  { key: "transferWindow",  label: "Transfer Window",    desc: "Allow players to buy/sell in the market" },
  { key: "chat",            label: "Matchday Chat",      desc: "Enable community chat during live matches" },
  { key: "polls",           label: "Fan Polls",          desc: "Let fans vote on matchday polls" },
  { key: "leagueCreation",  label: "League Creation",    desc: "Allow managers to create new private leagues" },
  { key: "notifications",   label: "Push Notifications", desc: "Send in-app notifications to all users" },
  { key: "marketplace",     label: "Player Market",      desc: "Show the buy/sell player market page" },
  { key: "achievements",    label: "Achievements",       desc: "Award XP badges and trophies to users" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "players" | "users" | "matches" | "notifications" | "flags" | "leagues">("overview");
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [notifForm, setNotifForm] = useState({ title: "", body: "", type: "system" });
  const [sending, setSending] = useState(false);
  const [players, setPlayers] = useState<{ id: string; name: string; position: string; club: string; price: number; total_points: number; goals: number; is_injured: boolean }[]>([]);
  const [users, setUsers]     = useState<{ id: string; userId: string; username: string; email: string; level: string; points: number; status: string; joined: string }[]>([]);
  const [userCount, setUserCount] = useState("—");
  const [platformStats, setPlatformStats] = useState({ leagues: 0, liveMatches: 0, notifications: 0 });
  const [healthStats, setHealthStats] = useState({ teams: 0, playersPicked: 0, messages: 0, finishedMatches: 0 });
  const [recentResults, setRecentResults] = useState<{ home_team: string; away_team: string; home_score: number; away_score: number; matchday: number; kickoff_time: string }[]>([]);

  // Load real players and users from Supabase
  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        const [{ data: playersData }, { data: profilesData }, emailResult] = await Promise.all([
          supabase.from("players").select("id, name, position, club, price, total_points, goals, is_injured").order("total_points", { ascending: false }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("profiles").select("id, username, role, fantasy_points, created_at").order("fantasy_points", { ascending: false }),
          listUserEmailsAction(),
        ]);
        if (playersData && playersData.length > 0) setPlayers(playersData as typeof players);
        if (profilesData && profilesData.length > 0) {
          setUserCount(profilesData.length.toLocaleString());
          const emails = emailResult.emails ?? {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setUsers((profilesData as any[]).map((p: any, i: number) => ({
            id: String(i + 1),
            userId: p.id,
            username: p.username,
            email: emails[p.id] ?? "—",
            level: p.role === "admin" ? "Admin" : p.role === "manager" ? "Manager" : p.role === "moderator" ? "Mod" : "User",
            points: p.fantasy_points,
            status: "active",
            joined: new Date(p.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
          })));
        }

        // Matches
        const { data: matchesData } = await supabase.from("matches").select("*").order("matchday", { ascending: false });
        if (matchesData && matchesData.length > 0) setDbMatches(matchesData as AdminMatch[]);

        // Public leagues for prize management
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leaguesData } = await (supabase as any)
          .from("leagues")
          .select("id, name, prizes, league_members(count)")
          .eq("type", "public")
          .order("created_at", { ascending: false });
        if (leaguesData && leaguesData.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mapped = (leaguesData as any[]).map((l: any) => ({
            id: l.id,
            name: l.name,
            member_count: l.league_members?.[0]?.count ?? 0,
            prizes: l.prizes ?? null,
          }));
          setPublicLeagues(mapped);
          const initial: Record<string, { first: string; second: string; third: string }> = {};
          mapped.forEach(l => { initial[l.id] = { first: l.prizes?.first ?? "", second: l.prizes?.second ?? "", third: l.prizes?.third ?? "" }; });
          setEditingPrizes(initial);
        }

        // Recent notifications
        const { data: recentNotifsData } = await supabase
          .from("notifications")
          .select("id, title, body, type, created_at")
          .order("created_at", { ascending: false })
          .limit(5);
        if (recentNotifsData) setRecentNotifs(recentNotifsData as typeof recentNotifs);

        // Real platform stats
        const [{ count: leagueCount }, { count: liveCount }, { count: notifCount }] = await Promise.all([
          supabase.from("leagues").select("*", { count: "exact", head: true }),
          supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "live"),
          supabase.from("notifications").select("*", { count: "exact", head: true }),
        ]);
        setPlatformStats({ leagues: leagueCount ?? 0, liveMatches: liveCount ?? 0, notifications: notifCount ?? 0 });

        // Platform health counts
        const [{ count: teamsCount }, { count: pickedCount }, { count: msgCount }, { count: finishedCount }] = await Promise.all([
          supabase.from("fantasy_teams").select("*", { count: "exact", head: true }),
          supabase.from("fantasy_team_players").select("*", { count: "exact", head: true }),
          supabase.from("chat_messages").select("*", { count: "exact", head: true }),
          supabase.from("matches").select("*", { count: "exact", head: true }).eq("status", "finished"),
        ]);
        setHealthStats({ teams: teamsCount ?? 0, playersPicked: pickedCount ?? 0, messages: msgCount ?? 0, finishedMatches: finishedCount ?? 0 });

        // Recent match results for alerts panel
        const { data: results } = await supabase
          .from("matches")
          .select("home_team, away_team, home_score, away_score, matchday, kickoff_time")
          .eq("status", "finished")
          .order("kickoff_time", { ascending: false })
          .limit(4);
        if (results) setRecentResults(results as typeof recentResults);
      } catch { /* show zeros */ }
    }
    loadData();
  }, []);
  const [dbMatches, setDbMatches] = useState<AdminMatch[]>([]);
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

  const [publicLeagues, setPublicLeagues] = useState<{ id: string; name: string; member_count: number; prizes: { first: string; second: string; third: string } | null }[]>([]);
  const [editingPrizes, setEditingPrizes] = useState<Record<string, { first: string; second: string; third: string }>>({});
  const [savingPrize, setSavingPrize] = useState<string | null>(null);

  const [flags, setFlags] = useState<Record<string, boolean>>({
    liveScoring: true, transferWindow: true, chat: true, polls: true,
    leagueCreation: true, notifications: true, marketplace: true, achievements: true,
  });
  const [flagSaved, setFlagSaved]   = useState(false);
  const [flagSaving, setFlagSaving] = useState(false);
  const [recentNotifs, setRecentNotifs] = useState<{ id: string; title: string; body: string; type: string; created_at: string }[]>([]);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [playerForm, setPlayerForm] = useState({ name: "", position: "MID", price: "" });
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [editForm, setEditForm] = useState<{ id: string; name: string; position: string; price: string; is_injured: boolean } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState<string | null>(null);
  const [deletingPlayer, setDeletingPlayer] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<{ id: string; username: string } | null>(null);
  const [resetPwForm, setResetPwForm] = useState({ next: "", confirm: "" });
  const [resetPwError, setResetPwError] = useState("");
  const [resetPwSaving, setResetPwSaving] = useState(false);
  const [togglingInjury, setTogglingInjury] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(type: "success" | "error", msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Load feature flags from Supabase on mount
  useEffect(() => {
    async function loadFlags() {
      try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("app_config")
          .select("value")
          .eq("key", "feature_flags")
          .single();
        if (data?.value) setFlags(data.value as Record<string, boolean>);
      } catch { /* use defaults */ }
    }
    loadFlags();
  }, []);

  async function saveFlags() {
    setFlagSaving(true);
    try {
      const result = await saveFlagsAction(flags);
      if (result.error) { showToast("error", result.error); return; }
      setFlagSaved(true);
      setTimeout(() => setFlagSaved(false), 2000);
    } catch { showToast("error", "Failed to save feature flags"); }
    finally { setFlagSaving(false); }
  }

  async function sendNotification() {
    if (!notifForm.title.trim() || !notifForm.body.trim()) return;
    setSending(true);
    try {
      const result = await broadcastNotificationAction(notifForm.title, notifForm.body, notifForm.type);
      if (result.error) { showToast("error", result.error); return; }
      if (result.success) {
        setNotifForm({ title: "", body: "", type: "system" });
        showToast("success", `Sent to ${result.count ?? 0} user${result.count === 1 ? "" : "s"}`);
        // Refresh recent notifs
        const supabase = createClient();
        const { data } = await supabase.from("notifications").select("id, title, body, type, created_at").order("created_at", { ascending: false }).limit(5);
        if (data) setRecentNotifs(data as typeof recentNotifs);
      }
    } catch { showToast("error", "Failed to send notification"); }
    finally { setSending(false); }
  }

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

      // Aggregate live events for pre-fill when no saved stats exist yet
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
          player_id: p.id,
          name: p.name,
          position: p.position,
          club: p.club,
          minutes:      saved?.minutes      ?? 0,
          goals:        saved?.goals        ?? live?.goals        ?? 0,
          assists:      saved?.assists      ?? live?.assists      ?? 0,
          yellow_cards: saved?.yellow_cards ?? live?.yellow_cards ?? 0,
          red_cards:    saved?.red_cards    ?? live?.red_cards    ?? 0,
          clean_sheet:  saved?.clean_sheet  ?? false,
          fantasy_points: saved?.fantasy_points ?? 0,
        };
      }));
    } catch { /* keep empty */ }
    finally { setStatsLoading(false); }
  }

  function updateStat(playerId: string, field: keyof PlayerStatRow, value: number | boolean) {
    setPlayerStatRows(prev => prev.map(r => r.player_id === playerId ? { ...r, [field]: value } : r));
  }

  async function saveAndFinalise() {
    if (!scoringMatch) return;
    setSavingStats(true);
    try {
      await saveMatchStatsAction(
        scoringMatch.id,
        playerStatRows,
        scoringMatch.matchday,
        scoringMatch.season,
      );
      setCalculating(true);
      const supabase = createClient();
      const { data: fresh } = await supabase.from("matches").select("*").order("matchday", { ascending: false });
      if (fresh) setDbMatches(fresh as AdminMatch[]);
      setScoringMatch(null);
      showToast("success", "Stats saved and points calculated");
    } catch { showToast("error", "Failed to save match stats"); }
    finally { setSavingStats(false); setCalculating(false); }
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
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: fresh } = await (supabase as any).from("matches").select("*").eq("id", liveScoreMatch.id).single();
        if (fresh) {
          setDbMatches(prev => prev.map(m => m.id === liveScoreMatch.id ? fresh as AdminMatch : m));
          setLiveScoreMatch(fresh as AdminMatch);
        }
        setEventForm(p => ({ ...p, minute: "", player_id: "", player_name: "" }));
      } else if (result.error) {
        showToast("error", result.error);
      }
    } catch { showToast("error", "Failed to log event"); }
    finally { setLoggingEvent(false); }
  }

  async function deleteEvent(eventId: string) {
    try {
      const result = await deleteMatchEventAction(eventId, liveScoreMatch!.id);
      if (result.error) { showToast("error", result.error); return; }
      setLiveEvents(prev => prev.filter(e => e.id !== eventId));
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fresh } = await (supabase as any).from("matches").select("*").eq("id", liveScoreMatch!.id).single();
      if (fresh) {
        setDbMatches(prev => prev.map(m => m.id === liveScoreMatch!.id ? fresh as AdminMatch : m));
        setLiveScoreMatch(fresh as AdminMatch);
      }
    } catch { showToast("error", "Failed to delete event"); }
  }

  async function handleReopen(match: AdminMatch) {
    if (!confirm(`Reopen "${match.home_team} vs ${match.away_team}"?\n\nThis will:\n• Reverse all fantasy points from this match\n• Delete saved player stats\n• Set the match back to Live so you can re-score`)) return;
    setReopening(true);
    try {
      const result = await reopenMatchAction(match.id, match.matchday, match.season);
      if (result.error) { showToast("error", result.error); return; }
      if (result.success) {
        setDbMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: "live", home_score: null, away_score: null } : m));
        setScoringMatch(null);
        showToast("success", "Match reopened for re-scoring");
      }
    } catch { showToast("error", "Failed to reopen match"); }
    finally { setReopening(false); }
  }

  async function updateMatchStatus(matchId: string, status: string) {
    setStatusUpdating(matchId);
    try {
      const result = await updateMatchStatusAction(matchId, status);
      if (result.error) { showToast("error", result.error); return; }
      setDbMatches(prev => prev.map(m => m.id === matchId ? { ...m, status } : m));
    } catch { showToast("error", "Failed to update match status"); }
    finally { setStatusUpdating(null); }
  }

  async function saveFixture() {
    if (!fixtureForm.home || !fixtureForm.away || !fixtureForm.matchday || !fixtureForm.kickoff) return;
    setSavingFixture(true);
    try {
      const result = await saveFixtureAction(fixtureForm);
      if (result.error) { showToast("error", result.error); return; }
      if (result.data) setDbMatches(prev => [result.data as AdminMatch, ...prev].sort((a, b) => b.matchday - a.matchday));
      setAddFixtureOpen(false);
      setFixtureForm({ home: "", away: "", matchday: "", kickoff: "", season: "2026" });
      showToast("success", "Fixture added");
    } catch { showToast("error", "Failed to save fixture"); }
    finally { setSavingFixture(false); }
  }

  async function savePrizes(leagueId: string) {
    setSavingPrize(leagueId);
    try {
      const prizes = editingPrizes[leagueId];
      const result = await savePrizesAction(leagueId, prizes);
      if (result.error) { showToast("error", result.error); return; }
      setPublicLeagues(prev => prev.map(l => l.id === leagueId ? { ...l, prizes } : l));
      showToast("success", "Prizes saved");
    } catch { showToast("error", "Failed to save prizes"); }
    finally { setSavingPrize(null); }
  }

  async function toggleInjury(id: string, current: boolean) {
    setTogglingInjury(id);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from("players").update({ is_injured: !current }).eq("id", id);
      if (error) { showToast("error", "Failed to update injury status"); return; }
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, is_injured: !current } : p));
    } catch { showToast("error", "Failed to update injury status"); }
    finally { setTogglingInjury(null); }
  }

  async function resetPassword() {
    setResetPwError("");
    if (!resetPwUser) return;
    if (resetPwForm.next.length < 8) { setResetPwError("Password must be at least 8 characters"); return; }
    if (resetPwForm.next !== resetPwForm.confirm) { setResetPwError("Passwords do not match"); return; }
    setResetPwSaving(true);
    try {
      const result = await adminResetPasswordAction(resetPwUser.id, resetPwForm.next);
      if (result.error) { setResetPwError(result.error); return; }
      setResetPwUser(null);
      setResetPwForm({ next: "", confirm: "" });
    } catch { setResetPwError("Something went wrong"); }
    finally { setResetPwSaving(false); }
  }

  async function saveEdit() {
    if (!editForm) return;
    setSavingEdit(true);
    try {
      const result = await editPlayerAction(editForm.id, {
        name: editForm.name,
        position: editForm.position,
        price: parseFloat(editForm.price) * 1_000_000,
        is_injured: editForm.is_injured,
      });
      if (result.error) { showToast("error", result.error); return; }
      if (result.data) {
        setPlayers(prev => prev.map(p => p.id === editForm.id ? { ...p, ...result.data } : p));
        setEditingPlayer(null);
        setEditForm(null);
        showToast("success", "Player updated");
      }
    } catch { showToast("error", "Failed to update player"); }
    finally { setSavingEdit(false); }
  }

  async function handleDeletePlayer(id: string) {
    setDeletingPlayer(true);
    try {
      const result = await deletePlayerAction(id);
      if (result.error) { showToast("error", result.error); return; }
      setPlayers(prev => prev.filter(p => p.id !== id));
      setConfirmDeletePlayer(null);
      showToast("success", "Player deleted");
    } catch { showToast("error", "Failed to delete player"); }
    finally { setDeletingPlayer(false); }
  }

  async function savePlayer() {
    if (!playerForm.name.trim() || !playerForm.price) return;
    setSavingPlayer(true);
    try {
      const result = await addPlayerAction({ name: playerForm.name, position: playerForm.position, price: parseFloat(playerForm.price) * 1_000_000 });
      if (result.error) { showToast("error", result.error); return; }
      if (result.data) {
        setPlayers(prev => [...prev, { ...result.data, goals: result.data.goals ?? 0 }]);
        setAddPlayerOpen(false);
        setPlayerForm({ name: "", position: "MID", price: "" });
        showToast("success", "Player added");
      }
    } catch { showToast("error", "Failed to add player"); }
    finally { setSavingPlayer(false); }
  }

  return (
    <div className="min-h-screen">
      <TopBar
        title="Admin Panel"
        subtitle="Africa Fantasy Management"
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-7">
        {/* Tab navigation */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "overview",       label: "Overview",       short: "Overview", icon: BarChart2 },
            { id: "players",        label: "Players",        short: "Players",  icon: Trophy    },
            { id: "users",          label: "Users",          short: "Users",    icon: Users     },
            { id: "matches",        label: "Matches",        short: "Matches",  icon: Radio     },
            { id: "notifications",  label: "Notifications",  short: "Notifs",   icon: Bell      },
            { id: "leagues",        label: "Leagues",        short: "Leagues",  icon: Trophy    },
            { id: "flags",          label: "Feature Flags",  short: "Flags",    icon: ToggleLeft},
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm font-medium border transition-all",
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
          {activeTab === "overview" && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Real user count from Supabase */}
                <div className="glass-card p-7 flex flex-col items-center sm:items-start text-center sm:text-left">
                  <div className="p-2 rounded-lg bg-slate-100/50 mb-3">
                    <Users className="w-5 h-5 text-zff-green" />
                  </div>
                  <p className="text-3xl font-display mb-1 text-zff-green">{userCount}</p>
                  <p className="text-sm text-white font-medium">Total Users</p>
                  <p className="text-xs text-muted-foreground">From profiles table</p>
                </div>
                {[
                  { label: "Active Leagues",     value: platformStats.leagues.toLocaleString(),      icon: Trophy, color: "text-amber-400", change: "Total leagues created" },
                  { label: "Live Now",           value: platformStats.liveMatches.toLocaleString(),  icon: Radio,  color: "text-red-400",   change: "Matches with live status" },
                  { label: "Notifications Sent", value: platformStats.notifications.toLocaleString(), icon: Bell,   color: "text-blue-400",  change: "All time" },
                ].map((s) => (
                  <div key={s.label} className="glass-card p-7 flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div className="p-2 rounded-lg bg-slate-100/50 mb-3">
                      <s.icon className={cn("w-5 h-5", s.color)} />
                    </div>
                    <p className={cn("text-3xl font-display mb-1", s.color)}>{s.value}</p>
                    <p className="text-sm text-white font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.change}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="glass-card p-7">
                  <h2 className="font-bold text-zff-black mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-zff-green" /> Platform Health
                  </h2>
                  <div className="space-y-3">
                    {[
                      { label: "Registered Managers", value: parseInt(userCount.replace(/,/g, "")) || 0, max: Math.max(parseInt(userCount.replace(/,/g, "")) || 1, 1), color: "bg-zff-green" },
                      { label: "Active Fantasy Teams", value: healthStats.teams, max: Math.max(healthStats.teams, 1), color: "bg-blue-500" },
                      { label: "Player Picks (Total)", value: healthStats.playersPicked, max: Math.max(healthStats.playersPicked, 1), color: "bg-amber-500" },
                      { label: "Matches Completed", value: healthStats.finishedMatches, max: Math.max(healthStats.finishedMatches, 1), color: "bg-purple-500" },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-zff-black">{metric.label}</span>
                          <span className="text-muted-foreground">{metric.value.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", metric.color)} style={{ width: `${(metric.value / metric.max) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card p-7">
                  <h2 className="font-bold text-zff-black mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Recent Alerts
                  </h2>
                  <div className="space-y-2">
                    {recentResults.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No recent results</p>
                    ) : recentResults.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 p-4 rounded-xl border text-xs bg-blue-500/10 border-blue-500/20 text-blue-300">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        <span className="flex-1">MD{r.matchday}: {r.home_team} {r.home_score} – {r.away_score} {r.away_team}</span>
                        <span className="text-muted-foreground">{new Date(r.kickoff_time).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "players" && (
            <motion.div key="players" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card">
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200">
                  <h2 className="font-bold text-zff-black">Player Management</h2>
                  <button onClick={() => setAddPlayerOpen(true)} className="btn-primary text-xs py-2 flex items-center gap-1.5 shrink-0">
                    <Plus className="w-3 h-3" /> Add Player
                  </button>
                </div>

                <AnimatePresence>
                  {addPlayerOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-b border-slate-200 bg-slate-50 overflow-hidden">
                      <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                          <input value={playerForm.name} onChange={e => setPlayerForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. #9 (jersey number only, no real names)" className="input text-sm py-2" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Position *</label>
                          <select value={playerForm.position} onChange={e => setPlayerForm(p => ({ ...p, position: e.target.value }))} className="select text-sm py-2">
                            {["GK","DEF","MID","FWD"].map(pos => <option key={pos} value={pos}>{pos}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Price ($m) *</label>
                          <input type="number" step="0.1" min="0.1" max="20" value={playerForm.price} onChange={e => setPlayerForm(p => ({ ...p, price: e.target.value }))} placeholder="5.5" className="input text-sm py-2" />
                        </div>
                        <div className="flex items-end gap-2">
                          <button onClick={savePlayer} disabled={savingPlayer || !playerForm.name.trim() || !playerForm.price} className="btn-primary text-xs py-2 px-4 flex-1 disabled:opacity-60">
                            {savingPlayer ? "Saving…" : "Save"}
                          </button>
                          <button onClick={() => setAddPlayerOpen(false)} className="btn-outline text-xs py-2 px-3">Cancel</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mobile: card list */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {players.map((player) => (
                    <div key={player.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-display text-zff-green/70 shrink-0">
                        {player.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zff-black truncate">{player.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getPositionColor(player.position))}>{player.position}</span>
                          <span className="text-xs font-bold text-zff-green">{player.total_points}pts</span>
                          <span className="text-xs text-amber-400">{formatPrice(player.price)}</span>
                          {player.is_injured && <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">INJ</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => toggleInjury(player.id, player.is_injured)} disabled={togglingInjury === player.id} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50">
                          {togglingInjury === player.id
                            ? <span className="w-4 h-4 border-2 border-slate-300 border-t-zff-green rounded-full animate-spin inline-block" />
                            : player.is_injured
                              ? <XCircle className="w-4 h-4 text-red-400" />
                              : <CheckCircle className="w-4 h-4 text-zff-green" />}
                        </button>
                        <button onClick={() => { setEditingPlayer(player.id); setEditForm({ id: player.id, name: player.name, position: player.position, price: String(player.price / 1_000_000), is_injured: player.is_injured }); }} className="p-1.5 rounded-lg border border-slate-200 hover:border-zff-green/30 text-muted-foreground hover:text-zff-green transition-colors">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmDeletePlayer(player.id)} className="p-1.5 rounded-lg border border-slate-200 hover:border-red-500/30 text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-100/20">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Player</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Pos</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Price</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Points</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Goals</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Injured</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((player) => (
                        <tr key={player.id} className="data-table-row">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-display text-zff-green/70">
                                {player.name.split(" ").map(n => n[0]).join("")}
                              </div>
                              <span className="text-sm font-medium text-zff-black">{player.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getPositionColor(player.position))}>
                              {player.position}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm text-amber-400">{formatPrice(player.price)}</td>
                          <td className="px-4 py-3.5 text-right text-sm font-bold text-zff-green">{player.total_points}</td>
                          <td className="px-4 py-3.5 text-right text-sm text-zff-black">{player.goals}</td>
                          <td className="px-4 py-3.5 text-center">
                            <button onClick={() => toggleInjury(player.id, player.is_injured)} disabled={togglingInjury === player.id} className="disabled:opacity-50">
                              {togglingInjury === player.id
                                ? <span className="w-5 h-5 border-2 border-slate-300 border-t-zff-green rounded-full animate-spin inline-block" />
                                : player.is_injured
                                  ? <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                                  : <CheckCircle className="w-5 h-5 text-zff-green mx-auto" />}
                            </button>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => { setEditingPlayer(player.id); setEditForm({ id: player.id, name: player.name, position: player.position, price: String(player.price / 1_000_000), is_injured: player.is_injured }); }} className="p-1.5 rounded-lg border border-slate-200 hover:border-zff-green/30 text-muted-foreground hover:text-zff-green transition-colors">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setConfirmDeletePlayer(player.id)} className="p-1.5 rounded-lg border border-slate-200 hover:border-red-500/30 text-muted-foreground hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "users" && (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card">
                <div className="p-4 sm:p-5 border-b border-slate-200">
                  <h2 className="font-bold text-zff-black">User Management</h2>
                </div>

                {/* Mobile: card list */}
                <div className="sm:hidden divide-y divide-slate-100">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-zff-green/10 border border-zff-green/20 flex items-center justify-center text-xs font-bold text-zff-green shrink-0">
                        {user.username[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-zff-black truncate">@{user.username}</p>
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                            user.level === "Admin" ? "bg-red-500/20 border-red-500/30 text-red-400" :
                            user.level === "Mod"   ? "bg-purple-500/20 border-purple-500/30 text-purple-400" :
                                                     "bg-slate-100 border-slate-200 text-muted-foreground"
                          )}>{user.level}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{user.points.toLocaleString()} pts · {user.joined}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          defaultValue={user.level === "Admin" ? "admin" : user.level === "Manager" ? "manager" : user.level === "Mod" ? "moderator" : "user"}
                          onChange={async (e) => {
                            await updateUserRoleAction(user.userId, e.target.value);
                            setUsers(prev => prev.map(u => u.id === user.id ? { ...u, level: e.target.value === "admin" ? "Admin" : e.target.value === "manager" ? "Manager" : e.target.value === "moderator" ? "Mod" : "User" } : u));
                          }}
                          className="select-sm"
                        >
                          <option value="user">User</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button onClick={() => { setResetPwUser({ id: user.userId, username: user.username }); setResetPwForm({ next: "", confirm: "" }); setResetPwError(""); }}
                          className="p-1.5 rounded-lg border border-slate-200 hover:border-amber-400/50 text-muted-foreground hover:text-amber-500 transition-colors"
                          title="Reset password">
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-100/20">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">User</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Email</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Role</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Points</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Joined</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="data-table-row">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-zff-green/10 border border-zff-green/20 flex items-center justify-center text-xs font-bold text-zff-green">
                                {user.username[0]}
                              </div>
                              <span className="text-sm text-zff-black">@{user.username}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-left text-sm text-muted-foreground">{user.email}</td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded-full border",
                              user.level === "Admin" ? "bg-red-500/20 border-red-500/30 text-red-400" :
                              user.level === "Mod"   ? "bg-purple-500/20 border-purple-500/30 text-purple-400" :
                                                       "bg-slate-100 border-slate-200 text-muted-foreground"
                            )}>{user.level}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm text-zff-black">{user.points.toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-center text-xs text-muted-foreground">{user.joined}</td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={cn(
                              "text-xs font-bold px-2 py-0.5 rounded-full border",
                              user.status === "active" ? "bg-zff-green/20 border-zff-green/30 text-zff-green" : "bg-red-500/20 border-red-500/30 text-red-400"
                            )}>{user.status}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex items-center gap-2">
                                <select
                                  defaultValue={user.level === "Admin" ? "admin" : user.level === "Manager" ? "manager" : user.level === "Mod" ? "moderator" : "user"}
                                  onChange={async (e) => {
                                    await updateUserRoleAction(user.userId, e.target.value);
                                    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, level: e.target.value === "admin" ? "Admin" : e.target.value === "manager" ? "Manager" : e.target.value === "moderator" ? "Mod" : "User" } : u));
                                  }}
                                  className="select-sm"
                                >
                                  <option value="user">User</option>
                                  <option value="manager">Manager</option>
                                  <option value="admin">Admin</option>
                                </select>
                                <button onClick={() => { setResetPwUser({ id: user.userId, username: user.username }); setResetPwForm({ next: "", confirm: "" }); setResetPwError(""); }}
                                  className="p-1.5 rounded-lg border border-slate-200 hover:border-amber-400/50 text-muted-foreground hover:text-amber-500 transition-colors"
                                  title="Reset password">
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "notifications" && (
            <motion.div key="notif" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="glass-card p-7">
                  <h2 className="font-bold text-zff-black mb-5 flex items-center gap-2">
                    <Send className="w-4 h-4 text-zff-green" /> Broadcast Notification
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Type</label>
                      <select
                        value={notifForm.type}
                        onChange={(e) => setNotifForm({ ...notifForm, type: e.target.value })}
                        className="select"
                      >
                        {["system","match","transfer","goal","league","reward"].map(t => (
                          <option key={t} value={t} className="bg-slate-50">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Title</label>
                      <input
                        type="text"
                        value={notifForm.title}
                        onChange={(e) => setNotifForm({ ...notifForm, title: e.target.value })}
                        placeholder="Notification title"
                        className="w-full px-4 py-3 bg-slate-100/50 border border-slate-200 rounded-xl text-zff-black placeholder:text-muted-foreground focus:outline-none focus:border-zff-green/50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Message</label>
                      <textarea
                        value={notifForm.body}
                        onChange={(e) => setNotifForm({ ...notifForm, body: e.target.value })}
                        placeholder="Notification body..."
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-100/50 border border-slate-200 rounded-xl text-zff-black placeholder:text-muted-foreground focus:outline-none focus:border-zff-green/50 text-sm resize-none"
                      />
                    </div>
                    <button
                      onClick={sendNotification}
                      disabled={sending || !notifForm.title || !notifForm.body}
                      className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                    >
                      <Bell className="w-4 h-4" />
                      {sending ? "Sending..." : `Send to All Users (${userCount})`}
                    </button>
                  </div>
                </div>

                <div className="glass-card p-7">
                  <h2 className="font-bold text-zff-black mb-5 flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-400" /> Recent Broadcasts
                  </h2>
                  <div className="space-y-3">
                    {recentNotifs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No broadcasts sent yet</p>
                    ) : recentNotifs.map((n) => {
                      const icons: Record<string, React.ReactNode> = {
                        match: <Radio className="w-5 h-5 text-zff-green" />,
                        transfer: <TrendingUp className="w-5 h-5 text-amber-400" />,
                        reward: <Trophy className="w-5 h-5 text-yellow-400" />,
                      };
                      return (
                        <div key={n.id} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                          <div>{icons[n.type] ?? <Bell className="w-5 h-5 text-slate-400" />}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zff-black">{n.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "matches" && (
            <motion.div key="matches" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                  <div className="min-w-0">
                    <h2 className="font-bold text-zff-black">Fixture Management</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Set match status and enter player stats to calculate fantasy points</p>
                  </div>
                  <button onClick={() => setAddFixtureOpen(true)} className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0">
                    <Plus className="w-3 h-3" /> Add Fixture
                  </button>
                </div>

                {/* Add fixture form */}
                <AnimatePresence>
                  {addFixtureOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-b border-slate-200 bg-slate-50 overflow-hidden">
                      <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Home Team *</label>
                          <input value={fixtureForm.home} onChange={e => setFixtureForm(p => ({ ...p, home: e.target.value }))} placeholder="e.g. Bosso" className="input text-sm py-2" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Away Team *</label>
                          <input value={fixtureForm.away} onChange={e => setFixtureForm(p => ({ ...p, away: e.target.value }))} placeholder="e.g. DeMbare" className="input text-sm py-2" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Matchday *</label>
                          <input type="number" value={fixtureForm.matchday} onChange={e => setFixtureForm(p => ({ ...p, matchday: e.target.value }))} placeholder="12" className="input text-sm py-2" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Kickoff Time *</label>
                          <input type="datetime-local" value={fixtureForm.kickoff} onChange={e => setFixtureForm(p => ({ ...p, kickoff: e.target.value }))} className="input text-sm py-2" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">Season</label>
                          <input value={fixtureForm.season} onChange={e => setFixtureForm(p => ({ ...p, season: e.target.value }))} className="input text-sm py-2" />
                        </div>
                        <div className="flex items-end gap-2">
                          <button onClick={saveFixture} disabled={savingFixture || !fixtureForm.home || !fixtureForm.away} className="btn-primary text-xs py-2 px-4 flex-1 disabled:opacity-60">
                            {savingFixture ? "Saving…" : "Save Fixture"}
                          </button>
                          <button onClick={() => setAddFixtureOpen(false)} className="btn-outline text-xs py-2 px-3">Cancel</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="divide-y divide-slate-100">
                  {dbMatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No matches found</p>
                  ) : dbMatches.map((m) => (
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

                      {/* Status badge — hidden on mobile */}
                      <span className={cn(
                        "hidden sm:inline text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0",
                        m.status === "live"      ? "bg-red-500/20 border-red-500/30 text-red-500 animate-pulse" :
                        m.status === "finished"  ? "bg-slate-100 border-slate-200 text-muted-foreground" :
                        m.status === "postponed" ? "bg-amber-500/10 border-amber-500/30 text-amber-500" :
                                                   "bg-zff-green/10 border-zff-green/30 text-zff-green"
                      )}>
                        {m.status.toUpperCase()}
                      </span>

                      {/* Actions */}
                      <div className="shrink-0">
                        {m.status === "scheduled" && (
                          <button onClick={() => updateMatchStatus(m.id, "live")} disabled={statusUpdating === m.id}
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
                                try { await cancelMatchLiveAction(m.id); setDbMatches(prev => prev.map(x => x.id === m.id ? { ...x, status: "scheduled" } : x)); }
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
          {activeTab === "leagues" && (
            <motion.div key="leagues" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-zff-green" />
                  <h2 className="font-bold text-zff-black">Public League Prizes</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-6">Set prize descriptions for each public league. Prizes are shown to all members on the Leagues page.</p>

                {publicLeagues.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No public leagues yet.</p>
                ) : publicLeagues.map((league) => (
                  <div key={league.id} className="border border-slate-200 rounded-2xl p-5 mb-4 last:mb-0">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold text-zff-black">{league.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{league.member_count.toLocaleString()} members</p>
                      </div>
                      {league.prizes && (league.prizes.first || league.prizes.second || league.prizes.third) && (
                        <span className="text-[10px] bg-yellow-100 border border-yellow-300 text-yellow-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                          <Gift className="w-3 h-3" /> Prizes set
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {[
                        { key: "first",  label: "🥇 1st Place Prize" },
                        { key: "second", label: "🥈 2nd Place Prize" },
                        { key: "third",  label: "🥉 3rd Place Prize" },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                          <label className="text-xs font-medium text-muted-foreground sm:w-32 sm:shrink-0">{label}</label>
                          <input
                            type="text"
                            value={editingPrizes[league.id]?.[key as "first" | "second" | "third"] ?? ""}
                            onChange={(e) => setEditingPrizes(prev => ({
                              ...prev,
                              [league.id]: { ...prev[league.id], [key]: e.target.value },
                            }))}
                            placeholder={`e.g. Season merchandise pack`}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-zff-black placeholder:text-muted-foreground focus:outline-none focus:border-zff-green/50"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete "${league.name}" and remove all ${league.member_count} members?`)) return;
                          const result = await deleteLeagueAction(league.id);
                          if (result.error) { showToast("error", result.error); return; }
                          setPublicLeagues(prev => prev.filter(l => l.id !== league.id));
                          showToast("success", "League deleted");
                        }}
                        className="text-xs text-red-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete League
                      </button>
                      <button
                        onClick={() => savePrizes(league.id)}
                        disabled={savingPrize === league.id}
                        className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 disabled:opacity-60"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {savingPrize === league.id ? "Saving…" : "Save Prizes"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "flags" && (
            <motion.div key="flags" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="glass-card p-7 max-w-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-bold text-zff-black flex items-center gap-2">
                      <ToggleLeft className="w-4 h-4 text-zff-green" /> Feature Flags
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Enable or disable platform features without a deployment
                    </p>
                  </div>
                  <button
                    onClick={saveFlags}
                    disabled={flagSaving}
                    className={cn(
                      "text-xs font-semibold px-4 py-2 rounded-xl border transition-all flex items-center gap-1.5 disabled:opacity-60",
                      flagSaved
                        ? "bg-emerald-600/20 border-emerald-600/40 text-emerald-600"
                        : "btn-primary"
                    )}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {flagSaving ? "Saving..." : flagSaved ? "Saved!" : "Save Flags"}
                  </button>
                </div>

                <div className="space-y-3">
                  {FLAG_DEFS.map(({ key, label, desc }) => (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center justify-between gap-4 p-4 rounded-xl border transition-all",
                        flags[key]
                          ? "border-zff-green/20 bg-zff-green/5"
                          : "border-slate-200 bg-slate-50/50"
                      )}
                    >
                      <div>
                        <p className="text-sm font-medium text-zff-black">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                      <button
                        onClick={() => setFlags((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className={cn(
                          "relative w-12 h-6 rounded-full border transition-all shrink-0",
                          flags[key] ? "bg-zff-green/20 border-zff-green/40" : "bg-slate-100 border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-0.5 w-5 h-5 rounded-full transition-all shadow-sm",
                          flags[key] ? "left-6 bg-zff-green" : "left-0.5 bg-slate-300"
                        )} />
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground mt-5 p-3 rounded-lg bg-zff-green/5 border border-zff-green/20 text-zff-black">
                  Changes take effect for all users within a few seconds of saving — no deployment needed.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Edit Player Modal ── */}
      <AnimatePresence>
        {editForm && (
          <>
            <motion.div key="ep-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !savingEdit && (setEditingPlayer(null), setEditForm(null))}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <motion.div key="ep-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-zff-black">Edit Player</h2>
                  <button onClick={() => { setEditingPlayer(null); setEditForm(null); }} disabled={savingEdit}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                  <input value={editForm.name} onChange={e => setEditForm(p => p && ({ ...p, name: e.target.value }))} className="input text-sm py-2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Position</label>
                    <select value={editForm.position} onChange={e => setEditForm(p => p && ({ ...p, position: e.target.value }))} className="select text-sm py-2">
                      {["GK","DEF","MID","FWD"].map(pos => <option key={pos} value={pos}>{pos}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Price ($m)</label>
                    <input type="number" step="0.1" min="0.1" max="20" value={editForm.price}
                      onChange={e => setEditForm(p => p && ({ ...p, price: e.target.value }))} className="input text-sm py-2" />
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-slate-100">
                  <span className="text-sm text-zff-black">Injured</span>
                  <button onClick={() => setEditForm(p => p && ({ ...p, is_injured: !p.is_injured }))}
                    className={cn("relative w-11 h-6 rounded-full border transition-all", editForm.is_injured ? "bg-red-500/20 border-red-500/40" : "bg-slate-100 border-slate-200")}>
                    <div className={cn("absolute top-0.5 w-5 h-5 rounded-full transition-all shadow-sm", editForm.is_injured ? "left-5 bg-red-500" : "left-0.5 bg-slate-300")} />
                  </button>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setEditingPlayer(null); setEditForm(null); }} disabled={savingEdit} className="btn-outline text-sm py-2.5 flex-1">Cancel</button>
                  <button onClick={saveEdit} disabled={savingEdit || !editForm.name.trim() || !editForm.price}
                    className="btn-primary text-sm py-2.5 flex-1 disabled:opacity-60">
                    {savingEdit ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Delete Player Confirm ── */}
      <AnimatePresence>
        {confirmDeletePlayer && (
          <>
            <motion.div key="dp-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !deletingPlayer && setConfirmDeletePlayer(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <motion.div key="dp-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 space-y-4">
                <h2 className="font-bold text-zff-black">Delete Player</h2>
                <p className="text-sm text-muted-foreground">
                  Delete <span className="font-semibold text-zff-black">{players.find(p => p.id === confirmDeletePlayer)?.name}</span>?
                  This will remove them from all fantasy teams and cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeletePlayer(null)} disabled={deletingPlayer} className="btn-outline text-sm py-2.5 flex-1">Cancel</button>
                  <button onClick={() => handleDeletePlayer(confirmDeletePlayer)} disabled={deletingPlayer}
                    className="flex-1 text-sm py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-60">
                    {deletingPlayer ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Admin Reset Password Modal ── */}
      <AnimatePresence>
        {resetPwUser && (
          <>
            <motion.div key="rp-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !resetPwSaving && setResetPwUser(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <motion.div key="rp-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-zff-black flex items-center gap-2"><KeyRound className="w-4 h-4 text-amber-500" /> Reset Password</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Setting new password for <span className="font-semibold text-zff-black">@{resetPwUser.username}</span></p>
                  </div>
                  <button onClick={() => setResetPwUser(null)} disabled={resetPwSaving} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
                </div>
                {[
                  { key: "next",    label: "New password",     placeholder: "At least 8 characters" },
                  { key: "confirm", label: "Confirm password", placeholder: "Repeat new password" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                    <div className="relative">
                      <input type="password" value={resetPwForm[key as keyof typeof resetPwForm]}
                        onChange={e => setResetPwForm(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder} className="input text-sm py-2" />
                    </div>
                  </div>
                ))}
                {resetPwError && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{resetPwError}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setResetPwUser(null)} disabled={resetPwSaving} className="btn-outline text-sm py-2.5 flex-1">Cancel</button>
                  <button onClick={resetPassword} disabled={resetPwSaving} className="btn-primary text-sm py-2.5 flex-1 disabled:opacity-60">
                    {resetPwSaving ? "Saving…" : "Set Password"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Scoring Modal ── */}
      <AnimatePresence>
        {scoringMatch && (
          <>
            <motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !savingStats && setScoringMatch(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <motion.div key="modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
                  <div>
                    <h2 className="font-bold text-zff-black text-lg">
                      {scoringMatch.home_team} vs {scoringMatch.away_team}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      MD{scoringMatch.matchday} · {scoringMatch.season} · Enter minutes + events for each player
                    </p>
                  </div>
                  <button onClick={() => setScoringMatch(null)} disabled={savingStats}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Player stat table */}
                <div className="overflow-y-auto flex-1">
                  {statsLoading ? (
                    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading players…</div>
                  ) : (
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[580px] text-sm">
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
                        {(["GK", "DEF", "MID", "FWD"] as const).map(pos => {
                          const posPlayers = playerStatRows.filter(r => r.position === pos);
                          if (posPlayers.length === 0) return null;
                          return (
                            <>
                              <tr key={`pos-${pos}`} className="bg-slate-50/80">
                                <td colSpan={8} className="px-4 py-1.5">
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", getPositionColor(pos))}>{pos}</span>
                                </td>
                              </tr>
                              {posPlayers.map(row => (
                                <tr key={row.player_id} className={cn("hover:bg-slate-50/50 transition-colors", row.minutes > 0 && "bg-zff-green/[0.02]")}>
                                  <td className="px-4 py-2.5">
                                    <p className="text-sm font-medium text-zff-black">{row.name}</p>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <input type="number" min={0} max={120} value={row.minutes}
                                      onChange={e => updateStat(row.player_id, "minutes", Math.max(0, Math.min(120, parseInt(e.target.value) || 0)))}
                                      className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-zff-green/50 bg-white" />
                                  </td>
                                  {(["goals","assists","yellow_cards","red_cards"] as const).map(field => (
                                    <td key={field} className="px-3 py-2.5">
                                      <input type="number" min={0} max={field === "yellow_cards" || field === "red_cards" ? 2 : 10}
                                        value={row[field] as number}
                                        onChange={e => updateStat(row.player_id, field, Math.max(0, parseInt(e.target.value) || 0))}
                                        className="w-12 text-center border border-slate-200 rounded-lg px-1 py-1 text-sm focus:outline-none focus:border-zff-green/50 bg-white mx-auto block" />
                                    </td>
                                  ))}
                                  <td className="px-3 py-2.5 text-center">
                                    {(pos === "GK" || pos === "DEF" || pos === "MID") ? (
                                      <input type="checkbox" checked={row.clean_sheet}
                                        onChange={e => updateStat(row.player_id, "clean_sheet", e.target.checked)}
                                        className="w-4 h-4 accent-zff-green cursor-pointer" />
                                    ) : <span className="text-muted-foreground text-xs">—</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-right">
                                    <span className={cn("text-sm font-bold", row.minutes > 0 ? "text-zff-green" : "text-slate-300")}>
                                      {row.fantasy_points}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 bg-slate-50/50">
                  <p className="text-xs text-muted-foreground hidden sm:block flex-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Set minutes to 0 to exclude a player. Points auto-calculate via DB trigger when saved.
                  </p>
                  <div className="flex items-center gap-3 justify-end sm:shrink-0 flex-wrap">
                    <button onClick={() => setScoringMatch(null)} disabled={savingStats} className="btn-outline text-sm px-4 sm:px-5 py-2.5">
                      Cancel
                    </button>
                    {scoringMatch?.status === "finished" && (
                      <button onClick={() => handleReopen(scoringMatch)} disabled={reopening || savingStats}
                        className="text-sm px-4 py-2.5 rounded-xl border border-amber-400/40 text-amber-600 hover:bg-amber-50 transition-colors flex items-center gap-2 disabled:opacity-50">
                        {reopening ? <span className="w-4 h-4 border-2 border-amber-400/40 border-t-amber-500 rounded-full animate-spin" /> : "↩"}
                        Reopen Match
                      </button>
                    )}
                    <button onClick={saveAndFinalise} disabled={savingStats || statsLoading}
                      className="btn-primary text-sm px-4 sm:px-6 py-2.5 flex items-center gap-2 disabled:opacity-60">
                      {savingStats ? (
                        <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          {calculating ? "Calculating…" : "Saving…"}</>
                      ) : (
                        <><Zap className="w-4 h-4" /> <span className="hidden sm:inline">Finalise &amp; Calculate </span>Points</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Live Scoring Modal ── */}
      <AnimatePresence>
        {liveScoreMatch && (
          <>
            <motion.div key="ls-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setLiveScoreMatch(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
            <motion.div key="ls-modal" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <h2 className="font-bold text-zff-black">Live Scoring</h2>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{liveScoreMatch.home_team} vs {liveScoreMatch.away_team} · MD{liveScoreMatch.matchday}</p>
                  </div>
                  <button onClick={() => setLiveScoreMatch(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Score display */}
                <div className="p-5 border-b border-slate-200 shrink-0">
                  <div className="flex items-center justify-center gap-6">
                    <div className="text-center min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground mb-1 truncate">{liveScoreMatch.home_team}</p>
                    </div>
                    <div className="text-center shrink-0">
                      <p className="text-4xl font-display text-zff-black">{liveScoreMatch.home_score ?? 0} – {liveScoreMatch.away_score ?? 0}</p>
                    </div>
                    <div className="text-center min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground mb-1 truncate">{liveScoreMatch.away_team}</p>
                    </div>
                  </div>
                </div>

                {/* Log event form */}
                <div className="p-5 border-b border-slate-200 space-y-3 shrink-0">
                  <h3 className="text-xs font-bold text-zff-black uppercase tracking-wide">Log Event</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium block mb-1">Minute</label>
                      <input type="number" min="0" max="120" value={eventForm.minute}
                        onChange={e => setEventForm(p => ({ ...p, minute: e.target.value }))}
                        placeholder="e.g. 11" className="input-field text-sm w-full" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium block mb-1">Event</label>
                      <select value={eventForm.event_type}
                        onChange={e => setEventForm(p => ({ ...p, event_type: e.target.value, player_id: "", player_name: "" }))}
                        className="input-field text-sm w-full">
                        <option value="goal">⚽ Goal</option>
                        <option value="own_goal">🔴 Own Goal</option>
                        <option value="assist">🎯 Assist</option>
                        <option value="yellow_card">🟨 Yellow Card</option>
                        <option value="red_card">🟥 Red Card</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["home", "away"] as const).map(side => (
                      <button key={side} type="button"
                        onClick={() => setEventForm(p => ({ ...p, side, player_id: "", player_name: "" }))}
                        className={cn("text-xs font-bold py-2 rounded-xl border transition-all truncate",
                          eventForm.side === side ? "bg-zff-green/10 border-zff-green/30 text-zff-green" : "border-slate-200 text-muted-foreground hover:border-slate-300")}>
                        {side === "home" ? liveScoreMatch.home_team : liveScoreMatch.away_team}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium block mb-1">Player</label>
                    <select value={eventForm.player_id}
                      onChange={e => {
                        const p = matchPlayers.find(pl => pl.id === e.target.value);
                        setEventForm(prev => ({ ...prev, player_id: e.target.value, player_name: p?.name ?? "" }));
                      }}
                      className="input-field text-sm w-full">
                      <option value="">Select player…</option>
                      {["GK","DEF","MID","FWD"].map(pos => (
                        <optgroup key={pos} label={pos}>
                          {matchPlayers.filter(p => p.position === pos && p.club === (eventForm.side === "home" ? liveScoreMatch.home_team : liveScoreMatch.away_team)).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <button onClick={submitEvent}
                    disabled={loggingEvent || !eventForm.minute || !eventForm.player_name}
                    className="btn-primary text-sm w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
                    {loggingEvent ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
                    Log Event
                  </button>
                </div>

                {/* Events log */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {liveEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No events logged yet</p>
                  ) : (
                    [...liveEvents].reverse().map(ev => {
                      const icons: Record<string, string> = { goal: "⚽", own_goal: "🔴", assist: "🎯", yellow_card: "🟨", red_card: "🟥" };
                      return (
                        <div key={ev.id} className="flex items-center gap-3 px-5 py-2.5">
                          <span className="text-xs font-bold text-muted-foreground shrink-0 w-8 text-right">{ev.minute}&apos;</span>
                          <span className="text-sm flex-1 min-w-0 truncate">{icons[ev.event_type] ?? "📋"} {ev.player_name}</span>
                          <button onClick={() => deleteEvent(ev.id)} className="text-slate-300 hover:text-red-400 transition-colors shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="admin-toast"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold text-white pointer-events-none max-w-sm",
              toast.type === "success" ? "bg-zff-green" : "bg-red-500"
            )}
          >
            {toast.type === "success"
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertTriangle className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}