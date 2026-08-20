"use client";

import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: number;
  accentColor?: "green" | "gold" | "red" | "blue";
  delay?: number;
}

const accentMap = {
  green: { bg: "bg-zff-green/10", border: "border-zff-green/20", icon: "text-zff-green",   value: "text-zff-green" },
  gold:  { bg: "bg-yellow-50",   border: "border-yellow-200",  icon: "text-yellow-600", value: "text-yellow-600" },
  red:   { bg: "bg-red-50",      border: "border-red-200",     icon: "text-red-500",    value: "text-red-500" },
  blue:  { bg: "bg-blue-50",     border: "border-blue-200",    icon: "text-blue-600",   value: "text-blue-600" },
};

export function StatsCard({ title, value, subtitle, icon: Icon, trend, accentColor = "blue", delay = 0 }: StatsCardProps) {
  const accent = accentMap[accentColor];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card-hover p-6"
    >
      <div className="flex flex-col items-center sm:flex-row sm:items-start sm:justify-between mb-5">
        <div className={cn("p-3 rounded-xl border mb-3 sm:mb-0", accent.bg, accent.border)}>
          <Icon className={cn("w-5 h-5", accent.icon)} />
        </div>
        {trend !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
            trend >= 0
              ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
              : "text-red-600 bg-red-50 border border-red-200"
          )}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className={cn("text-3xl font-display tracking-wider mb-1.5 text-center sm:text-left", accent.value)}>{value}</p>
      <p className="text-sm font-semibold text-zff-black text-center sm:text-left">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1 text-center sm:text-left">{subtitle}</p>}
    </motion.div>
  );
}
