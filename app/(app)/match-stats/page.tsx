"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { BarChart2, CheckCircle2, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, getPositionColor } from "@/lib/utils";

interface Match {
  id: string;
  matchday: number;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  kickoff_time: string;
  season: string;
}

interface PlayerStat {
  id: string;
  name: string;
  position: string;
  goals: number;
  assists: number;
  clean_sheets: number;
  minutes_played: number;
  yellow_cards: number;
  red_cards: number;
  total_points: number;
}

type StatSort = "total_points" | "goals" | "assists" | "clean_sheets" | "minutes_played";

export default function MatchStatsPage() {
  const [matches, setMatches]       = useState<Match[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"results" | "fixtures">("results");
  const [statSort, setStatSort]     = useState<StatSort>("total_points");
  const [sortDir, setSortDir]       = useState<"desc" | "asc">("desc");

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const [{ data: matchData }, { data: statsData }] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("matches").select("*").eq("sport", "football").order("kickoff_time", { ascending: false }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("players").select("id, name, position, goals, assists, clean_sheets, minutes_played, yellow_cards, red_cards, total_points").order("total_points", { ascending: false }),
        ]);
        if (matchData) setMatches(matchData);
        if (statsData) setPlayerStats(statsData);
      } catch { /* empty state */ } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const results  = matches.filter(m => m.status === "finished");
  const fixtures = matches.filter(m => m.status !== "finished").reverse();
  const totalGoals = results.reduce((s, m) => s + (m.home_score ?? 0) + (m.away_score ?? 0), 0);

  const list = tab === "results" ? results : fixtures;

  const sortedStats = [...playerStats]
    .filter(p => p.minutes_played > 0)
    .sort((a, b) => sortDir === "desc" ? b[statSort] - a[statSort] : a[statSort] - b[statSort]);

  function toggleSort(key: StatSort) {
    if (statSort === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setStatSort(key); setSortDir("desc"); }
  }

  function SortIcon({ k }: { k: StatSort }) {
    if (statSort !== k) return null;
    return sortDir === "desc" ? <TrendingDown className="w-3 h-3 inline ml-0.5" /> : <TrendingUp className="w-3 h-3 inline ml-0.5" />;
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Football Match Stats" subtitle="Football results, fixtures & performance" />

      <div className="p-4 sm:p-6 lg:p-8 space-y-5">

        {/* Season summary */}
        {results.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Matchdays Played", short: "MD",     value: results.length, cls: "text-zff-black" },
              { label: "Total Goals",      short: "Goals",  value: totalGoals,     cls: "text-zff-green" },
              { label: "Avg Goals / Match",short: "Avg",    value: results.length ? (totalGoals / results.length).toFixed(1) : "0.0", cls: "text-amber-500" },
            ].map(s => (
              <div key={s.label} className="glass-card p-2 sm:p-4 text-center">
                <p className={cn("text-xl sm:text-2xl font-bold", s.cls)}>{s.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                  <span className="sm:hidden">{s.short}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(["results", "fixtures"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-semibold transition-all",
                tab === t ? "bg-white text-zff-black shadow-sm" : "text-muted-foreground hover:text-zff-black"
              )}
            >
              {t === "results" ? "Results" : "Upcoming"}
            </button>
          ))}
        </div>

        {/* Match cards */}
        {loading ? (
          <div className="glass-card p-12 text-center text-muted-foreground text-sm">Loading…</div>
        ) : list.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-muted-foreground">
              {tab === "results" ? "No results yet." : "No upcoming fixtures."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((m, i) => {
              const hasScore = m.home_score !== null && m.away_score !== null;
              const date     = new Date(m.kickoff_time);
              const dateStr  = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
              const timeStr  = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="p-4 rounded-xl border bg-slate-50 border-slate-200"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs text-zff-green font-semibold">MD{m.matchday}</span>
                    <div className="flex items-center gap-2">
                      {m.status === "finished"
                        ? <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" />{dateStr}</span>
                        : <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{dateStr}</span>
                      }
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm gap-1">
                    <span className="font-semibold flex-1 truncate text-zff-black">{m.home_team}</span>
                    <span className={cn("font-bold px-2 sm:px-4 tabular-nums shrink-0", hasScore ? "text-zff-black" : "text-muted-foreground")}>
                      {hasScore ? `${m.home_score} – ${m.away_score}` : "VS"}
                    </span>
                    <span className="font-semibold flex-1 text-right truncate text-zff-black">{m.away_team}</span>
                  </div>
                  {!hasScore && <p className="text-center text-xs text-muted-foreground mt-2">{timeStr} CAT</p>}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Player season stats */}
        {sortedStats.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h2 className="font-bold text-zff-black text-sm flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-zff-green" /> Player Season Stats
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Click a column header to sort</p>
            </div>

            {/* ── Mobile card list ── */}
            <div className="sm:hidden divide-y divide-slate-100">
              {sortedStats.map((p, i) => (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-3 px-4 py-3">
                  <div className="w-6 h-6 rounded-lg bg-zff-green/10 flex items-center justify-center text-[10px] font-bold text-zff-green shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm font-semibold text-zff-black truncate">{p.name}</span>
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0", getPositionColor(p.position))}>{p.position}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>⚽ {p.goals}G</span>
                      <span>🎯 {p.assists}A</span>
                      <span>🧤 {p.clean_sheets}CS</span>
                      <span>⏱ {p.minutes_played}m</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-zff-green">{p.total_points}</p>
                    <p className="text-[9px] text-muted-foreground">pts</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100/20 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Player</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground">Pos</th>
                    {([
                      { k: "total_points" as StatSort,   label: "Pts"  },
                      { k: "goals" as StatSort,          label: "G"    },
                      { k: "assists" as StatSort,        label: "A"    },
                      { k: "clean_sheets" as StatSort,   label: "CS"   },
                      { k: "minutes_played" as StatSort, label: "Mins" },
                    ]).map(({ k, label }) => (
                      <th key={k} onClick={() => toggleSort(k)}
                        className={cn("text-right px-4 py-3 text-xs font-semibold cursor-pointer select-none hover:text-zff-black transition-colors",
                          statSort === k ? "text-zff-green" : "text-muted-foreground")}>
                        {label}<SortIcon k={k} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.map((p, i) => (
                    <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-zff-green/10 flex items-center justify-center text-[10px] font-bold text-zff-green shrink-0">{i + 1}</div>
                          <span className="text-sm font-medium text-zff-black">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", getPositionColor(p.position))}>{p.position}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-zff-green">{p.total_points}</td>
                      <td className="px-4 py-3 text-right text-sm text-zff-black">{p.goals}</td>
                      <td className="px-4 py-3 text-right text-sm text-zff-black">{p.assists}</td>
                      <td className="px-4 py-3 text-right text-sm text-zff-black">{p.clean_sheets}</td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">{p.minutes_played}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
