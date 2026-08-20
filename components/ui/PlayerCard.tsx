"use client";

import { motion } from "framer-motion";
import { Crown, Shield, Star } from "lucide-react";
import { cn, getPositionColor, formatPrice } from "@/lib/utils";
import type { Player } from "@/lib/supabase/types";

interface PlayerCardProps {
  player: Player;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isSelected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

const positionShort: Record<string, string> = { GK: "GK", DEF: "DEF", MID: "MID", FWD: "FWD" };

export function PlayerCard({ player, isCaptain, isViceCaptain, isSelected, compact, onClick }: PlayerCardProps) {
  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onClick}
        className={cn(
          "relative flex flex-col items-center p-1 sm:p-2 rounded-xl border cursor-pointer transition-all duration-200",
          isSelected
            ? "border-zff-green/40 bg-zff-green/5"
            : "border-slate-200 bg-white hover:border-zff-green/20"
        )}
      >
        {/* Captain badges */}
        {isCaptain && (
          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center z-10">
            <Crown className="w-3 h-3 text-black" />
          </div>
        )}
        {isViceCaptain && (
          <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center z-10">
            <span className="text-[8px] font-bold text-black">VC</span>
          </div>
        )}

        {/* Player avatar */}
        <div className="w-9 h-11 sm:w-12 sm:h-14 rounded-lg overflow-hidden bg-slate-100 mb-1 sm:mb-1.5 flex items-center justify-center border border-slate-200">
          {player.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.image_url} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <span className="text-lg sm:text-2xl font-display text-zff-green/60">
                {player.name.split(" ").map(n => n[0]).join("")}
              </span>
            </div>
          )}
        </div>

        <span className={cn("text-[8px] sm:text-[9px] font-bold px-1 sm:px-1.5 py-0.5 rounded border mb-0.5 sm:mb-1", getPositionColor(player.position))}>
          {positionShort[player.position]}
        </span>
        <p className="text-[9px] sm:text-[10px] font-medium text-zff-black text-center leading-tight max-w-full truncate w-full px-0.5 sm:px-1">
          {player.name.split(" ").pop()}
        </p>
        <p className="text-[9px] sm:text-[10px] text-zff-green font-bold">{player.total_points}pts</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "glass-card-hover p-4 cursor-pointer",
        isSelected && "border-zff-green/30 bg-zff-green/5"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="w-16 h-20 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border border-slate-200 flex-shrink-0">
          {player.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.image_url} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl font-display text-zff-green/60">
              {player.name.split(" ").map(n => n[0]).join("")}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", getPositionColor(player.position))}>
              {player.position}
            </span>
            {player.is_injured && (
              <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold">INJ</span>
            )}
          </div>
          <h3 className="font-bold text-zff-black text-sm leading-tight">{player.name}</h3>
          <p className="text-xs text-muted-foreground">{player.club}</p>

          <div className="flex items-center gap-3 mt-2">
            <div className="text-center">
              <p className="text-sm font-bold text-zff-green">{player.total_points}</p>
              <p className="text-[9px] text-muted-foreground">PTS</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-zff-black">{player.goals}</p>
              <p className="text-[9px] text-muted-foreground">GLS</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-zff-black">{player.assists}</p>
              <p className="text-[9px] text-muted-foreground">AST</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-amber-400">{formatPrice(player.price)}</p>
              <p className="text-[9px] text-muted-foreground">VAL</p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center gap-1 mb-1">
            <Star className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-bold text-amber-400">{player.form.toFixed(1)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">{player.ownership_percent.toFixed(1)}% own</p>
          {isCaptain && (
            <div className="mt-2 flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-full">
              <Crown className="w-3 h-3 text-yellow-400" />
              <span className="text-[10px] text-yellow-400 font-bold">Captain</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
