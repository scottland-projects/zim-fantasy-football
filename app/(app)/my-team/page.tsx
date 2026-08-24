"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { PlayerCard } from "@/components/ui/PlayerCard";
import {
  Crown, Save, ChevronDown, Plus, X, Users, Zap, DollarSign,
  Info, Check, AlertCircle, ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { cn, formatPrice, getPositionColor } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { saveTeam } from "@/lib/actions/team";
import type { Player } from "@/lib/supabase/types";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";
import { FeatureDisabled } from "@/components/ui/FeatureDisabled";

const FORMATIONS: Record<string, { GK: number; DEF: number; MID: number; FWD: number }> = {
  "4-3-3": { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  "4-4-2": { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  "3-5-2": { GK: 1, DEF: 3, MID: 5, FWD: 2 },
  "5-3-2": { GK: 1, DEF: 5, MID: 3, FWD: 2 },
};

const BUDGET = 100_000_000;

export default function MyTeamPage() {
  const fantasyTeamsEnabled = useFeatureFlag("fantasyTeams");
  const [formation, setFormation]       = useState<keyof typeof FORMATIONS>("4-3-3");
  const [selectedIds, setSelectedIds]   = useState<string[]>([]);
  const [captainId, setCaptainId]       = useState<string>("");
  const [viceCaptainId, setViceCaptainId] = useState<string>("");
  const [showFormationPicker, setShowFormationPicker] = useState(false);
  const [captainMode, setCaptainMode]   = useState<"none" | "captain" | "vice">("none");
  const [saving, setSaving]             = useState(false);
  const [saveStatus, setSaveStatus]     = useState<"idle" | "success" | "error">("idle");
  const [saveError, setSaveError]       = useState<string>("");
  const [dragId, setDragId]             = useState<string | null>(null);
  const [showHelp, setShowHelp]         = useState(false);
  const [allPlayers, setAllPlayers]     = useState<Player[]>([]);
  const [squadIds, setSquadIds]         = useState<Set<string>>(new Set<string>());

  // Load players + team from Supabase on mount. Skipped while Fantasy
  // Teams is disabled — this page renders FeatureDisabled in that case and
  // never shows any of this data, but it used to fetch it anyway, firing a
  // fantasy_teams query that 406'd for any user with no team yet.
  useEffect(() => {
    if (!fantasyTeamsEnabled) return;
    async function loadData() {
      const supabase = createClient();

      // Players (always load)
      try {
        const { data: playersData } = await supabase
          .from("players")
          .select("*")
          .order("position")
          .order("total_points", { ascending: false });
        if (playersData && playersData.length > 0) setAllPlayers(playersData);
      } catch { /* keep empty */ }

      // Squad + XI (requires auth)
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: team } = await (supabase as any)
          .from("fantasy_teams")
          .select("formation, fantasy_team_players(player_id, is_captain, is_vice_captain, is_starting)")
          .eq("user_id", authData.user.id)
          .single();

        if (!team?.fantasy_team_players) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = team.fantasy_team_players as {
          player_id: string; is_captain: boolean; is_vice_captain: boolean; is_starting: boolean;
        }[];

        // Every row = a squad player (bought from Market or saved to bench)
        setSquadIds(new Set(rows.map(r => r.player_id)));

        // Starters only → starting XI
        const starters = rows.filter(r => r.is_starting).map(r => r.player_id);
        const cap      = rows.find(r => r.is_captain)?.player_id      ?? "";
        const vice     = rows.find(r => r.is_vice_captain)?.player_id ?? "";

        setFormation((team.formation ?? "4-3-3") as keyof typeof FORMATIONS);
        if (starters.length > 0) setSelectedIds(starters);
        if (cap)  setCaptainId(cap);
        if (vice) setViceCaptainId(vice);
      } catch { /* not authenticated — squad stays empty */ }
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fantasyTeamsEnabled]);

  // If the user sells a player (squadIds shrinks), drop them from the XI too
  useEffect(() => {
    if (squadIds.size > 0) {
      setSelectedIds((prev) => prev.filter((id) => squadIds.has(id)));
    }
  }, [squadIds]);

  // Only the players the user has actually bought should appear in the list
  const squadPlayers = useMemo(
    () => squadIds.size > 0 ? allPlayers.filter((p) => squadIds.has(p.id)) : [],
    [allPlayers, squadIds]
  );

  const selectedPlayers = useMemo(
    () => allPlayers.filter((p) => selectedIds.includes(p.id)),
    [allPlayers, selectedIds]
  );

  // Budget must reflect the cost of the FULL owned squad (all 15), not just
  // the current starting XI — bench players cost real money too, and this
  // is what save_fantasy_team validates against server-side. totalPoints
  // intentionally stays scoped to the starting XI: bench players don't
  // score, so a "current squad points" preview should match that.
  const totalCost   = squadPlayers.reduce((sum, p) => sum + p.price, 0);
  const budgetLeft  = BUDGET - totalCost;
  const totalPoints = selectedPlayers.reduce((sum, p) => sum + p.total_points, 0);

  const byPosition = useMemo(() => ({
    GK:  selectedPlayers.filter((p) => p.position === "GK") .slice(0, FORMATIONS[formation].GK),
    DEF: selectedPlayers.filter((p) => p.position === "DEF").slice(0, FORMATIONS[formation].DEF),
    MID: selectedPlayers.filter((p) => p.position === "MID").slice(0, FORMATIONS[formation].MID),
    FWD: selectedPlayers.filter((p) => p.position === "FWD").slice(0, FORMATIONS[formation].FWD),
  }), [selectedPlayers, formation]);

  // The ACTUAL starting XI — byPosition caps each position to the current
  // formation's slot count, so this can be shorter than selectedIds (e.g.
  // 2 GKs selected but the formation only starts 1 — the second silently
  // becomes bench). Save-eligibility must check THIS length, not
  // selectedIds.length, or the Save button can read "11/11" while the XI
  // actually sent to the server has fewer than 11 players in it.
  const startingXI = useMemo(() => [
    ...byPosition.GK, ...byPosition.DEF, ...byPosition.MID, ...byPosition.FWD,
  ], [byPosition]);

  const benchPlayers = useMemo(() => {
    const startingIds = startingXI.map((p) => p.id);
    // Bench = squad players not in the starting XI (not unowned players)
    return squadPlayers.filter((p) => !startingIds.includes(p.id)).slice(0, 4);
  }, [squadPlayers, startingXI]);

  // ── Drag and drop ──────────────────────────────────────────
  const onDragStart = useCallback((e: React.DragEvent, playerId: string) => {
    setDragId(playerId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); return; }

    setSelectedIds((prev) => {
      const next = [...prev];
      const di   = next.indexOf(dragId);
      const ti   = next.indexOf(targetId);

      if (di !== -1 && ti !== -1) {
        // Both in starting XI — swap
        [next[di], next[ti]] = [next[ti], next[di]];
      } else if (di !== -1) {
        // dragged is starting, target is bench → swap them
        next[di] = targetId;
      } else if (ti !== -1) {
        // dragged is bench, target is starting → swap them
        next[ti] = dragId;
      }
      return next;
    });

    // Carry captain/VC across the swap
    setCaptainId((prev)     => prev === dragId ? targetId : prev === targetId ? dragId : prev);
    setViceCaptainId((prev) => prev === dragId ? targetId : prev === targetId ? dragId : prev);
    setDragId(null);
  }, [dragId]);

  // ── Captain click ──────────────────────────────────────────
  function handlePlayerClick(player: Player) {
    if (captainMode === "captain") {
      setCaptainId(player.id);
      setCaptainMode("none");
    } else if (captainMode === "vice") {
      setViceCaptainId(player.id);
      setCaptainMode("none");
    }
  }

  function removePlayer(id: string) {
    setSelectedIds((prev) => prev.filter((p) => p !== id));
    if (captainId === id)     setCaptainId("");
    if (viceCaptainId === id) setViceCaptainId("");
  }

  // ── Save ──────────────────────────────────────────────────
  // Delegates to saveTeam() (lib/actions/team.ts), which calls the
  // save_fantasy_team RPC — the RPC re-validates squad size (15), starting
  // XI size (11), distinct captain/vice-captain both inside the squad, and
  // total price against the $100M budget server-side, and writes everything
  // in one transaction. Never write fantasy_teams/fantasy_team_players
  // directly from the client — budget_remaining in particular must only
  // ever be recomputed server-side from the full 15-player squad, not from
  // whichever 11 happen to be selected as starters client-side.
  const canSave = squadPlayers.length === 15 && startingXI.length === 11
    && !!captainId && !!viceCaptainId && captainId !== viceCaptainId;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveStatus("idle");
    setSaveError("");

    const startingIds = startingXI.map((p) => p.id);

    try {
      const result = await saveTeam(
        "My Dream XI",
        formation,
        squadPlayers.map((p) => p.id),
        captainId,
        viceCaptainId,
        startingIds
      );

      if (result.error) {
        setSaveError(result.error);
        setSaveStatus("error");
        return;
      }

      setSaveStatus("success");
    } catch {
      setSaveError("Something went wrong. Please try again.");
      setSaveStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  }

  // What's still missing before Save is allowed — shown inline so the
  // 15-player-squad / 11-starter / captain+vice-captain requirements aren't
  // a mystery the user only discovers via a rejected save.
  const missingForSave: string[] = [];
  if (squadPlayers.length < 15) missingForSave.push(`Buy ${15 - squadPlayers.length} more player${15 - squadPlayers.length === 1 ? "" : "s"} (need 15 total)`);
  if (squadPlayers.length > 15) missingForSave.push(`Sell ${squadPlayers.length - 15} player${squadPlayers.length - 15 === 1 ? "" : "s"} (max 15)`);
  if (startingXI.length !== 11) {
    missingForSave.push(`Pick exactly 11 starters that fit ${formation} (currently ${startingXI.length})`);
    if (selectedIds.length > startingXI.length) {
      missingForSave.push(`${selectedIds.length - startingXI.length} selected player${selectedIds.length - startingXI.length === 1 ? "" : "s"} don't fit ${formation}'s position slots — pick a different formation or swap players`);
    }
  }
  if (!captainId) missingForSave.push("Set a Captain");
  if (!viceCaptainId) missingForSave.push("Set a Vice-Captain");
  if (captainId && viceCaptainId && captainId === viceCaptainId) missingForSave.push("Captain and Vice-Captain must be different players");

  // ── Pitch slot ────────────────────────────────────────────
  function PitchSlot({ position, count }: { position: string; count: number }) {
    const players = byPosition[position as keyof typeof byPosition] ?? [];
    return (
      <div className="flex justify-center gap-1 sm:gap-3">
        {Array.from({ length: count }).map((_, i) => {
          const player = players[i];
          if (player) {
            return (
              <div
                key={player.id}
                draggable
                onDragStart={(e) => onDragStart(e, player.id)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, player.id)}
                className={cn("relative group cursor-grab active:cursor-grabbing", dragId === player.id && "opacity-50")}
                onClick={() => handlePlayerClick(player)}
              >
                <PlayerCard
                  player={player}
                  isCaptain={player.id === captainId}
                  isViceCaptain={player.id === viceCaptainId}
                  compact
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removePlayer(player.id); }}
                  className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full items-center justify-center hidden group-hover:flex z-20"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            );
          }
          return (
            <div
              key={i}
              onDragOver={onDragOver}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) {
                  setSelectedIds((prev) => {
                    if (prev.includes(dragId)) return prev;
                    return [...prev, dragId];
                  });
                  setDragId(null);
                }
              }}
              className="formation-slot formation-slot-empty w-14 h-[72px] sm:w-20 sm:h-24"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[9px] mt-1">{position}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (!fantasyTeamsEnabled) {
    return <FeatureDisabled title="Fantasy Teams" message="Squad-building is temporarily paused. Try Score Predictions instead." />;
  }

  return (
    <div className="min-h-screen">
      <TopBar title="My Team" subtitle="Build your perfect XI" />

      <div className="p-4 sm:p-6 lg:p-8">

        {/* ── Help banner ── */}
        <div className="mb-5 p-4 rounded-xl border border-zff-green/20 bg-zff-green/5 flex items-start gap-3">
          <Info className="w-4 h-4 text-zff-green mt-0.5 shrink-0" />
          <div className="flex-1 text-sm text-zff-black">
            <p className="font-semibold mb-1">How to build your team</p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>• <strong>Pick 11 players</strong> from the list on the right — tap to add or remove.</p>
              <p>• <strong>Set your Captain</strong> (2× points) using the Captain button, then tap a player on the pitch. Your Vice-Captain scores 1.5×.</p>
              <p>• <strong>Drag &amp; drop</strong> players on the pitch to reorder positions, or swap starters with bench players.</p>
              <p>• <strong>Change formation</strong> using the dropdown, then hit <strong>Save Team</strong> to lock in your selection.</p>
            </div>
            <p className="font-semibold mt-2 mb-1">How points work</p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>• <strong>Playing time</strong> — +1 pt for appearing, +1 bonus for 60+ mins.</p>
              <p>• <strong>Goals</strong> — GK +10 · DEF +6 · MID +5 · FWD +4 per goal.</p>
              <p>• <strong>Assists</strong> — +3 pts for any position.</p>
              <p>• <strong>Clean sheet</strong> (≥60 min, no goals conceded) — GK/DEF +4 · MID +1.</p>
              <p>• <strong>Cards</strong> — Yellow −1 · Red −3.</p>
            </div>
          </div>
          <button onClick={() => setShowHelp(false)} className="text-muted-foreground hover:text-zff-black">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Budget & Formation bar ── */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-4 mb-6">
          <div className="glass-card px-2 sm:px-5 py-3 sm:py-4 flex items-center gap-1.5 sm:gap-3">
            <DollarSign className="w-4 h-4 text-zff-green shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Budget</p>
              <p className={cn("text-xs sm:text-sm font-bold truncate", budgetLeft < 0 ? "text-red-400" : "text-zff-green")}>
                {formatPrice(budgetLeft)}
              </p>
            </div>
          </div>
          <div className="glass-card px-2 sm:px-5 py-3 sm:py-4 flex items-center gap-1.5 sm:gap-3">
            <Users className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Squad / Starting XI</p>
              <p className={cn("text-xs sm:text-sm font-bold", squadPlayers.length === 15 ? "text-zff-black" : "text-amber-500")}>
                {squadPlayers.length}/15 · {startingXI.length}/11
              </p>
            </div>
          </div>
          <div className="glass-card px-2 sm:px-5 py-3 sm:py-4 flex items-center gap-1.5 sm:gap-3">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Pts</p>
              <p className="text-xs sm:text-sm font-bold text-amber-400">{totalPoints}</p>
            </div>
          </div>

          <div className="col-span-3 sm:col-span-auto sm:ml-auto flex items-center justify-between sm:justify-end gap-2">
            {/* Formation picker */}
            <div className="relative">
              <button
                onClick={() => setShowFormationPicker(!showFormationPicker)}
                className="glass-card px-4 py-3 flex items-center gap-2 hover:border-zff-green/20 transition-colors"
              >
                <span className="text-sm font-bold text-zff-green">{formation}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              <AnimatePresence>
                {showFormationPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute left-0 top-full mt-2 glass-card p-2 z-50 min-w-[120px]"
                  >
                    {Object.keys(FORMATIONS).map((f) => (
                      <button
                        key={f}
                        onClick={() => { setFormation(f as keyof typeof FORMATIONS); setShowFormationPicker(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                          formation === f ? "bg-zff-green/20 text-zff-green" : "hover:bg-slate-100/50 text-zff-black"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCaptainMode(captainMode === "captain" ? "none" : "captain")}
                className={cn(
                  "btn-outline text-xs py-2 px-3 flex items-center gap-1",
                  captainMode === "captain" && "border-yellow-500/50 text-yellow-400"
                )}
              >
                <Crown className="w-3 h-3" /> Captain
              </button>
              <button
                onClick={() => setCaptainMode(captainMode === "vice" ? "none" : "vice")}
                className={cn(
                  "btn-outline text-xs py-2 px-3 flex items-center gap-1",
                  captainMode === "vice" && "border-yellow-500/50 text-yellow-400"
                )}
              >
                <Crown className="w-3 h-3" /> Vice-Captain
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !canSave}
                title={!canSave ? missingForSave.join(" · ") : undefined}
                className={cn(
                  "text-xs py-2 px-4 flex items-center gap-1 rounded-xl border font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                  saveStatus === "success"
                    ? "bg-emerald-600/20 border-emerald-600/40 text-emerald-600"
                    : "btn-primary"
                )}
              >
                {saveStatus === "success"
                  ? <><Check className="w-3 h-3" /> Saved!</>
                  : saveStatus === "error"
                    ? <><AlertCircle className="w-3 h-3" /> Error</>
                    : <><Save className="w-3 h-3" /> {saving ? "Saving..." : "Save"}</>}
              </button>
            </div>
          </div>
        </div>

        {saveStatus === "error" && saveError && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
          </div>
        )}
        {saveStatus !== "success" && missingForSave.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs">
            <span className="font-semibold">Before you can save: </span>{missingForSave.join(" · ")}
          </div>
        )}

        {captainMode !== "none" && (
          <div className="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm flex items-center gap-2">
            <Crown className="w-4 h-4" />
            {captainMode === "captain"
              ? "Click a player on the pitch to make them Captain (2x points)"
              : "Click a player on the pitch to make them Vice Captain"}
            <button onClick={() => setCaptainMode("none")} className="ml-auto text-xs hover:text-yellow-200">
              Cancel
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Pitch View ── */}
          <div className="col-span-1 lg:col-span-2">
            <div
              className="rounded-2xl overflow-hidden border border-zff-green/10"
              style={{ background: "linear-gradient(180deg, #0a1f0a 0%, #0d2a0d 50%, #0a1f0a 100%)" }}
            >
              <div className="relative p-2 sm:p-6 pitch-bg">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-zff-green/10 opacity-40" />
                <div className="absolute top-1/2 left-0 right-0 h-px bg-zff-green/10" />

                <div className="space-y-2 sm:space-y-6">
                  <PitchSlot position="FWD" count={FORMATIONS[formation].FWD} />
                  <PitchSlot position="MID" count={FORMATIONS[formation].MID} />
                  <PitchSlot position="DEF" count={FORMATIONS[formation].DEF} />
                  <PitchSlot position="GK"  count={FORMATIONS[formation].GK}  />
                </div>
              </div>

              {/* Bench */}
              <div className="border-t border-zff-green/10 p-3 sm:p-4 bg-black/40">
                <p className="text-xs text-muted-foreground text-center mb-3">BENCH — drag players here to sub out</p>
                <div className="flex justify-center gap-1 sm:gap-3">
                  {benchPlayers.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, p.id)}
                      onDragOver={onDragOver}
                      className={cn(
                        "opacity-60 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing",
                        dragId === p.id && "opacity-30"
                      )}
                      onClick={() => setSelectedIds((prev) => [...prev.slice(1), p.id])}
                    >
                      <PlayerCard player={p} compact />
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 4 - benchPlayers.length) }).map((_, i) => (
                    <div
                      key={i}
                      onDragOver={onDragOver}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragId && selectedIds.includes(dragId)) {
                          setSelectedIds((prev) => prev.filter((id) => id !== dragId));
                          setDragId(null);
                        }
                      }}
                      className="formation-slot formation-slot-empty w-14 h-[72px] sm:w-20 sm:h-24 opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Player List ── */}
          <div className="glass-card overflow-x-auto">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-zff-black text-sm">My Squad</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {squadPlayers.length > 0
                    ? `${squadPlayers.length} players · tap to add to XI`
                    : "No players bought yet"}
                </p>
              </div>
              <div className="flex gap-1">
                {(["GK", "DEF", "MID", "FWD"] as const).map((pos) => (
                  <button
                    key={pos}
                    className={cn("text-[10px] px-2 py-0.5 rounded border font-bold transition-colors", getPositionColor(pos))}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* Empty state — prompt user to buy players first */}
            {squadPlayers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <ShoppingCart className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-zff-black mb-1">Your squad is empty</p>
                <p className="text-xs text-muted-foreground mb-5">
                  Buy players from the Player Market first, then come back here to arrange your XI.
                </p>
                <Link href="/market" className="btn-primary text-xs py-2.5 px-5 flex items-center gap-2">
                  <ShoppingCart className="w-3.5 h-3.5" /> Go to Player Market
                </Link>
              </div>
            ) : (
            <div className="divide-y divide-zff-black-border">
              {squadPlayers.map((player) => {
                const inStartXI = selectedIds.includes(player.id);
                return (
                <div
                  key={player.id}
                  onClick={() => {
                    if (inStartXI) {
                      removePlayer(player.id);
                    } else {
                      setSelectedIds((prev) => [...prev, player.id]);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-slate-100/20",
                    inStartXI && "bg-zff-green/5"
                  )}
                >
                  <div className="w-8 h-10 rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-display text-zff-green/70">
                      {player.name.split(" ").map((n) => n[0]).join("")}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zff-black truncate">{player.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg border", getPositionColor(player.position))}>
                        {player.position}
                      </span>
                      {player.is_injured && (
                        <span className="text-[9px] text-red-400 font-bold">INJ</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-zff-green">{player.total_points}pts</p>
                    <p className="text-[10px] text-muted-foreground">{formatPrice(player.price)}</p>
                  </div>
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                    inStartXI ? "bg-zff-green border-zff-green" : "border-slate-200"
                  )}>
                    {inStartXI && (
                      <Check className="w-2.5 h-2.5 text-white" />
                    )}
                  </div>
                </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
