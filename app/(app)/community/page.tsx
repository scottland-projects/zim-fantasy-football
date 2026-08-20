"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { MessageSquare, Send, BarChart2, Star, Flame, Trophy, Trash2 } from "lucide-react";
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


const emojis = ["🔥", "⚽", "💚", "💪", "👑", "🎯", "😂", "❤️", "✅", "🏆"];

export default function CommunityPage() {
  const [activeTab, setActiveTab] = useState<"chat" | "polls" | "discussions">("chat");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [pollData, setPollData] = useState<{ id: string; question: string; options: { label: string; votes: number }[]; totalVotes: number; voted: string | null }[]>([]);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const chatEnabled = useFeatureFlag("chat");
  const pollsEnabled = useFeatureFlag("polls");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch recent messages from Supabase and subscribe to realtime
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // Fetch historical messages asynchronously (separate from channel setup)
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

    // Fetch polls AND this user's existing votes in one sequence so voted state is set atomically
    async function fetchPolls() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const { data: { user } } = await supabase.auth.getUser();

        const [{ data: pollsData }, { data: votesData }] = await Promise.all([
          sb.from("polls")
            .select("id, question, options, votes")
            .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(6),
          user
            ? sb.from("poll_votes").select("poll_id, option").eq("user_id", user.id)
            : Promise.resolve({ data: [] }),
        ]);

        if (!mounted || !pollsData || pollsData.length === 0) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const myVotes: Record<string, string> = Object.fromEntries(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (votesData ?? []).map((v: any) => [v.poll_id, v.option])
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setPollData((pollsData as any[]).map((p: any) => {
          const rawOpts: (string | { label: string })[] = Array.isArray(p.options) ? p.options : [];
          const voteCounts: Record<string, number> = p.votes ?? {};
          const optsWithVotes = rawOpts.map((o) => {
            const label = typeof o === "string" ? o : o.label;
            return { label, votes: voteCounts[label] ?? 0 };
          });
          return {
            id: p.id,
            question: p.question,
            options: optsWithVotes,
            totalVotes: optsWithVotes.reduce((s: number, o: { votes: number }) => s + o.votes, 0),
            voted: myVotes[p.id] ?? null,
          };
        }));
      } catch { /* keep empty */ }
    }
    fetchPolls();

    // Set up realtime channel SYNCHRONOUSLY so .on() is always called before .subscribe()
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

  async function vote(pollId: string, option: string) {
    if (!pollsEnabled) return;
    // Optimistic update
    setPollData((prev) =>
      prev.map((p) => {
        if (p.id !== pollId || p.voted) return p;
        return {
          ...p,
          voted: option,
          options: p.options.map((o) => o.label === option ? { ...o, votes: o.votes + 1 } : o),
          totalVotes: p.totalVotes + 1,
        };
      })
    );
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).rpc("cast_poll_vote", { p_poll_id: pollId, p_option: option });
      if (data?.ok === false) {
        // Already voted server-side — revert optimistic update and restore real state
        setPollData((prev) =>
          prev.map((p) => {
            if (p.id !== pollId) return p;
            return {
              ...p,
              voted: data.choice ?? null,
              options: p.options.map((o) => o.label === option ? { ...o, votes: Math.max(0, o.votes - 1) } : o),
              totalVotes: Math.max(0, p.totalVotes - 1),
            };
          })
        );
      }
    } catch { /* optimistic update stands */ }
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Fan Community" subtitle="Join the conversation" />

      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex gap-2 mb-5 flex-wrap">
          {[
            { id: "chat",  label: "Matchday Chat", icon: MessageSquare },
            { id: "polls", label: "Fan Polls",      icon: BarChart2 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                "flex items-center gap-1.5 px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm font-medium border transition-all",
                activeTab === tab.id
                  ? "bg-zff-green/10 border-zff-green/30 text-zff-green"
                  : "border-slate-200 text-muted-foreground hover:border-zff-green/20 hover:text-zff-black"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "chat" && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
                        placeholder={chatEnabled ? "Cheer on your squad..." : "Chat is temporarily disabled"}
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
                    {["#MatchdayMagic", "#DreamXI", "#GoldenBoot", "#DerbyDay", "#CleanSheet"].map((tag) => (
                      <div key={tag} className="py-1.5">
                        <span className="text-sm text-zff-green font-medium hover:text-zff-green-light cursor-pointer">
                          {tag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "polls" && (
            <motion.div key="polls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {pollData.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center py-16 px-6 text-center">
                  <BarChart2 className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-zff-black mb-1">No active polls right now</p>
                  <p className="text-xs text-muted-foreground">Check back after the next matchday — admins post fan polls here.</p>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {pollData.map((poll) => (
                  <div key={poll.id} className="glass-card p-6">
                    <h3 className="font-bold text-zff-black mb-4">{poll.question}</h3>
                    <div className="space-y-3">
                      {poll.options.map((option) => {
                        const pct = Math.round((option.votes / poll.totalVotes) * 100);
                        const isWinning = option.votes === Math.max(...poll.options.map((o) => o.votes));
                        return (
                          <button
                            key={option.label}
                            onClick={() => vote(poll.id, option.label)}
                            disabled={!!poll.voted || !pollsEnabled}
                            className={cn(
                              "w-full text-left rounded-xl overflow-hidden border transition-all",
                              poll.voted === option.label
                                ? "border-zff-green/40 bg-zff-green/10"
                                : poll.voted
                                  ? "border-slate-200"
                                  : "border-slate-200 hover:border-zff-green/30"
                            )}
                          >
                            <div className="relative p-3">
                              {poll.voted && (
                                <div
                                  className={cn("absolute inset-0 opacity-20 rounded-xl", isWinning ? "bg-zff-green" : "bg-slate-100")}
                                  style={{ width: `${pct}%` }}
                                />
                              )}
                              <div className="relative flex items-center justify-between">
                                <span className={cn("text-sm font-medium", poll.voted === option.label ? "text-zff-green" : "text-zff-black")}>
                                  {isWinning && poll.voted && "🏆 "}{option.label}
                                </span>
                                {poll.voted && (
                                  <span className="text-xs font-bold text-zff-green">{pct}%</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">{poll.totalVotes} votes</p>
                  </div>
                ))}
              </div>
              )}
            </motion.div>
          )}

          {activeTab === "discussions" && (
            <motion.div key="disc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="glass-card p-10 flex flex-col items-center text-center">
                <Trophy className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm font-semibold text-zff-black mb-1">Discussions coming soon</p>
                <p className="text-xs text-muted-foreground">Use the Matchday Chat to talk with other fans right now.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
