"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { BarChart2, CheckCircle2, Clock, TrendingUp, TrendingDown, Table2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, getPositionColor } from "@/lib/utils";

type Sport = "football" | "cricket" | "rugby";
type Country = "Zimbabwe" | "South Africa" | "Botswana";

const SPORT_TABS: { id: Sport; label: string; emoji: string }[] = [
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "cricket",  label: "Cricket",  emoji: "🏏" },
  { id: "rugby",    label: "Rugby",    emoji: "🏉" },
];

// Which countries actually have seeded teams for each sport — e.g. no
// Botswana cricket league exists to seed (see the migration's sourcing
// notes), so it's left out rather than shown as an empty option.
const COUNTRIES_BY_SPORT: Record<Sport, Country[]> = {
  football: ["Zimbabwe", "South Africa", "Botswana"],
  cricket:  ["Zimbabwe", "South Africa"],
  rugby:    ["Zimbabwe", "South Africa", "Botswana"],
};

const COUNTRY_FLAGS: Record<Country, string> = { Zimbabwe: "🇿🇼", "South Africa": "🇿🇦", Botswana: "🇧🇼" };

function SportTabs({ value, onChange }: { value: Sport; onChange: (s: Sport) => void }) {
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
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

function CountryTabs({ sport, value, onChange }: { sport: Sport; value: Country; onChange: (c: Country) => void }) {
  const options = COUNTRIES_BY_SPORT[sport];
  if (options.length <= 1) return null;
  return (
    <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
      {options.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
            value === c ? "bg-white text-zff-black shadow-sm" : "text-muted-foreground hover:text-zff-black"
          )}
        >
          <span>{COUNTRY_FLAGS[c]}</span> {c}
        </button>
      ))}
    </div>
  );
}

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

interface TeamStat {
  name: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  for: number;
  against: number;
}

type StatSort = "total_points" | "goals" | "assists" | "clean_sheets" | "minutes_played";

// Cricket and rugby have no player roster in this app — matches there only
// carry a final score for Score Predictions (see finishPredictionOnlyMatchAction
// in lib/actions/admin.ts) — so their "stats" is a team standings table
// derived from finished matches, instead of football's per-player table.
function buildTeamStats(finished: Match[]): TeamStat[] {
  const table = new Map<string, TeamStat>();
  function row(name: string): TeamStat {
    let r = table.get(name);
    if (!r) { r = { name, played: 0, won: 0, lost: 0, drawn: 0, for: 0, against: 0 }; table.set(name, r); }
    return r;
  }
  for (const m of finished) {
    if (m.home_score === null || m.away_score === null) continue;
    const home = row(m.home_team);
    const away = row(m.away_team);
    home.played++; away.played++;
    home.for += m.home_score; home.against += m.away_score;
    away.for += m.away_score; away.against += m.home_score;
    if (m.home_score > m.away_score) { home.won++; away.lost++; }
    else if (m.home_score < m.away_score) { away.won++; home.lost++; }
    else { home.drawn++; away.drawn++; }
  }
  return [...table.values()].sort((a, b) => (b.won * 2 + b.drawn) - (a.won * 2 + a.drawn) || (b.for - b.against) - (a.for - a.against));
}

export default function MatchStatsPage() {
  const [sport, setSport]           = useState<Sport>("football");
  const [country, setCountry]       = useState<Country>("Zimbabwe");
  const [matches, setMatches]       = useState<Match[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<"results" | "fixtures">("results");
  const [statSort, setStatSort]     = useState<StatSort>("total_points");
  const [sortDir, setSortDir]       = useState<"desc" | "asc">("desc");

  // A country that isn't seeded for the newly-selected sport (e.g. Botswana
  // has no cricket) falls back to Zimbabwe rather than showing an empty page.
  function changeSport(s: Sport) {
    setSport(s);
    if (!COUNTRIES_BY_SPORT[s].includes(country)) setCountry("Zimbabwe");
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        if (sport === "football") {
          const [{ data: matchData }, { data: statsData }] = await Promise.all([
            sb.from("matches").select("*").eq("sport", "football").eq("country", country).order("kickoff_time", { ascending: false }),
            sb.from("players").select("id, name, position, goals, assists, clean_sheets, minutes_played, yellow_cards, red_cards, total_points").order("total_points", { ascending: false }),
          ]);
          if (cancelled) return;
          if (matchData) setMatches(matchData);
          if (statsData) setPlayerStats(statsData);
        } else {
          const { data: matchData } = await sb.from("matches").select("*").eq("sport", sport).eq("country", country).order("kickoff_time", { ascending: false });
          if (cancelled) return;
          if (matchData) setMatches(matchData);
          setPlayerStats([]);
        }
      } catch { /* empty state */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [sport, country]);

  const results  = matches.filter(m => m.status === "finished");
  const fixtures = matches.filter(m => m.status !== "finished").reverse();
  const totalGoals = results.reduce((s, m) => s + (m.home_score ?? 0) + (m.away_score ?? 0), 0);
  const teamStats = sport !== "football" ? buildTeamStats(results) : [];

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

  const sportLabel = sport === "football" ? "Football" : sport === "cricket" ? "Cricket" : "Rugby";
  const unitLabel = sport === "cricket" ? "Runs" : sport === "rugby" ? "Points" : "Goals";

  return (
    <div className="min-h-screen">
      <TopBar
        title={country === "Zimbabwe" ? `${sportLabel} Match Stats` : `${country} ${sportLabel} Match Stats`}
        subtitle={`${sportLabel} results, fixtures & performance`}
      />

      <div className="p-4 sm:p-6 lg:p-8 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <SportTabs value={sport} onChange={changeSport} />
          <CountryTabs sport={sport} value={country} onChange={setCountry} />
        </div>

        {/* Season summary */}
        {results.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Matchdays Played", short: "MD",     value: results.length, cls: "text-zff-black" },
              { label: `Total ${unitLabel}`, short: unitLabel, value: totalGoals,     cls: "text-zff-green" },
              { label: `Avg ${unitLabel} / Match`,short: "Avg",    value: results.length ? (totalGoals / results.length).toFixed(1) : "0.0", cls: "text-amber-500" },
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
                    <span className="text-xs text-zff-green font-semibold flex items-center gap-1">
                      <span>{COUNTRY_FLAGS[country]}</span> MD{m.matchday}
                    </span>
                    <div className="flex items-center gap-2">
                      {m.status === "finished"
                        ? <span className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" />{dateStr}</span>
                        : m.status === "live"
                        ? <span className="text-xs text-red-500 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE</span>
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
                  {!hasScore && m.status !== "live" && <p className="text-center text-xs text-muted-foreground mt-2">{timeStr} CAT</p>}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Player season stats (football only) */}
        {sport === "football" && sortedStats.length > 0 && (
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

        {/* Team season stats (cricket / rugby) */}
        {sport !== "football" && teamStats.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h2 className="font-bold text-zff-black text-sm flex items-center gap-2">
                <Table2 className="w-4 h-4 text-zff-green" /> Team Standings
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Based on finished {sportLabel.toLowerCase()} matches this season</p>
            </div>

            {/* ── Mobile card list ── */}
            <div className="sm:hidden divide-y divide-slate-100">
              {teamStats.map((t, i) => (
                <motion.div key={t.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="flex items-center gap-3 px-4 py-3">
                  <div className="w-6 h-6 rounded-lg bg-zff-green/10 flex items-center justify-center text-[10px] font-bold text-zff-green shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-zff-black truncate block">{t.name}</span>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                      <span>{t.played}P</span>
                      <span className="text-zff-green">{t.won}W</span>
                      <span>{t.drawn}D</span>
                      <span className="text-red-400">{t.lost}L</span>
                      <span>{t.for}-{t.against}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-zff-green">{t.won * 2 + t.drawn}</p>
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
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground">Team</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground">P</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground">W</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground">D</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground">L</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground">For</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground">Against</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-zff-green">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {teamStats.map((t, i) => (
                    <motion.tr key={t.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-zff-green/10 flex items-center justify-center text-[10px] font-bold text-zff-green shrink-0">{i + 1}</div>
                          <span className="text-sm font-medium text-zff-black">{t.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-zff-black">{t.played}</td>
                      <td className="px-3 py-3 text-right text-sm text-zff-black">{t.won}</td>
                      <td className="px-3 py-3 text-right text-sm text-zff-black">{t.drawn}</td>
                      <td className="px-3 py-3 text-right text-sm text-zff-black">{t.lost}</td>
                      <td className="px-3 py-3 text-right text-sm text-muted-foreground">{t.for}</td>
                      <td className="px-3 py-3 text-right text-sm text-muted-foreground">{t.against}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-zff-green">{t.won * 2 + t.drawn}</td>
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
