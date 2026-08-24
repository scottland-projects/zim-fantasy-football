"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { StatsCard } from "@/components/ui/StatsCard";
import { Trophy, Zap, Users, TrendingUp, Star, Radio, Calendar, ChevronRight, Crown, Flame, Target, Search, User, Bell, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { timeAgo } from "@/lib/utils";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";

const ACTIVITY_CONFIG: Record<string, { icon: LucideIcon; bg: string; color: string }> = {
  goal:        { icon: Zap,        bg: "bg-blue-50",   color: "text-blue-500" },
  assist:      { icon: Target,     bg: "bg-indigo-50", color: "text-indigo-500" },
  match:       { icon: Radio,      bg: "bg-red-50",    color: "text-red-500" },
  transfer:    { icon: RefreshCw,  bg: "bg-teal-50",   color: "text-teal-500" },
  league:      { icon: Crown,      bg: "bg-purple-50", color: "text-purple-500" },
  reward:      { icon: Trophy,     bg: "bg-amber-50",  color: "text-amber-500" },
  achievement: { icon: Star,       bg: "bg-yellow-50", color: "text-yellow-500" },
  clean_sheet: { icon: Users,      bg: "bg-green-50",  color: "text-green-500" },
  system:      { icon: Bell,       bg: "bg-slate-100", color: "text-slate-500" },
};

export default function DashboardPage() {
  const fantasyTeamsEnabled = useFeatureFlag("fantasyTeams");
  const chatEnabled = useFeatureFlag("chat");
  const [search, setSearch] = useState("");
  const [predictionPoints, setPredictionPoints] = useState(0);
  const [groupsJoined, setGroupsJoined]         = useState(0);
  const [achievementsCount, setAchievementsCount] = useState(0);
  const [platformRank, setPlatformRank]         = useState<number | null>(null);
  const [rankTab, setRankTab] = useState<"overall" | "fantasy">("overall");
  const [overallLeaderboard, setOverallLeaderboard] = useState<{ rank: number; username: string; level: number; xp: number }[]>([]);
  const [currentMatchday, setCurrentMatchday] = useState(12);
  const [season, setSeason] = useState("2026");
  const [leaderboard, setLeaderboard] = useState<{ rank: number; username: string; team: string; points: number; weekly: number; change: number }[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [displayMatches, setDisplayMatches] = useState<{ home: string; away: string; date: string; time: string; matchday: number; isLive: boolean; homeScore: number | null; awayScore: number | null }[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ id: string; type: string; title: string; text: string; pts: string; time: string }[]>([]);
  const [profile, setProfile] = useState<{ username: string; level: number; xp: number; avatarUrl: string | null; fantasyPoints: number } | null>(null);
  const [weeklyPoints, setWeeklyPoints]     = useState(0);
  const [globalRank, setGlobalRank]         = useState<number | null>(null);
  const [totalManagers, setTotalManagers]   = useState(0);
  const [teamValue, setTeamValue]           = useState(0);

  useEffect(() => {
    async function fetchAll() {
      try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const { data: { user } } = await supabase.auth.getUser();

        // User profile
        if (user) {
          const { data: profileData } = await sb
            .from("profiles")
            .select("username, avatar_url, level, xp, fantasy_points")
            .eq("id", user.id)
            .single();
          if (profileData) {
            setProfile({
              username: profileData.username ?? user.email?.split("@")[0] ?? "Manager",
              level: profileData.level ?? 1,
              xp: profileData.xp ?? 0,
              avatarUrl: profileData.avatar_url ?? null,
              fantasyPoints: profileData.fantasy_points ?? 0,
            });

            // Global rank — how many profiles have more points
            const { count: above } = await sb.from("profiles").select("id", { count: "exact", head: true }).gt("fantasy_points", profileData.fantasy_points ?? 0);
            const { count: total } = await sb.from("profiles").select("id", { count: "exact", head: true });
            setGlobalRank((above ?? 0) + 1);
            setTotalManagers(total ?? 0);
          }

          // Team weekly points + total value
          const { data: teamData } = await sb
            .from("fantasy_teams")
            .select("weekly_points, fantasy_team_players(players(price))")
            .eq("user_id", user.id)
            .maybeSingle();
          if (teamData) {
            setWeeklyPoints(teamData.weekly_points ?? 0);
            const val = (teamData.fantasy_team_players ?? [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .reduce((s: number, ftp: any) => s + (ftp.players?.price ?? 0), 0);
            setTeamValue(val);
          }

          // Prediction points (all sports combined) + groups + achievements —
          // stay meaningful regardless of whether Fantasy Team Game is on.
          const [{ data: preds }, { count: groupCount }, { count: achCount }] = await Promise.all([
            sb.from("score_predictions").select("points_earned").eq("user_id", user.id).not("points_earned", "is", null),
            sb.from("league_members").select("id", { count: "exact", head: true }).eq("user_id", user.id),
            sb.from("achievements").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          ]);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setPredictionPoints((preds ?? []).reduce((s: number, p: any) => s + p.points_earned, 0));
          setGroupsJoined(groupCount ?? 0);
          setAchievementsCount(achCount ?? 0);

          // Platform-wide rank — by Level then XP, the same engagement-based
          // measure every action on the platform contributes to fairly,
          // regardless of which sport or game mode it came from.
          const { count: aboveByLevel } = await sb.from("profiles").select("id", { count: "exact", head: true })
            .gt("level", profileData?.level ?? 1);
          const { count: sameLevelHigherXp } = await sb.from("profiles").select("id", { count: "exact", head: true })
            .eq("level", profileData?.level ?? 1).gt("xp", profileData?.xp ?? 0);
          setPlatformRank((aboveByLevel ?? 0) + (sameLevelHigherXp ?? 0) + 1);
        }

        // Platform-wide (Overall) leaderboard — ranked by Level then XP.
        const { data: overallProfiles } = await sb
          .from("profiles").select("id, username, level, xp")
          .order("level", { ascending: false }).order("xp", { ascending: false }).limit(10);
        if (overallProfiles) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setOverallLeaderboard((overallProfiles as any[]).map((p: any, i: number) => ({
            rank: i + 1, username: p.username, level: p.level, xp: p.xp,
          })));
        }

        // Active matchday
        const { data: nextMatch } = await sb
          .from("matches")
          .select("matchday, season")
          .eq("sport", "football")
          .in("status", ["live", "scheduled"])
          .order("kickoff_time", { ascending: true })
          .limit(1)
          .single();
        if (nextMatch) {
          setCurrentMatchday(nextMatch.matchday);
          setSeason(nextMatch.season);
        }

        // Leaderboard from profiles
        const [{ data: profiles }, { data: teamsWeekly }] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("profiles").select("id, username, fantasy_points").order("fantasy_points", { ascending: false }).limit(10),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("fantasy_teams").select("user_id, weekly_points"),
        ]);
        if (profiles && profiles.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const wkMap: Record<string, number> = {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (teamsWeekly ?? []).forEach((t: any) => { wkMap[t.user_id] = t.weekly_points ?? 0; });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setLeaderboard((profiles as any[]).map((p: any, i: number) => ({
            rank: i + 1,
            username: user && p.id === user.id ? "YourTeam" : p.username,
            team: `${p.username}'s Squad`,
            points: p.fantasy_points,
            weekly: wkMap[p.id] ?? 0,
            change: 0,
          })));
        }

        // Upcoming / live matches
        const { data: matches } = await sb
          .from("matches")
          .select("*")
          .eq("sport", "football")
          .in("status", ["scheduled", "live"])
          .order("kickoff_time", { ascending: true })
          .limit(3);
        if (matches && matches.length > 0) {
          setDisplayMatches(
            matches.map((m: {
              home_team: string; away_team: string; kickoff_time: string;
              matchday: number; status: string; home_score: number | null; away_score: number | null;
            }) => ({
              home: m.home_team,
              away: m.away_team,
              date: new Date(m.kickoff_time).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
              time: new Date(m.kickoff_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
              matchday: m.matchday,
              isLive: m.status === "live",
              homeScore: m.home_score,
              awayScore: m.away_score,
            }))
          );
        }
        // Recent notifications as activity feed
        if (user) {
          const { data: notifs } = await sb
            .from("notifications")
            .select("id, title, body, type, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(4);
          if (notifs && notifs.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setRecentActivity((notifs as any[]).map((n: any) => ({
              id: n.id,
              type: n.type,
              title: n.title ?? "",
              text: n.body ?? "",
              pts: "",
              time: n.created_at,
            })));
          }
        }
      } catch { /* show empty state */ }
      finally { setLeaderboardLoading(false); }
    }
    fetchAll();

    const supabase = createClient();
    let userId: string | null = null;
    supabase.auth.getUser().then(({ data: { user } }) => { userId = user?.id ?? null; });

    const channel = supabase.channel("dashboard-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const n = payload.new as any;
        if (n.user_id === userId) {
          setRecentActivity(prev => [{ id: n.id, type: n.type, title: n.title ?? "", text: n.body ?? "", pts: "", time: n.created_at }, ...prev].slice(0, 4));
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "notifications" }, (payload) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const deleted = payload.old as any;
        setRecentActivity(prev => prev.filter(a => a.id !== deleted.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredLeaderboard = leaderboard.filter((e) =>
    search === "" ||
    e.username.toLowerCase().includes(search.toLowerCase()) ||
    e.team.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <TopBar title="Dashboard" subtitle={`Africa Fantasy ${season} · Matchday ${currentMatchday}`} />
      <div className="p-4 sm:p-6 lg:p-8 space-y-5 lg:space-y-7">
        {profile && (
          <div className="glass-card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-zff-green/20 flex items-center justify-center shrink-0">
              {profile.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={profile.avatarUrl} alt={profile.username} className="w-full h-full object-cover" />
                : <User className="w-6 h-6 text-zff-green" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-semibold text-zff-black text-base truncate">{profile.username}</p>
                <span className="text-xs font-semibold text-zff-green bg-zff-green/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                  Level {profile.level} Fan
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">XP {profile.xp}/{profile.level * 1000}</span>
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-zff-green to-zff-green-light rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((profile.xp / (profile.level * 1000)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <Bell className="w-5 h-5 text-slate-400 hover:text-zff-black cursor-pointer transition-colors shrink-0" />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-5">
          <StatsCard title="Platform Rank"     value={platformRank ? `#${platformRank}` : "—"}   subtitle="By Level, all sports"      icon={Crown}  accentColor="gold" delay={0} />
          <StatsCard title="Prediction Points" value={predictionPoints.toLocaleString()}   subtitle="All sports combined"        icon={Target} accentColor="blue" delay={0.05} />
          {fantasyTeamsEnabled ? (
            <>
              <StatsCard title="Total Points"  value={profile ? profile.fantasyPoints.toLocaleString() : "—"} subtitle="Season total"                                                           icon={Zap}        accentColor="blue" delay={0.1} />
              <StatsCard title="Fantasy Rank"  value={globalRank ? `#${globalRank}` : "—"}                  subtitle={`of ${totalManagers} managers`}                                              icon={Trophy}     accentColor="gold" delay={0.15} />
              <StatsCard title="Weekly Points" value={weeklyPoints.toLocaleString()}                         subtitle={`Matchday ${currentMatchday - 1}`}                                            icon={TrendingUp} accentColor="blue" delay={0.2}  />
            </>
          ) : (
            <>
              <StatsCard title="Groups Joined"  value={groupsJoined.toLocaleString()}     subtitle="Private friend groups"      icon={Users} accentColor="gold" delay={0.1} />
              <StatsCard title="Achievements"   value={achievementsCount.toLocaleString()} subtitle="Badges unlocked"            icon={Star}  accentColor="blue" delay={0.15} />
              <StatsCard title="Level"          value={profile ? `${profile.level}` : "—"} subtitle={`${profile?.xp ?? 0} XP earned`} icon={Trophy} accentColor="gold" delay={0.2} />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 lg:col-span-2 glass-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                <button onClick={() => setRankTab("overall")}
                  className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors", rankTab === "overall" ? "bg-white text-zff-black shadow-sm" : "text-muted-foreground")}>
                  Overall
                </button>
                {fantasyTeamsEnabled && (
                  <button onClick={() => setRankTab("fantasy")}
                    className={cn("px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors", rankTab === "fantasy" ? "bg-white text-zff-black shadow-sm" : "text-muted-foreground")}>
                    Football Fantasy
                  </button>
                )}
              </div>
              {rankTab === "fantasy" ? (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter managers..."
                      className="pl-8 pr-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-lg text-zff-black placeholder:text-slate-400 focus:outline-none focus:border-zff-green/40 w-36"
                    />
                  </div>
                  <Link href="/leagues" className="text-zff-green text-sm font-medium hover:text-zff-green-dark flex items-center gap-1 transition-colors whitespace-nowrap">
                    Full Rankings <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : (
                <Link href="/predictions" className="text-zff-green text-sm font-medium hover:text-zff-green-dark flex items-center gap-1 transition-colors whitespace-nowrap">
                  Predictions Rankings <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
            <p className="section-subtitle mb-5">
              {rankTab === "overall"
                ? "Ranked by Level & XP — every sport and game mode counts toward this."
                : "Football fantasy team standings this season."}
            </p>

            {rankTab === "overall" ? (
              <div className="space-y-2">
                {overallLeaderboard.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">No members yet</p>
                ) : overallLeaderboard.map((entry, i) => (
                  <motion.div key={entry.rank} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className={cn("flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 rounded-xl transition-colors",
                      entry.username === profile?.username ? "border border-zff-green/20" : "hover:bg-slate-50")}
                    style={entry.username === profile?.username ? { backgroundColor: "rgba(21,128,61,0.05)" } : {}}>
                    <div className={cn("rank-badge text-xs shrink-0",
                      entry.rank === 1 ? "rank-1" : entry.rank === 2 ? "rank-2" : entry.rank === 3 ? "rank-3" : "text-slate-500 border border-slate-200 bg-slate-50")}>
                      {entry.rank <= 3 ? ["🥇","🥈","🥉"][entry.rank - 1] : entry.rank}
                    </div>
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs sm:text-sm font-semibold truncate", entry.username === profile?.username ? "text-zff-green" : "text-zff-black")}>
                        {entry.username === profile?.username ? "You — " : ""}@{entry.username}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">Level {entry.level}</p>
                    </div>
                    <div className="text-right w-20 sm:w-24 shrink-0">
                      <p className="text-sm sm:text-base font-bold text-zff-black">{entry.xp.toLocaleString()} XP</p>
                      <p className="text-xs text-muted-foreground mt-0.5">this level</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
            <div className="space-y-2">
              {leaderboardLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : filteredLeaderboard.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No results for &ldquo;{search}&rdquo;</p>
              ) : filteredLeaderboard.map((entry, i) => (
                <motion.div key={entry.rank} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className={cn("flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 rounded-xl transition-colors",
                    entry.username === "YourTeam" ? "border border-zff-green/20" : "hover:bg-slate-50")}
                  style={entry.username === "YourTeam" ? { backgroundColor: "rgba(21,128,61,0.05)" } : {}}>
                  <div className={cn("rank-badge text-xs shrink-0",
                    entry.rank === 1 ? "rank-1" : entry.rank === 2 ? "rank-2" : entry.rank === 3 ? "rank-3" : "text-slate-500 border border-slate-200 bg-slate-50")}>
                    {entry.rank <= 3 ? ["🥇","🥈","🥉"][entry.rank - 1] : entry.rank}
                  </div>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs sm:text-sm font-semibold truncate", entry.username === "YourTeam" ? "text-zff-green" : "text-zff-black")}>
                      {entry.username === "YourTeam" ? "You — " : ""}{entry.team}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">@{entry.username}</p>
                  </div>
                  <div className="text-right mr-1 sm:mr-3 hidden sm:block">
                    <p className="text-sm font-bold text-zff-green">{entry.weekly} pts</p>
                    <p className="text-xs text-muted-foreground mt-0.5">this week</p>
                  </div>
                  <div className="text-right w-14 sm:w-20 shrink-0">
                    <p className="text-sm sm:text-base font-bold text-zff-black">{entry.points.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">total pts</p>
                  </div>
                  <div className={cn("text-xs font-bold w-6 sm:w-8 text-right shrink-0",
                    entry.change > 0 ? "text-emerald-600" : entry.change < 0 ? "text-red-500" : "text-slate-400")}>
                    {entry.change > 0 ? `↑${entry.change}` : entry.change < 0 ? `↓${Math.abs(entry.change)}` : "–"}
                  </div>
                </motion.div>
              ))}
            </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="glass-card p-6">
              <h2 className="text-base font-bold text-zff-black mb-1 flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-zff-green" /> Upcoming Football Matches
              </h2>
              <p className="text-xs text-muted-foreground mb-5">
                Predicting cricket or rugby? <Link href="/predictions" className="text-zff-green font-semibold hover:underline">See those fixtures →</Link>
              </p>
              <div className="space-y-3">
                {displayMatches.map((m, i) => (
                  <div key={i} className={cn("p-4 rounded-xl border", m.isLive ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200")}>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs text-zff-green font-semibold">MD{m.matchday}</span>
                      <div className="flex items-center gap-2">
                        {m.isLive && (
                          <span className="live-badge text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block mr-1" />
                            LIVE
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{m.isLive ? "In Progress" : m.date}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-zff-black">{m.home}</span>
                      <span className={cn("font-bold px-2", m.isLive ? "text-red-500" : "text-muted-foreground")}>
                        {m.isLive && m.homeScore !== null ? `${m.homeScore} — ${m.awayScore}` : "VS"}
                      </span>
                      <span className="font-semibold text-zff-black">{m.away}</span>
                    </div>
                    {!m.isLive && <p className="text-center text-xs text-muted-foreground mt-2">{m.time} CAT</p>}
                    {m.isLive && (
                      <Link href="/live" className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors">
                        <Radio className="w-3 h-3" /> Watch Live →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
              {!displayMatches.some(m => m.isLive) && (
                <Link href="/live" className="btn-outline w-full mt-4 flex items-center justify-center gap-2 py-2.5 text-sm">
                  <Radio className="w-3.5 h-3.5" /> Live Center
                </Link>
              )}
            </div>
            <div className="glass-card p-6">
              <h2 className="text-base font-bold text-zff-black mb-5">Quick Actions</h2>
              <div className="space-y-2.5">
                {[
                  { href: "/predictions", icon: Target, label: "Score Predictions", color: "text-zff-green"    },
                  ...(fantasyTeamsEnabled ? [
                    { href: "/my-team", icon: Crown,  label: "Manage My Team", color: "text-zff-green"  },
                    { href: "/market",  icon: TrendingUp, label: "Player Market",  color: "text-blue-500" },
                  ] : []),
                  { href: "/leagues",   icon: Trophy,  label: "My Groups",      color: "text-yellow-600" },
                  ...(chatEnabled ? [
                    { href: "/chat",    icon: Flame,   label: "Matchday Chat",  color: "text-orange-500" },
                  ] : []),
                ].map((action) => (
                  <Link key={action.href} href={action.href}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-zff-green/20 hover:bg-slate-50 transition-all group">
                    <action.icon className={cn("w-4 h-4 shrink-0", action.color)} />
                    <span className="text-sm text-zff-black font-medium">{action.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 ml-auto group-hover:text-zff-green transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {recentActivity.length > 0 && (
          <div className="glass-card p-6">
            <h2 className="section-header mb-5">Recent Activity</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {recentActivity.map((activity) => {
                const cfg = ACTIVITY_CONFIG[activity.type] ?? ACTIVITY_CONFIG.system;
                const Icon = cfg.icon;
                return (
                  <div key={activity.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", cfg.bg)}>
                        <Icon className={cn("w-4 h-4", cfg.color)} />
                      </div>
                      {activity.pts && <span className="text-sm font-bold text-zff-green">{activity.pts}</span>}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-zff-black leading-tight">{activity.title}</p>
                      {activity.text && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{activity.text}</p>}
                    </div>
                    <p className="text-[11px] text-slate-400">{timeAgo(activity.time)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}