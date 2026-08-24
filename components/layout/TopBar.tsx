"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Zap, Menu, Radio, RefreshCw, Trophy, Crown, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "@/lib/sidebar-store";
import { createClient } from "@/lib/supabase/client";
import { cn, timeAgo } from "@/lib/utils";

interface TopBarProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
}

const NOTIF_CONFIG: Record<string, { icon: LucideIcon; bg: string; color: string }> = {
  match:    { icon: Radio,      bg: "bg-red-50",     color: "text-red-500" },
  goal:     { icon: Zap,        bg: "bg-blue-50",    color: "text-blue-500" },
  transfer: { icon: RefreshCw,  bg: "bg-teal-50",    color: "text-teal-500" },
  reward:   { icon: Trophy,     bg: "bg-amber-50",   color: "text-amber-500" },
  league:   { icon: Crown,      bg: "bg-purple-50",  color: "text-purple-500" },
  system:   { icon: Bell,       bg: "bg-slate-100",  color: "text-slate-500" },
  achievement: { icon: Star,    bg: "bg-yellow-50",  color: "text-yellow-500" },
};

interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
}

export function TopBar({ title, subtitle, rightContent }: TopBarProps) {
  const { toggle } = useSidebar();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [userXp, setUserXp] = useState<number | null>(null);
  const [userLevel, setUserLevel] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let userId: string | null = null;

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        userId = user.id;

        const [{ data: notifData }, { data: profile }] = await Promise.all([
          supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
          // xp/level, not fantasy_points — this badge shows on every page,
          // including ones with nothing to do with football fantasy, so it
          // needs the one stat that's meaningful regardless of sport or
          // game mode (same measure Dashboard and Groups already use).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from("profiles").select("xp, level").eq("id", user.id).single(),
        ]);
        if (notifData && notifData.length > 0) setNotifs(notifData);
        if (profile) { setUserXp(profile.xp ?? 0); setUserLevel(profile.level ?? 1); }
      } catch { /* keep defaults */ }
    }

    load();

    // Realtime — notifications appear and disappear instantly without refresh
    const channel = supabase
      .channel("topbar-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const n = payload.new as any;
          if (n.user_id === userId) {
            setNotifs((prev) => [n, ...prev].slice(0, 10));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const deleted = payload.old as any;
          setNotifs((prev) => prev.filter(n => n.id !== deleted.id));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    } catch { /* optimistic update already applied */ }
  }

  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 border-b border-slate-200
                 bg-white sticky top-0 z-20 min-h-[68px] gap-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={toggle}
          className="lg:hidden p-2 rounded-xl bg-slate-100 border border-slate-200
                     hover:border-zff-green/30 transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>

        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-zff-black leading-tight truncate">{title}</h1>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {rightContent}

        {/* Notification Bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="relative p-2.5 rounded-xl bg-slate-100 border border-slate-200
                       hover:border-zff-green/30 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4 text-slate-500" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-zff-green rounded-full ring-2 ring-white" />
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-[min(384px,calc(100vw-1rem))] bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                  <span className="font-bold text-zff-black text-sm flex items-center gap-2">
                    Notifications
                    {unread > 0 && (
                      <span className="text-xs bg-zff-green/10 text-zff-green px-1.5 py-0.5 rounded-full font-semibold">
                        {unread}
                      </span>
                    )}
                  </span>
                  {unread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-zff-green hover:text-zff-green-dark transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifs.map((n) => {
                    const cfg = NOTIF_CONFIG[n.type] ?? NOTIF_CONFIG.system;
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50",
                          !n.read && "bg-zff-green/[0.03]"
                        )}
                      >
                        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", cfg.bg)}>
                          <Icon className={cn("w-4 h-4", cfg.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              "text-sm font-semibold leading-tight",
                              !n.read ? "text-zff-black" : "text-slate-500"
                            )}>
                              {n.title}
                            </p>
                            {!n.read && <div className="w-2 h-2 rounded-full bg-zff-green mt-1 flex-shrink-0" />}
                          </div>
                          {n.body && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>}
                          <p className="text-[11px] text-slate-400 mt-1.5">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          className="flex items-center gap-2 px-3 py-2.5 border border-zff-green/20 rounded-xl"
          style={{ backgroundColor: "rgba(21,128,61,0.06)" }}
        >
          <Zap className="w-4 h-4 text-zff-green" />
          <span className="text-sm font-bold text-zff-green hidden sm:inline">
            {userLevel !== null && userXp !== null ? `Lvl ${userLevel} · ${userXp.toLocaleString()} XP` : "— XP"}
          </span>
        </div>
      </div>
    </motion.header>
  );
}
