"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Trophy, ShoppingCart,
  Radio, MessageCircle, User, Settings, Shield,
  ChevronRight, LogOut, X, BarChart2, Target, Gamepad2, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/lib/sidebar-store";
import { createClient } from "@/lib/supabase/client";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";

interface SidebarProps {
  username?: string;
  level?: number;
  xp?: number;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  isManager?: boolean;
}

type NavFlag = "fantasyTeams" | "scorePredictions" | "chat" | "polls" | "liveScoring" | null;
interface NavItem { href: string; label: string; icon: LucideIcon; flag: NavFlag }

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard",    icon: LayoutDashboard, flag: null },
  { href: "/games",     label: "Games",         icon: Gamepad2,        flag: null },
  { href: "/my-team",   label: "My Team",       icon: Users,           flag: "fantasyTeams" },
  { href: "/market",    label: "Player Market", icon: ShoppingCart,    flag: "fantasyTeams" },
  { href: "/predictions", label: "Predictions", icon: Target,          flag: "scorePredictions" },
  { href: "/chat",      label: "Chat",          icon: MessageCircle,   flag: "chat" },
  { href: "/polls",     label: "Polls",         icon: BarChart2,       flag: "polls" },
  { href: "/leagues",   label: "Groups",        icon: Trophy,          flag: null },
  { href: "/live",      label: "Live Center",   icon: Zap,             flag: "liveScoring" },
  { href: "/profile",   label: "My Profile",    icon: User,            flag: null },
];

function SidebarContent({ username, level, xp, avatarUrl, isAdmin, isManager, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const fantasyTeamsEnabled = useFeatureFlag("fantasyTeams");
  const scorePredictionsEnabled = useFeatureFlag("scorePredictions");
  const chatEnabled = useFeatureFlag("chat");
  const pollsEnabled = useFeatureFlag("polls");
  const liveScoringEnabled = useFeatureFlag("liveScoring");
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.flag === "fantasyTeams") return fantasyTeamsEnabled;
    if (item.flag === "scorePredictions") return scorePredictionsEnabled;
    if (item.flag === "chat") return chatEnabled;
    if (item.flag === "polls") return pollsEnabled;
    if (item.flag === "liveScoring") return liveScoringEnabled;
    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-20 px-6 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={44} className="shrink-0" />
          <div>
            <p className="font-display text-lg text-zff-black tracking-wider leading-none">AFRICA</p>
            <p className="text-[10px] text-zff-green font-semibold tracking-widest mt-0.5">FANTASY</p>
          </div>
        </div>
        {/* Close button — mobile only */}
        {onNavigate && (
          <button onClick={onNavigate}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto space-y-1">
        <p className="text-[10px] font-bold text-slate-400 px-4 py-2 uppercase tracking-widest">
          Main Menu
        </p>
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate}
              className={cn("sidebar-link group", isActive && "sidebar-link-active")}>
              <item.icon className={cn("w-4 h-4 shrink-0", isActive && "text-zff-green")} />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 text-zff-green opacity-60" />}
            </Link>
          );
        })}

        <div className="pt-6">
          <p className="text-[10px] font-bold text-slate-400 px-4 py-2 uppercase tracking-widest">
            System
          </p>
          {[{ href: "/settings", label: "Settings", icon: Settings }]
            .concat(isManager && !isAdmin ? [{ href: "/manager", label: "Manager Panel", icon: Radio }] : [])
            .concat(isAdmin ? [{ href: "/manager", label: "Manager Panel", icon: Radio }, { href: "/admin", label: "Admin Panel", icon: Shield }] : [])
            .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={onNavigate}
                  className={cn("sidebar-link", isActive && "sidebar-link-active")}>
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </div>
      </nav>

      {/* Sign out */}
      <div className="p-4 border-t border-slate-200">
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = "/";
          }}
          className="sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="px-6 pb-5 text-center">
        <p className="text-[10px] text-slate-400 font-mono">Africa Fantasy • Zimbabwe 🇿🇼</p>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  const { open, close } = useSidebar();

  return (
    <>
      {/* ── Desktop: always-visible fixed sidebar ── */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200 z-30"
      >
        <SidebarContent {...props} />
      </motion.aside>

      {/* ── Mobile: overlay drawer ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={close}
              className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 h-screen w-72 bg-white border-r border-slate-200 z-50 flex flex-col"
            >
              <SidebarContent {...props} onNavigate={close} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
