"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import {
  Trophy, Plus, Link2, Users, Crown, Globe, Lock,
  TrendingUp, TrendingDown, Minus, Copy, Check, Search,
  Gift, AlertCircle, CheckCircle2, X, Trash2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createLeague, joinLeague, deleteLeagueAction, getPublicLeagues, joinPublicLeague, leaveLeagueAction } from "@/lib/actions/leagues";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";
import LeaguesLoading from "./loading";


interface League {
  id: string;
  name: string;
  type: string;
  members: number;
  myRank: number;
  myPoints: number;
  leader: string;
  inviteCode: string | null;
  isOwner: boolean;
  prizes?: { first: string; second: string; third: string };
}


export default function LeaguesPage() {
  const [activeTab, setActiveTab] = useState<"global" | "my-leagues" | "create" | "join">("global");
  const [period, setPeriod] = useState<"overall" | "weekly" | "monthly">("overall");
  // Fantasy standings (weekly/monthly points) only make sense for the
  // football fantasy game — the platform-wide "Overall" view ranks by
  // Level/XP instead, same measure as Dashboard's Overall tab, so it stays
  // meaningful (and available) regardless of whether Fantasy Teams is on.
  const [rankMode, setRankMode] = useState<"fantasy" | "overall">("fantasy");
  const [overallBoard, setOverallBoard] = useState<{ rank: number; username: string; level: number; xp: number }[]>([]);
  const fantasyTeamsEnabled = useFeatureFlag("fantasyTeams");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    prizes: { first: "", second: "", third: "" },
  });
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const leagueCreationEnabled = useFeatureFlag("leagueCreation");
  const [createdLeague, setCreatedLeague] = useState<{ name: string; invite_code: string } | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinResult, setJoinResult] = useState<{ success?: string; error?: string } | null>(null);
  const [localLeagues, setLocalLeagues] = useState<League[]>([]);
  const [globalBoard, setGlobalBoard] = useState<{ rank: number; username: string; team: string; total: number; weekly: number; monthly: number; prev: number }[]>([]);
  const [weeklyTop, setWeeklyTop] = useState<{ rank: number; username: string; points: number }[]>([]);
  const [viewingLeague, setViewingLeague] = useState<League | null>(null);
  const [leagueMembers, setLeagueMembers] = useState<{ username: string; points: number; weekly: number; level: number; xp: number }[]>([]);
  const [modalRankMode, setModalRankMode] = useState<"fantasy" | "overall">("overall");
  const [membersLoading, setMembersLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [publicLeagues, setPublicLeagues] = useState<{ id: string; name: string; description: string | null; prizes: unknown }[]>([]);
  const [joiningPublic, setJoiningPublic] = useState<string | null>(null);

  async function refreshMyLeagues() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("league_members")
        .select("points, leagues(id, name, type, invite_code, owner_id, description, max_members, prizes)")
        .eq("user_id", user.id);
      if (!data?.length) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validRows = (data as any[]).filter((m: any) => m.leagues != null);
      if (!validRows.length) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const leagueIds = validRows.map((m: any) => m.leagues.id);
      // Fantasy points (points) only accrue for the football fantasy game.
      // When that game is off, "My Rank"/"Leader" fall back to Level/XP —
      // the one measure every member has regardless of which sport they
      // actually follow — computed within each group, not platform-wide.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allMembers } = await (supabase as any)
        .from("league_members")
        .select("league_id, user_id, points, profiles(username, level, xp)");
      const byLeague: Record<string, { user_id: string; username: string; points: number; level: number; xp: number }[]> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (allMembers ?? []).forEach((lm: any) => {
        if (!leagueIds.includes(lm.league_id)) return;
        (byLeague[lm.league_id] ??= []).push({
          user_id: lm.user_id, username: lm.profiles?.username ?? "—",
          points: lm.points ?? 0, level: lm.profiles?.level ?? 1, xp: lm.profiles?.xp ?? 0,
        });
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLocalLeagues(validRows.map((m: any) => {
        const members = byLeague[m.leagues.id] ?? [];
        const sorted = fantasyTeamsEnabled
          ? [...members].sort((a, b) => b.points - a.points)
          : [...members].sort((a, b) => b.level - a.level || b.xp - a.xp);
        const myIndex = sorted.findIndex((x) => x.user_id === user.id);
        return {
          id: m.leagues.id, name: m.leagues.name, type: m.leagues.type,
          members: members.length,
          myRank: myIndex >= 0 ? myIndex + 1 : 0,
          myPoints: fantasyTeamsEnabled ? (m.points ?? 0) : (sorted[myIndex]?.xp ?? 0),
          leader: sorted[0]?.username ?? "—",
          inviteCode: m.leagues.invite_code ?? null,
          isOwner: m.leagues.owner_id === user.id,
          prizes: m.leagues.prizes ?? undefined,
        };
      }));
    } catch { /* keep existing */ }
  }

  useEffect(() => {
    async function loadAll() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // My leagues
      await refreshMyLeagues();

      // Platform-wide Overall ranking — Level then XP, same as Dashboard.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: overallProfiles } = await (supabase as any)
          .from("profiles").select("id, username, level, xp")
          .order("level", { ascending: false }).order("xp", { ascending: false }).limit(50);
        if (overallProfiles) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setOverallBoard((overallProfiles as any[]).map((p: any, i: number) => ({
            rank: i + 1, username: p.username, level: p.level, xp: p.xp,
          })));
        }
      } catch { /* show empty */ }

      // Public leagues available to join
      try {
        const { leagues: pub } = await getPublicLeagues();
        setPublicLeagues(pub);
      } catch { /* keep empty */ }

      // Global leaderboard + weekly top 3
      try {
        const [{ data: profiles }, { data: teamsData }] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("profiles").select("id, username, fantasy_points").order("fantasy_points", { ascending: false }).limit(50),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("fantasy_teams").select("user_id, weekly_points"),
        ]);
        if (profiles && profiles.length > 0) {
          // Build user_id → weekly_points map from the separate teams query
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const weeklyMap: Record<string, number> = {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (teamsData ?? []).forEach((t: any) => { weeklyMap[t.user_id] = t.weekly_points ?? 0; });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const board = (profiles as any[]).map((p: any, i: number) => ({
            rank: i + 1,
            username: user && p.id === user.id ? "YourTeam" : p.username,
            team: user && p.id === user.id ? "Your Team" : `${p.username}'s XI`,
            total: p.fantasy_points,
            weekly: weeklyMap[p.id] ?? 0,
            monthly: weeklyMap[p.id] ?? 0,
            prev: i + 1,
          }));
          setGlobalBoard(board);

          // Weekly top 3 from fantasy_teams.weekly_points
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: weeklyData } = await (supabase as any)
            .from("fantasy_teams")
            .select("user_id, weekly_points, profiles(username)")
            .order("weekly_points", { ascending: false })
            .limit(3);
          if (weeklyData && weeklyData.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setWeeklyTop((weeklyData as any[]).map((w: any, i: number) => ({
              rank: i + 1,
              username: w.profiles?.username ?? "Manager",
              points: w.weekly_points ?? 0,
            })));
          }
        }
      } catch { /* show empty */
      } finally {
        setPageLoading(false);
      }
    }
    loadAll();
  }, []);

  // Don't default to a fantasy view when the fantasy game itself is off.
  useEffect(() => {
    if (!fantasyTeamsEnabled) setRankMode("overall");
  }, [fantasyTeamsEnabled]);

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  async function handleCreateLeague() {
    if (!createForm.name.trim() || !leagueCreationEnabled) return;
    setCreating(true);

    try {
      const result = await createLeague(createForm.name, createForm.description, createForm.prizes);
      if (result.error || !result.league) {
        setCreating(false);
        return;
      }
      const league = result.league;
      await refreshMyLeagues();
      setCreatedLeague({ name: league.name, invite_code: league.invite_code });
      setCreateForm({ name: "", description: "", prizes: { first: "", second: "", third: "" } });
    } catch { /* silently fail */ }

    setCreating(false);
  }

  async function handleJoinLeague() {
    if (joinCode.length < 4) return;
    setJoining(true);
    setJoinResult(null);

    try {
      const result = await joinLeague(joinCode);
      if (result.error) {
        setJoinResult({ error: result.error });
      } else {
        setJoinCode("");
        await refreshMyLeagues();
        setActiveTab("my-leagues");
      }
    } catch {
      setJoinResult({ error: "Something went wrong. Please try again." });
    } finally {
      setJoining(false);
    }
  }

  async function openLeague(league: League) {
    setViewingLeague(league);
    setLeagueMembers([]);
    setModalRankMode(fantasyTeamsEnabled ? "fantasy" : "overall");
    setMembersLoading(true);
    try {
      const supabase = createClient();
      // Fantasy points (points/weekly_points) only accrue for the football
      // fantasy game. Fetch Level/XP alongside them so the modal can rank by
      // whichever measure is actually meaningful — this group's members may
      // not all be playing fantasy football, but every one of them has XP.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("league_members")
        .select("points, weekly_points, profiles(username, level, xp)")
        .eq("league_id", league.id);
      if (data && data.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setLeagueMembers((data as any[]).map((m: any) => ({
          username: m.profiles?.username ?? "Member",
          points: m.points ?? 0,
          weekly: m.weekly_points ?? 0,
          level: m.profiles?.level ?? 1,
          xp: m.profiles?.xp ?? 0,
        })));
      }
    } catch { /* show empty */ }
    finally { setMembersLoading(false); }
  }

  function RankChange({ curr, prev }: { curr: number; prev: number }) {
    const diff = prev - curr;
    if (diff > 0) return <span className="text-zff-green text-xs flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />{diff}</span>;
    if (diff < 0) return <span className="text-red-400 text-xs flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{Math.abs(diff)}</span>;
    return <span className="text-muted-foreground text-xs"><Minus className="w-3 h-3" /></span>;
  }

  if (pageLoading) {
    return <LeaguesLoading />;
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Groups" subtitle="Private groups, group leaderboards, and platform-wide rankings" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-7">
        {/* Weekly top 3 — football fantasy only; hidden entirely when that game is off */}
        {fantasyTeamsEnabled && weeklyTop.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {weeklyTop.map((w) => (
            <div
              key={w.rank}
              className={cn("glass-card p-5 flex items-center gap-3", w.rank === 1 && "border-yellow-500/20 bg-yellow-500/5")}
            >
              <div className={cn("text-2xl", w.rank === 1 ? "rank-1" : w.rank === 2 ? "rank-2" : "rank-3")}>
                {["🥇", "🥈", "🥉"][w.rank - 1]}
              </div>
              <div>
                <p className="font-bold text-zff-black text-sm">{w.username}</p>
                <p className="text-xs text-muted-foreground">This week&apos;s top fantasy manager #{w.rank}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-lg font-display text-zff-green">{w.points}</p>
                <p className="text-[10px] text-muted-foreground">pts</p>
              </div>
            </div>
          ))}
        </div>}

        {/* Tab navigation */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: "global",     label: "Global Rankings", icon: Globe },
            { id: "my-leagues", label: "My Groups",       icon: Trophy },
            { id: "create",     label: "Create Group",    icon: Plus },
            { id: "join",       label: "Join Group",      icon: Link2 },
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
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Global Rankings ── */}
          {activeTab === "global" && (
            <motion.div key="global" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                <button onClick={() => setRankMode("overall")}
                  className={cn("px-4 py-2 rounded-lg text-xs font-semibold transition-colors", rankMode === "overall" ? "bg-white text-zff-black shadow-sm" : "text-muted-foreground")}>
                  Overall (Level &amp; XP)
                </button>
                {fantasyTeamsEnabled && (
                  <button onClick={() => setRankMode("fantasy")}
                    className={cn("px-4 py-2 rounded-lg text-xs font-semibold transition-colors", rankMode === "fantasy" ? "bg-white text-zff-black shadow-sm" : "text-muted-foreground")}>
                    Football Fantasy
                  </button>
                )}
              </div>

              {rankMode === "overall" ? (
                <div className="glass-card overflow-x-auto">
                  <div className="p-4 border-b border-slate-200">
                    <h2 className="font-bold text-zff-black">Platform-Wide Leaderboard</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Ranked by Level &amp; XP — every sport and game mode counts toward this, not just one.</p>
                  </div>
                  <table className="w-full">
                    <thead className="bg-slate-100/20">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Rank</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Member</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Level</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">XP (this level)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overallBoard.map((entry, i) => (
                        <motion.tr key={entry.rank} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="data-table-row">
                          <td className="px-4 py-3.5">
                            <div className={cn("rank-badge text-xs", entry.rank === 1 ? "rank-1" : entry.rank === 2 ? "rank-2" : entry.rank === 3 ? "rank-3" : "text-muted-foreground border border-slate-200")}>
                              {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-zff-green font-bold">
                                {entry.username[0]}
                              </div>
                              <span className="text-sm font-medium text-zff-black">{entry.username}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right text-sm font-bold text-zff-green">{entry.level}</td>
                          <td className="px-4 py-3.5 text-right text-sm text-zff-black">{entry.xp.toLocaleString()}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
              (() => {
                const sortedBoard = [...globalBoard]
                  .sort((a, b) => period === "weekly" ? b.weekly - a.weekly : period === "monthly" ? b.monthly - a.monthly : b.total - a.total)
                  .map((e, i) => ({ ...e, rank: i + 1 }));
                return (
              <div className="glass-card overflow-x-auto">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                  <h2 className="font-bold text-zff-black">Zimbabwe Fantasy Leaderboard</h2>
                  <div className="flex gap-1">
                    {(["overall", "weekly", "monthly"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-semibold capitalize border transition-all",
                          period === p
                            ? "bg-zff-green/20 border-zff-green/40 text-zff-green"
                            : "border-slate-200 text-muted-foreground hover:text-zff-black"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-100/20">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Rank</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Manager</th>
                      <th className="hidden md:table-cell text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Team</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Total Pts</th>
                      <th className="hidden sm:table-cell text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Weekly</th>
                      <th className="hidden md:table-cell text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Monthly</th>
                      <th className="hidden sm:table-cell text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBoard.map((entry, i) => (
                      <motion.tr
                        key={entry.rank}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className={cn("data-table-row", entry.username === "YourTeam" && "bg-zff-green/5")}
                      >
                        <td className="px-4 py-3.5">
                          <div className={cn(
                            "rank-badge text-xs",
                            entry.rank === 1 ? "rank-1" : entry.rank === 2 ? "rank-2" : entry.rank === 3 ? "rank-3" : "text-muted-foreground border border-slate-200"
                          )}>
                            {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs text-zff-green font-bold">
                              {entry.username[0]}
                            </div>
                            <span className={cn("text-sm font-medium", entry.username === "YourTeam" ? "text-zff-green" : "text-zff-black")}>
                              {entry.username === "YourTeam" ? "You" : entry.username}
                            </span>
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-4 py-3.5 text-sm text-muted-foreground">{entry.team}</td>
                        <td className="px-4 py-3.5 text-right text-sm font-bold text-zff-green">
                          {period === "overall" ? entry.total.toLocaleString() : period === "weekly" ? entry.weekly : entry.monthly}
                        </td>
                        <td className="hidden sm:table-cell px-4 py-3.5 text-right text-sm text-zff-black">{entry.weekly}</td>
                        <td className="hidden md:table-cell px-4 py-3.5 text-right text-sm text-zff-black">{entry.monthly}</td>
                        <td className="hidden sm:table-cell px-4 py-3.5 text-right">
                          <RankChange curr={entry.rank} prev={entry.prev} />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
                ); })()
              )}
            </motion.div>
          )}

          {/* ── My Leagues ── */}
          {activeTab === "my-leagues" && (
            <motion.div key="my" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {localLeagues.map((league) => (
                <div key={league.id} className="glass-card-hover p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-xl border", league.type === "public" ? "bg-blue-500/10 border-blue-500/20" : "bg-zff-green/10 border-zff-green/20")}>
                        {league.type === "public"
                          ? <Globe className="w-5 h-5 text-blue-400" />
                          : <Lock className="w-5 h-5 text-zff-green" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-zff-black">{league.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>{league.members.toLocaleString()} members</span>
                          {league.isOwner && <span className="text-zff-green font-medium">You are owner</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {league.inviteCode && (
                        <button
                          onClick={() => copyCode(league.inviteCode!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-muted-foreground hover:border-zff-green/30 hover:text-zff-green transition-all"
                        >
                          {copiedCode === league.inviteCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {league.inviteCode}
                        </button>
                      )}
                      <button onClick={() => openLeague(league)} className="btn-outline text-xs py-1.5 px-3">View Group</button>
                      {league.isOwner && confirmDeleteId !== league.id && (
                        <button
                          onClick={() => setConfirmDeleteId(league.id)}
                          className="p-1.5 rounded-lg border border-slate-200 text-muted-foreground hover:border-red-400/40 hover:text-red-400 transition-colors"
                          title="Delete group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!league.isOwner && confirmLeaveId !== league.id && (
                        <button
                          onClick={() => setConfirmLeaveId(league.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-muted-foreground hover:border-red-400/40 hover:text-red-400 transition-colors"
                        >
                          Leave
                        </button>
                      )}
                    </div>

                    {/* Inline leave confirmation */}
                    {!league.isOwner && confirmLeaveId === league.id && (
                      <div className="mt-3 p-3 rounded-xl border border-amber-200 bg-amber-50 space-y-2">
                        <p className="text-xs text-amber-700 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Leave <strong>{league.name}</strong>? You can rejoin later if you have the invite code.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmLeaveId(null)}
                            className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 text-muted-foreground hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            disabled={leaving}
                            onClick={async () => {
                              setLeaving(true);
                              const result = await leaveLeagueAction(league.id);
                              if (!result.error) {
                                setLocalLeagues(prev => prev.filter(l => l.id !== league.id));
                                setConfirmLeaveId(null);
                              }
                              setLeaving(false);
                            }}
                            className="flex-1 text-xs py-1.5 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60"
                          >
                            {leaving ? "Leaving…" : "Yes, Leave"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Inline delete confirmation */}
                    {league.isOwner && confirmDeleteId === league.id && (
                      <div className="mt-3 p-3 rounded-xl border border-red-200 bg-red-50 space-y-2">
                        <p className="text-xs text-red-600 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          Delete <strong>{league.name}</strong>? This removes all {league.members} members and cannot be undone.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="flex-1 text-xs py-1.5 rounded-lg border border-slate-200 text-muted-foreground hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            disabled={deleting}
                            onClick={async () => {
                              setDeleting(true);
                              const result = await deleteLeagueAction(league.id);
                              if (!result.error) {
                                setLocalLeagues(prev => prev.filter(l => l.id !== league.id));
                                setConfirmDeleteId(null);
                              }
                              setDeleting(false);
                            }}
                            className="flex-1 text-xs py-1.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors disabled:opacity-60"
                          >
                            {deleting ? "Deleting…" : "Yes, Delete"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <p className="text-xl font-display text-zff-green">#{league.myRank || "—"}</p>
                      <p className="text-xs text-muted-foreground">My Rank</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <p className="text-xl font-display text-zff-black">{league.myPoints.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{fantasyTeamsEnabled ? "My Points" : "My XP"}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center">
                      <p className="text-sm font-bold text-amber-400 flex items-center justify-center gap-1">
                        <Crown className="w-3 h-3" />{league.leader}
                      </p>
                      <p className="text-xs text-muted-foreground">Leader</p>
                    </div>
                  </div>

                  {/* Prizes */}
                  {league.prizes && (league.prizes.first || league.prizes.second || league.prizes.third) && (
                    <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200 flex items-start gap-2">
                      <Gift className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold text-yellow-700">Prizes</p>
                        {league.prizes.first  && <p className="text-yellow-600">🥇 1st — {league.prizes.first}</p>}
                        {league.prizes.second && <p className="text-yellow-600">🥈 2nd — {league.prizes.second}</p>}
                        {league.prizes.third  && <p className="text-yellow-600">🥉 3rd — {league.prizes.third}</p>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}

          {/* ── Create League ── */}
          {activeTab === "create" && (
            <motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex justify-center">
              <AnimatePresence mode="wait">
                {createdLeague ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-8 w-full max-w-2xl text-center"
                  >
                    <div className="text-5xl mb-4">🎉</div>
                    <h2 className="font-bold text-zff-black text-xl mb-2">Group Created!</h2>
                    <p className="text-muted-foreground text-sm mb-6">
                      Share the invite code with your friends to get them in.
                    </p>
                    <div className="p-4 rounded-xl bg-zff-green/5 border border-zff-green/20 mb-4">
                      <p className="text-xs text-muted-foreground mb-1">{createdLeague.name}</p>
                      <p className="text-3xl font-display text-zff-green tracking-widest">{createdLeague.invite_code}</p>
                    </div>
                    <button
                      onClick={() => copyCode(createdLeague.invite_code)}
                      className="btn-primary w-full py-3 mb-3 flex items-center justify-center gap-2"
                    >
                      {copiedCode === createdLeague.invite_code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedCode === createdLeague.invite_code ? "Copied!" : "Copy Invite Code"}
                    </button>
                    <button
                      onClick={() => { setCreatedLeague(null); setActiveTab("my-leagues"); }}
                      className="btn-outline w-full py-3 text-sm"
                    >
                      Go to My Groups
                    </button>
                  </motion.div>
                ) : (
                  <motion.div key="form" className="glass-card p-6 w-full max-w-2xl">
                    <h2 className="font-bold text-zff-black text-lg mb-5">Create Private Group</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Group Name *</label>
                        <input
                          type="text"
                          value={createForm.name}
                          onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                          placeholder="e.g. Harare Bragging Rights"
                          className="w-full px-4 py-3 bg-slate-100/50 border border-slate-200 rounded-xl text-zff-black placeholder:text-muted-foreground focus:outline-none focus:border-zff-green/50 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</label>
                        <textarea
                          value={createForm.description}
                          onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                          placeholder="Tell members what this group is about..."
                          rows={2}
                          className="w-full px-4 py-3 bg-slate-100/50 border border-slate-200 rounded-xl text-zff-black placeholder:text-muted-foreground focus:outline-none focus:border-zff-green/50 text-sm resize-none"
                        />
                      </div>

                      {/* Prizes */}
                      <div className="p-4 rounded-xl bg-yellow-50 border border-yellow-200 space-y-3">
                        <p className="text-xs font-semibold text-yellow-700 flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5" /> Prizes (optional)
                        </p>
                        {[
                          { key: "first",  label: "🥇 1st Place" },
                          { key: "second", label: "🥈 2nd Place" },
                          { key: "third",  label: "🥉 3rd Place" },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-xs text-yellow-700 w-20 shrink-0">{label}</span>
                            <input
                              type="text"
                              value={createForm.prizes[key as keyof typeof createForm.prizes]}
                              onChange={(e) => setCreateForm({
                                ...createForm,
                                prizes: { ...createForm.prizes, [key]: e.target.value },
                              })}
                              placeholder="e.g. $50 airtime"
                              className="flex-1 px-3 py-2 bg-white border border-yellow-200 rounded-lg text-xs text-zff-black placeholder:text-muted-foreground focus:outline-none focus:border-yellow-400"
                            />
                          </div>
                        ))}
                      </div>

                      {!leagueCreationEnabled && (
                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          Group creation is temporarily paused by the platform.
                        </p>
                      )}
                      <button
                        disabled={creating || !createForm.name.trim() || !leagueCreationEnabled}
                        onClick={handleCreateLeague}
                        className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <Plus className="w-4 h-4" />
                        {creating ? "Creating..." : "Create Group"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ── Join League ── */}
          {activeTab === "join" && (
            <motion.div key="join" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              {/* Private group — invite code */}
              <div className="glass-card p-6">
                <h2 className="font-bold text-zff-black text-lg mb-2">Join a Private Group</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Enter the invite code shared by whoever created the group
                </p>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinResult(null); }}
                      placeholder="Enter invite code (e.g. ABC123)"
                      maxLength={8}
                      className="w-full pl-10 pr-4 py-3 bg-slate-100/50 border border-slate-200 rounded-xl text-zff-black placeholder:text-muted-foreground focus:outline-none focus:border-zff-green/50 text-sm font-mono tracking-widest"
                    />
                  </div>

                  {joinResult?.error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {joinResult.error}
                    </div>
                  )}
                  {joinResult?.success && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-zff-green/10 border border-zff-green/20 text-zff-green text-xs">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      {joinResult.success}
                    </div>
                  )}

                  <button
                    onClick={handleJoinLeague}
                    disabled={joinCode.length < 4 || joining}
                    className="btn-primary w-full py-3 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {joining ? "Joining..." : "Join Group"}
                  </button>
                </div>
              </div>

              {/* Public leagues */}
              {publicLeagues.length > 0 && (
                <div className="glass-card overflow-hidden">
                  <div className="p-5 border-b border-slate-200 flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-zff-green" />
                    <h2 className="font-bold text-zff-black text-sm">Open to Everyone</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {publicLeagues.map(league => (
                      <div key={league.id} className="flex items-center gap-3 p-4">
                        <div className="w-9 h-9 rounded-xl bg-zff-green/10 border border-zff-green/20 flex items-center justify-center shrink-0">
                          <Globe className="w-4 h-4 text-zff-green" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zff-black truncate">{league.name}</p>
                          {league.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{league.description}</p>}
                        </div>
                        <button
                          onClick={async () => {
                            setJoiningPublic(league.id);
                            const res = await joinPublicLeague(league.id);
                            if (res.success) {
                              setPublicLeagues(prev => prev.filter(l => l.id !== league.id));
                              await refreshMyLeagues();
                              setActiveTab("my-leagues");
                            }
                            setJoiningPublic(null);
                          }}
                          disabled={joiningPublic === league.id}
                          className="btn-primary text-xs py-1.5 px-3 shrink-0 disabled:opacity-60"
                        >
                          {joiningPublic === league.id ? "…" : "Join"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── League detail modal ── */}
      <AnimatePresence>
        {viewingLeague && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setViewingLeague(null)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-full sm:max-w-3xl max-h-[88vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-200 shrink-0">
                  <div>
                    <h2 className="font-bold text-zff-black text-lg">{viewingLeague.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      {viewingLeague.type === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {viewingLeague.members.toLocaleString()} members
                      {viewingLeague.inviteCode && <span className="ml-1 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{viewingLeague.inviteCode}</span>}
                    </p>
                  </div>
                  <button onClick={() => setViewingLeague(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Leaderboard */}
                <div className="overflow-y-auto flex-1">
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading members…</div>
                  ) : leagueMembers.length === 0 ? (
                    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">No members found</div>
                  ) : (() => {
                    const sortedMembers = modalRankMode === "fantasy"
                      ? [...leagueMembers].sort((a, b) => b.points - a.points)
                      : [...leagueMembers].sort((a, b) => b.level - a.level || b.xp - a.xp);
                    return (
                    <>
                    {fantasyTeamsEnabled && (
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit m-4 mb-0">
                        <button onClick={() => setModalRankMode("overall")}
                          className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-colors", modalRankMode === "overall" ? "bg-white text-zff-black shadow-sm" : "text-muted-foreground")}>
                          Overall
                        </button>
                        <button onClick={() => setModalRankMode("fantasy")}
                          className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-colors", modalRankMode === "fantasy" ? "bg-white text-zff-black shadow-sm" : "text-muted-foreground")}>
                          Football Fantasy
                        </button>
                      </div>
                    )}
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Rank</th>
                          <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Member</th>
                          {modalRankMode === "fantasy" ? (
                            <>
                              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Fantasy Pts</th>
                              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Weekly</th>
                            </>
                          ) : (
                            <>
                              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Level</th>
                              <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">XP</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sortedMembers.map((m, i) => (
                          <tr key={m.username} className={cn("transition-colors hover:bg-slate-50", m.username === viewingLeague.leader && "bg-amber-50/50")}>
                            <td className="px-4 py-3.5">
                              <div className={cn("rank-badge text-xs", i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "text-muted-foreground border border-slate-200")}>
                                {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-zff-green/10 border border-zff-green/20 flex items-center justify-center text-xs font-bold text-zff-green">
                                  {m.username[0].toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-zff-black">@{m.username}</span>
                                {i === 0 && <Crown className="w-3 h-3 text-amber-400" />}
                              </div>
                            </td>
                            {modalRankMode === "fantasy" ? (
                              <>
                                <td className="px-4 py-3.5 text-right text-sm font-bold text-zff-green">{m.points.toLocaleString()}</td>
                                <td className="px-4 py-3.5 text-right text-sm text-zff-black">{m.weekly}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3.5 text-right text-sm font-bold text-zff-green">{m.level}</td>
                                <td className="px-4 py-3.5 text-right text-sm text-zff-black">{m.xp.toLocaleString()}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
