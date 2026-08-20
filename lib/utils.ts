import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPoints(points: number): string {
  return points.toLocaleString();
}

export function formatPrice(price: number): string {
  return `$${(price / 1_000_000).toFixed(1)}M`;
}

export function getPositionColor(position: string): string {
  const colors: Record<string, string> = {
    GK: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    DEF: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    MID: "bg-zff-green/20 text-zff-green border-zff-green/30",
    FWD: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return colors[position] ?? "bg-gray-500/20 text-gray-400";
}

export function getRankBadge(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function getLevelTitle(level: number): string {
  const titles: Record<number, string> = {
    1: "Rookie Supporter",
    2: "Junior Fan",
    3: "Dedicated Fan",
    4: "Season Ticket Holder",
    5: "Die-Hard Supporter",
    6: "Legend",
    7: "Club Icon",
    8: "Fantasy Master",
    9: "Zim Football Immortal",
    10: "The Chosen One",
  };
  return titles[Math.min(level, 10)] ?? "Rookie Supporter";
}

export function getXPForNextLevel(level: number): number {
  return level * 1000;
}

export function generateInviteCode(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function getFormColor(form: number): string {
  if (form >= 8) return "text-zff-green";
  if (form >= 6) return "text-amber-400";
  if (form >= 4) return "text-orange-400";
  return "text-red-400";
}
