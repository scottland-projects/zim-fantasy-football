"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { Search, SlidersHorizontal, TrendingUp, TrendingDown, ShoppingCart, Check, Info, X } from "lucide-react";
import { cn, formatPrice, getPositionColor } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Player } from "@/lib/supabase/types";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";
import { FeatureDisabled } from "@/components/ui/FeatureDisabled";


type SortKey = "total_points" | "price" | "form" | "ownership_percent" | "goals" | "assists";

export default function MarketPage() {
  // ── State ──────────────────────────────────────────────────────────
  const [search, setSearch]           = useState("");
  const [posFilter, setPosFilter]     = useState<string>("ALL");
  const [sortBy, setSortBy]           = useState<SortKey>("total_points");
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [players, setPlayers]         = useState<Player[]>([]);
  const [inMyTeam, setInMyTeam]       = useState<Set<string>>(new Set<string>());
  const [toast, setToast]             = useState<{ msg: string; type: "buy" | "sell" } | null>(null);
  const [busy, setBusy]               = useState<string | null>(null);
  const [showGuide, setShowGuide]     = useState(true);
  const marketplaceEnabled            = useFeatureFlag("marketplace");
  const fantasyTeamsEnabled           = useFeatureFlag("fantasyTeams");

  // Team ID cached so every buy/sell doesn't need to re-fetch it
  const teamIdRef   = useRef<string | null>(null);
  const toastTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load players + squad from Supabase ────────────────────────────
  // Skipped while Fantasy Teams is disabled — see the matching fix on
  // /my-team. This also used to plain-INSERT a new fantasy_teams row on a
  // user's first visit without an ON CONFLICT target; fantasy_teams.user_id
  // is UNIQUE, so two near-simultaneous loads (a double-mount in dev, two
  // tabs, a fast re-render) both seeing no existing team raced to insert
  // one each, and the loser got a 409 instead of just finding what the
  // winner created. Upserting makes it race-safe.
  useEffect(() => {
    if (!fantasyTeamsEnabled) return;
    async function load() {
      try {
        const supabase = createClient();
        const [{ data: playersData }, { data: authData }] = await Promise.all([
          supabase.from("players").select("*").order("total_points", { ascending: false }),
          supabase.auth.getUser(),
        ]);
        if (playersData && playersData.length > 0) setPlayers(playersData);

        if (!authData.user) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const { data: team } = await sb
          .from("fantasy_teams")
          .select("id, fantasy_team_players(player_id)")
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (team) {
          teamIdRef.current = team.id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ids = (team.fantasy_team_players ?? []).map((p: any) => p.player_id as string);
          setInMyTeam(new Set(ids));
        } else {
          // First visit — create the team record (idempotent: if another
          // near-simultaneous load already created it, this just returns
          // that existing row instead of erroring).
          const { data: newTeam } = await sb
            .from("fantasy_teams")
            .upsert({ user_id: authData.user.id, team_name: "My Dream XI", formation: "4-3-3" }, { onConflict: "user_id", ignoreDuplicates: false })
            .select("id")
            .single();
          if (newTeam) teamIdRef.current = newTeam.id;
        }
      } catch { /* keep mock player list, inMyTeam stays empty */ }
    }
    load();
  }, [fantasyTeamsEnabled]);

  // ── Buy / Sell ────────────────────────────────────────────────────
  // Budget and squad-size (15 players, $100.0M) are enforced server-side by
  // the buy_player/sell_player RPCs — see supabase/migrations/20260818130000.
  // The UI update is optimistic but rolled back if the server rejects the buy.
  async function handleBuySell(player: Player) {
    if (busy === player.id) return;
    setBusy(player.id);

    const selling = inMyTeam.has(player.id);

    // Optimistic state update
    const nextSquad = new Set(inMyTeam);
    if (selling) nextSquad.delete(player.id); else nextSquad.add(player.id);
    setInMyTeam(nextSquad);

    if (toastTimer.current) clearTimeout(toastTimer.current);

    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data, error } = await sb.rpc(selling ? "sell_player" : "buy_player", { p_player_id: player.id });

      if (error || data?.error) {
        // Roll back the optimistic update — the server rejected this.
        setInMyTeam(inMyTeam);
        setToast({ msg: data?.error ?? "Something went wrong", type: "sell" });
        toastTimer.current = setTimeout(() => setToast(null), 3000);
        return;
      }

      setToast({ msg: selling ? `${player.name} sold` : `${player.name} bought`, type: selling ? "sell" : "buy" });
      toastTimer.current = setTimeout(() => setToast(null), 2500);
    } catch {
      setInMyTeam(inMyTeam);
      setToast({ msg: "Something went wrong", type: "sell" });
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    } finally {
      setBusy(null);
    }
  }

  // ── Sort ──────────────────────────────────────────────────────────
  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortBy(key); setSortDir("desc"); }
  }

  // ── Filtered + sorted list ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...players];
    if (posFilter !== "ALL") list = list.filter(p => p.position === posFilter);
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => {
      const av = a[sortBy] as number;
      const bv = b[sortBy] as number;
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return list;
  }, [players, search, posFilter, sortBy, sortDir]);

  const SortHeader = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th
      onClick={() => toggleSort(k)}
      className={cn("text-right px-4 py-3 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-zff-black select-none", className)}
    >
      <div className="flex items-center justify-end gap-1">
        {label}
        {sortBy === k && (sortDir === "desc" ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />)}
      </div>
    </th>
  );

  // ── Render ─────────────────────────────────────────────────────────
  if (!fantasyTeamsEnabled) {
    return <FeatureDisabled title="Player Market" message="Fantasy Teams is temporarily paused. Try Score Predictions instead." />;
  }
  if (!marketplaceEnabled) {
    return <FeatureDisabled title="Player Market" message="The club has temporarily paused transfers. Check back soon." />;
  }

  return (
    <div className="min-h-screen">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="market-toast"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-semibold text-white pointer-events-none",
              toast.type === "buy" ? "bg-zff-green" : "bg-red-500"
            )}
          >
            {toast.type === "buy"
              ? <Check className="w-4 h-4 shrink-0" />
              : <span className="text-base leading-none">✕</span>}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <TopBar title="Player Market" subtitle="Buy and sell players from any club" />

      <div className="p-4 sm:p-6 lg:p-8">

        {/* Help banner */}
        {showGuide && (
          <div className="mb-5 p-4 rounded-xl border border-zff-green/20 bg-zff-green/5 flex items-start gap-3">
            <Info className="w-4 h-4 text-zff-green mt-0.5 shrink-0" />
            <div className="flex-1 text-sm text-zff-black">
              <p className="font-semibold mb-1">Using the Player Market</p>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>• <strong>Filter by position</strong> using the tabs — GK, DEF, MID, or FWD — to narrow down your search.</p>
                <p>• <strong>Sort by any column</strong> (Points, Price, Form, Goals, Assists, Own%) by clicking the column header.</p>
                <p>• <strong>Add or remove players</strong> by tapping the + / − button on the right. Your squad updates instantly.</p>
                <p>• <strong>Own%</strong> shows how many managers have picked that player — useful for finding differentials.</p>
              </div>
            </div>
            <button onClick={() => setShowGuide(false)} className="text-muted-foreground hover:text-zff-black">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Top stats — computed from live player data */}
        {players.length > 0 && (() => {
          const topScorer   = [...players].sort((a,b) => b.goals - a.goals)[0];
          const topAssister = [...players].sort((a,b) => b.assists - a.assists)[0];
          const bestValue   = [...players].sort((a,b) => (b.total_points/(b.price/1_000_000)) - (a.total_points/(a.price/1_000_000)))[0];
          const mostOwned   = [...players].sort((a,b) => b.ownership_percent - a.ownership_percent)[0];
          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Top Scorer",    value: topScorer?.name   ?? "—", sub: `${topScorer?.goals ?? 0} goals`,                                        icon: "⚽" },
                { label: "Top Assister",  value: topAssister?.name ?? "—", sub: `${topAssister?.assists ?? 0} assists`,                                   icon: "🎯" },
                { label: "Best Value",    value: bestValue?.name   ?? "—", sub: `${(bestValue ? bestValue.total_points/(bestValue.price/1_000_000) : 0).toFixed(1)} pts/M`, icon: "💰" },
                { label: "Highest Owned", value: mostOwned?.name   ?? "—", sub: `${mostOwned?.ownership_percent.toFixed(1) ?? 0}% owned`,                icon: "👑" },
              ].map((s) => (
                <div key={s.label} className="glass-card p-5 flex flex-col items-center sm:items-start text-center sm:text-left">
                  <span className="text-2xl">{s.icon}</span>
                  <p className="text-xs text-muted-foreground mt-2">{s.label}</p>
                  <p className="text-sm font-bold text-zff-black">{s.value}</p>
                  <p className="text-xs text-zff-green">{s.sub}</p>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Filters */}
        <div className="glass-card p-5 mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search players..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border border-slate-200 rounded-xl text-zff-black placeholder:text-muted-foreground focus:outline-none focus:border-zff-green/50 text-sm"
              />
            </div>
            <div className="flex gap-1">
              {["ALL", "GK", "DEF", "MID", "FWD"].map(pos => (
                <button
                  key={pos}
                  onClick={() => setPosFilter(pos)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-bold border transition-all",
                    posFilter === pos
                      ? "bg-zff-green/20 border-zff-green/40 text-zff-green"
                      : "border-slate-200 text-muted-foreground hover:border-zff-green/20"
                  )}
                >
                  {pos}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-outline text-sm px-3 py-2 flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" /> Filters
            </button>
          </div>
        </div>

        {/* Mobile: vertical card list (no horizontal scroll) */}
        <div className="glass-card sm:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>No players found</p>
            </div>
          ) : filtered.map((player) => (
            <div key={player.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-11 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                <span className="text-sm font-display text-zff-green/60">
                  {player.name.split(" ").map(n => n[0]).join("")}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-semibold text-zff-black truncate">{player.name}</p>
                  {player.is_injured && <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-px rounded font-bold shrink-0">INJ</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0", getPositionColor(player.position))}>{player.position}</span>
                  <span className="text-xs font-bold text-zff-green">{player.total_points}pts</span>
                  <span className="text-xs font-medium text-amber-400">{formatPrice(player.price)}</span>
                </div>
              </div>
              <button
                onClick={() => handleBuySell(player)}
                disabled={busy === player.id}
                className={cn(
                  "text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1 disabled:opacity-60 shrink-0",
                  inMyTeam.has(player.id) ? "bg-red-500 text-white" : "bg-zff-green text-white"
                )}
              >
                {busy === player.id
                  ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : inMyTeam.has(player.id) ? "Sell" : "Buy"}
              </button>
            </div>
          ))}
        </div>

        {/* Desktop: sortable table */}
        <div className="glass-card hidden sm:block overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-100/20">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground w-8">#</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-muted-foreground">Player</th>
                <th className="text-center px-4 py-4 text-xs font-semibold text-muted-foreground">Pos</th>
                <SortHeader k="total_points"      label="Pts"   />
                <SortHeader k="price"             label="Price" />
                <SortHeader k="goals"             label="Goals" className="hidden md:table-cell" />
                <SortHeader k="assists"           label="Assists" className="hidden md:table-cell" />
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((player, i) => (
                <motion.tr key={player.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="data-table-row">
                  <td className="px-4 py-3 text-sm text-muted-foreground">{i + 1}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-11 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
                        <span className="text-sm font-display text-zff-green/60">{player.name.split(" ").map(n => n[0]).join("")}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zff-black flex items-center gap-2">
                          {player.name}
                          {player.is_injured && <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-px rounded font-bold">INJ</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{player.club}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getPositionColor(player.position))}>{player.position}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right"><span className="text-sm font-bold text-zff-green">{player.total_points}</span></td>
                  <td className="px-4 py-3.5 text-right"><span className="text-sm text-amber-400 font-medium">{formatPrice(player.price)}</span></td>
                  <td className="hidden md:table-cell px-4 py-3.5 text-right text-sm text-zff-black">{player.goals}</td>
                  <td className="hidden md:table-cell px-4 py-3.5 text-right text-sm text-zff-black">{player.assists}</td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => handleBuySell(player)}
                      disabled={busy === player.id}
                      className={cn(
                        "text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-wait ml-auto",
                        inMyTeam.has(player.id) ? "bg-red-500 hover:bg-red-600 text-white" : "bg-zff-green hover:bg-zff-green-dark text-white"
                      )}
                    >
                      {busy === player.id
                        ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        : inMyTeam.has(player.id) ? <>✕ Sell</> : <><ShoppingCart className="w-3 h-3" /> Buy</>}
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>No players found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
