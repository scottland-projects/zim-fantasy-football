"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, Check, Trophy, Zap, Radio, RefreshCw, Gift } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

const mockNotifications = [
  { id: "1", type: "goal", title: "Khama Billiat scored! ⚽", body: "Your captain just bagged a brace. +12 pts!", read: false, created_at: new Date(Date.now() - 120000).toISOString() },
  { id: "2", type: "league", title: "You climbed to #247!", body: "Great performance this matchday.", read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: "3", type: "reward", title: "Achievement Unlocked! 🏆", body: "You earned 'Transfer Master' badge!", read: false, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: "4", type: "match", title: "MD12 starts in 2 hours", body: "Harare Rangers vs Bulawayo Barons. Check your team!", read: true, created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: "5", type: "transfer", title: "Transfer deadline soon", body: "Transfer window closes in 24 hours!", read: true, created_at: new Date(Date.now() - 259200000).toISOString() },
];

const typeIcons: Record<string, { icon: typeof Bell; color: string }> = {
  goal: { icon: Zap, color: "text-zff-green" },
  league: { icon: Trophy, color: "text-yellow-400" },
  reward: { icon: Gift, color: "text-purple-400" },
  match: { icon: Radio, color: "text-red-400" },
  transfer: { icon: RefreshCw, color: "text-blue-400" },
  system: { icon: Bell, color: "text-muted-foreground" },
};

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState(mockNotifications);

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function dismiss(id: string) {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  const unread = notifications.filter(n => !n.read).length;

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-16 right-6 z-50 w-96 glass-card shadow-glass overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-zff-green" />
                <span className="font-bold text-zff-black text-sm">Notifications</span>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-zff-green text-zff-black text-xs font-bold">{unread}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-xs text-zff-green hover:text-zff-green-light flex items-center gap-1">
                    <Check className="w-3 h-3" /> Mark all read
                  </button>
                )}
                <button onClick={onClose} className="text-muted-foreground hover:text-zff-black">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const { icon: Icon, color } = typeIcons[notif.type] ?? typeIcons.system;
                  return (
                    <div
                      key={notif.id}
                      className={cn(
                        "flex items-start gap-3 p-4 border-b border-slate-200 last:border-0 group",
                        !notif.read && "bg-zff-green/5"
                      )}
                    >
                      <div className={cn("p-2 rounded-xl bg-slate-100/50 flex-shrink-0", !notif.read && "bg-zff-green/10")}>
                        <Icon className={cn("w-4 h-4", color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-sm font-semibold leading-tight", !notif.read ? "text-zff-black" : "text-muted-foreground")}>
                            {notif.title}
                          </p>
                          {!notif.read && <div className="w-2 h-2 rounded-full bg-zff-green mt-1 flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{notif.body}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(notif.created_at)}</p>
                      </div>
                      <button
                        onClick={() => dismiss(notif.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-zff-black"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
