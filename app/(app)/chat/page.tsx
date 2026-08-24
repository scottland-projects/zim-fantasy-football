"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { Send, Star, Trash2 } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessageAction, deleteChatMessageAction, reactToMessageAction } from "@/lib/actions/chat";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";

interface ChatMsg {
  id: string;
  username: string;
  avatar: string;
  message: string;
  time: string;
  reactions: Record<string, number>;
  isOwn?: boolean;
}

const emojis = ["🔥", "⚽", "🏏", "🏉", "💪", "👑", "🎯", "😂", "❤️", "🏆"];

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const chatEnabled = useFeatureFlag("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function fetchHistory() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("chat_messages")
          .select("id, message, created_at, user_id, reactions, profiles(username)")
          .order("created_at", { ascending: false })
          .limit(50);

        if (!mounted || !data || data.length === 0) return;
        const { data: { user } } = await supabase.auth.getUser();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const formatted: ChatMsg[] = (data as any[]).reverse().map((m: any) => {
          const uname: string = m.profiles?.username ?? "Fan";
          return {
            id: m.id as string,
            username: uname,
            avatar: uname[0].toUpperCase(),
            message: m.message as string,
            time: m.created_at as string,
            reactions: (m.reactions ?? {}) as Record<string, number>,
            isOwn: user ? m.user_id === user.id : false,
          };
        });
        if (mounted) setMessages(formatted);
      } catch { /* keep mock */ }
    }
    fetchHistory();

    const channel = supabase
      .channel(`chat_realtime_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          if (!mounted) return;
          const row = payload.new as { id: string; user_id: string; message: string; created_at: string };
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: profile } = await (supabase as any)
              .from("profiles")
              .select("username")
              .eq("id", row.user_id)
              .single();
            const { data: { user } } = await supabase.auth.getUser();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const uname: string = (profile as any)?.username ?? "Fan";
            if (!mounted) return;
            setMessages((prev) => {
              if (prev.some((m) => m.id === row.id)) return prev;
              return [...prev, {
                id: row.id,
                username: uname,
                avatar: uname[0].toUpperCase(),
                message: row.message,
                time: row.created_at,
                reactions: {},
                isOwn: user ? row.user_id === user.id : false,
              }];
            });
          } catch { /* skip */ }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const sendMessage = useCallback(async () => {
    if (!message.trim() || sending || !chatEnabled) return;
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const newMsg: ChatMsg = {
      id: tempId,
      username: "YourTeam",
      avatar: "Y",
      message: message.trim(),
      time: new Date().toISOString(),
      reactions: {},
      isOwn: true,
    };
    setMessages((prev) => [...prev, newMsg]);
    setMessage("");

    try {
      await sendChatMessageAction(newMsg.message);
    } catch { /* optimistic message stays visible */ }
    finally {
      setSending(false);
    }
  }, [message, sending, chatEnabled]);

  async function deleteMessage(msgId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    try {
      await deleteChatMessageAction(msgId);
    } catch { /* optimistic removal already done */ }
  }

  async function addReaction(msgId: string, emoji: string) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const reactions = { ...m.reactions };
        reactions[emoji] = (reactions[emoji] ?? 0) + 1;
        return { ...m, reactions };
      })
    );
    setReactingTo(null);
    try {
      await reactToMessageAction(msgId, emoji);
    } catch { /* optimistic update already applied */ }
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Matchday Chat" subtitle="Cheer on your team with fans across Zimbabwe" />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div
            className="col-span-1 lg:col-span-3 glass-card overflow-hidden flex flex-col"
            style={{ height: "min(600px, calc(100vh - 220px))" }}
          >
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-zff-green animate-pulse" />
              <span className="text-sm font-semibold text-zff-black">Global Matchday Chat</span>
              <span className="ml-auto text-xs text-muted-foreground">{messages.length} messages</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex gap-3", msg.isOwn && "flex-row-reverse")}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 border",
                    msg.isOwn
                      ? "bg-zff-green/20 border-zff-green/30 text-zff-green"
                      : "bg-slate-100 border-slate-200 text-zff-black"
                  )}>
                    {msg.avatar}
                  </div>
                  <div className={cn("max-w-xs", msg.isOwn && "items-end flex flex-col")}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-xs font-semibold",
                        msg.isOwn ? "text-zff-green" : "text-zff-black"
                      )}>
                        {msg.isOwn ? "You" : msg.username}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{timeAgo(msg.time)}</span>
                    </div>
                    <div className="relative group/msg">
                      <div className={cn(
                        "px-3 py-2 rounded-xl text-sm border",
                        msg.isOwn
                          ? "bg-zff-green/10 border-zff-green/20 text-zff-black"
                          : "bg-slate-100/30 border-slate-200 text-zff-black"
                      )}>
                        {msg.message}
                      </div>
                      {msg.isOwn && (
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full items-center justify-center hidden group-hover/msg:flex transition-colors shadow-sm"
                          title="Delete message"
                        >
                          <Trash2 className="w-2.5 h-2.5 text-white" />
                        </button>
                      )}
                    </div>

                    {Object.keys(msg.reactions).length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {Object.entries(msg.reactions).map(([emoji, count]) => (
                          <button
                            key={emoji}
                            onClick={() => addReaction(msg.id, emoji)}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-slate-100/40 border border-slate-200 text-xs hover:border-zff-green/30 transition-colors"
                          >
                            {emoji} <span className="text-muted-foreground">{count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}
                      className="text-[10px] text-muted-foreground hover:text-zff-black mt-1 transition-colors"
                    >
                      React
                    </button>

                    <AnimatePresence>
                      {reactingTo === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="flex gap-1 mt-1 p-2 rounded-xl bg-white border border-slate-200"
                        >
                          {emojis.map((e) => (
                            <button
                              key={e}
                              onClick={() => addReaction(msg.id, e)}
                              className="text-lg hover:scale-125 transition-transform"
                            >
                              {e}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-5 border-t border-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {emojis.slice(0, 5).map((e) => (
                    <button
                      key={e}
                      onClick={() => setMessage((m) => m + e)}
                      className="text-lg hover:scale-110 transition-transform"
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={chatEnabled ? "Cheer on your team..." : "Chat is temporarily disabled"}
                  maxLength={200}
                  disabled={!chatEnabled}
                  className="flex-1 px-4 py-2.5 bg-slate-100/50 border border-slate-200 rounded-xl text-zff-black placeholder:text-muted-foreground focus:outline-none focus:border-zff-green/50 text-sm disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !message.trim() || !chatEnabled}
                  className="btn-primary p-2.5 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="glass-card p-4">
              <h3 className="font-bold text-zff-black text-sm mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" /> Top Contributors
              </h3>
              {messages.reduce((acc: { username: string; count: number }[], m) => {
                const ex = acc.find(a => a.username === m.username);
                if (ex) ex.count++; else acc.push({ username: m.username, count: 1 });
                return acc;
              }, []).sort((a,b) => b.count - a.count).map((u, i) => (
                <div key={u.username} className="flex items-center gap-2 py-2">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 text-zff-black text-xs font-bold flex items-center justify-center">{i + 1}</div>
                  <span className="text-sm text-zff-black">{u.username}</span>
                  <span className="ml-auto text-xs text-zff-green">{u.count} msgs</span>
                </div>
              ))}
              {messages.length === 0 && <p className="text-xs text-muted-foreground py-2">No messages yet</p>}
            </div>

            <div className="glass-card p-4">
              <h3 className="font-bold text-zff-black text-sm mb-3">Trending Topics</h3>
              {["#MatchdayMagic", "#PredictionKing", "#DerbyDay", "#UpsetAlert", "#Zimbabwe"].map((tag) => (
                <div key={tag} className="py-1.5">
                  <span className="text-sm text-zff-green font-medium hover:text-zff-green-light cursor-pointer">
                    {tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
