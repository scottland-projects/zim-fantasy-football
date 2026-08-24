"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { MessageSquare, Send, BarChart2, Star, Flame, Trophy, Trash2, Plus, Lock, X } from "lucide-react";
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

function CommunityPageContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"chat" | "polls" | "discussions">(
    initialTab === "polls" || initialTab === "discussions" ? initialTab : "chat"
  );
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [pollData, setPollData] = useState<{ id: string; question: string; options: { label: string; votes: number }[]; totalVotes: number; voted: string | null; groupName: string | null }[]>([]);
  const [myGroups, setMyGroups] = useState<{ id: string; name: string }[]>([]);
  const [createPollOpen, setCreatePollOpen] = useState(false);
  const [pollForm, setPollForm] = useState<{ leagueId: string; question: string; options: string[] }>({ leagueId: "", question: "", options: ["", ""] });
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [pollFormError, setPollFormError] = useState("");
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const chatEnabled = useFeatureFlag("chat");
  const pollsEnabled = useFeatureFlag("polls");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // The Chat/Polls sidebar links both point at this same route with
  // different ?tab= values, so navigating between them is a client-side
  // transition that reuses this component instance rather than remounting
  // it — the useState initializer above only runs once, on first mount, so
  // without this the tab silently stays wherever it was set on the first
  // visit no matter which link is clicked afterward.
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "chat" || tab === "polls" || tab === "discussions") setActiveTab(tab);
  }, [searchParams]);

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

        const [{ data: pollsData }, { data: votesData }, { data: membershipRows }] = await Promise.all([
          sb.from("polls")
            .select("id, question, options, votes, league_id")
            .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(12),
          user
            ? sb.from("poll_votes").select("poll_id, option").eq("user_id", user.id)
            : Promise.resolve({ data: [] }),
          user
            ? sb.from("league_members").select("league_id, leagues(id, name)").eq("user_id", user.id)
            : Promise.resolve({ data: [] }),
        ]);

        if (mounted) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setMyGroups((membershipRows ?? []).map((m: any) => m.leagues).filter(Boolean));
        }

        if (!mounted || !pollsData || pollsData.length === 0) return;

        const myVotes: Record<string, string> = Object.fromEntries(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (votesData ?? []).map((v: any) => [v.poll_id, v.option])
        );
        const groupNameById: Record<string, string> = Object.fromEntries(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (membershipRows ?? []).map((m: any) => [m.league_id, m.leagues?.name]).filter(([, n]: [string, string]) => n)
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
            groupName: p.league_id ? (groupNameById[p.league_id] ?? "Private Group") : null,
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

  async function createPoll() {
    const options = pollForm.options.map(o => o.trim()).filter(Boolean);
    if (!pollForm.leagueId) { setPollFormError("Pick a group first"); return; }
    if (!pollForm.question.trim()) { setPollFormError("Enter a question"); return; }
    if (options.length < 2) { setPollFormError("Add at least 2 options"); return; }
    setPollFormError("");
    setCreatingPoll(true);
    try {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).rpc("create_group_poll", {
        p_league_id: pollForm.leagueId, p_question: pollForm.question.trim(), p_options: options,
      });
      if (data?.ok) {
        setCreatePollOpen(false);
        setPollForm({ leagueId: "", question: "", options: ["", ""] });
        const groupName = myGroups.find(g => g.id === pollForm.leagueId)?.name ?? "Private Group";
        setPollData(prev => [{
          id: data.poll_id, question: pollForm.question.trim(),
          options: options.map(label => ({ label, votes: 0 })),
          totalVotes: 0, voted: null, groupName,
        }, ...prev]);
      } else {
        setPollFormError(data?.error ?? "Couldn't create poll — try again");
      }
    } catch { setPollFormError("Couldn't create poll — try again"); }
    finally { setCreatingPoll(false); }
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
            </motion.div>
          )}

          {activeTab === "polls" && (
            <motion.div key="polls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">Admin polls plus polls from your private groups</p>
                {myGroups.length > 0 && (
                  <button onClick={() => { setPollForm(p => ({ ...p, leagueId: myGroups[0].id })); setCreatePollOpen(true); }}
                    className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0">
                    <Plus className="w-3.5 h-3.5" /> Create Group Poll
                  </button>
                )}
              </div>

              <AnimatePresence>
                {createPollOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="glass-card p-5 mb-5 overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-zff-black text-sm">New Group Poll</h3>
                      <button onClick={() => setCreatePollOpen(false)} className="text-muted-foreground hover:text-zff-black"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Group</label>
                        <select value={pollForm.leagueId} onChange={e => setPollForm(p => ({ ...p, leagueId: e.target.value }))} className="input text-sm py-2">
                          {myGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Question</label>
                        <input value={pollForm.question} onChange={e => setPollForm(p => ({ ...p, question: e.target.value }))} placeholder="Who wins tonight?" maxLength={200} className="input text-sm py-2" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground block">Options</label>
                        {pollForm.options.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input value={opt} maxLength={60} onChange={e => setPollForm(p => ({ ...p, options: p.options.map((o, oi) => oi === i ? e.target.value : o) }))}
                              placeholder={`Option ${i + 1}`} className="input text-sm py-2 flex-1" />
                            {pollForm.options.length > 2 && (
                              <button onClick={() => setPollForm(p => ({ ...p, options: p.options.filter((_, oi) => oi !== i) }))} className="text-muted-foreground hover:text-red-500 p-1">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {pollForm.options.length < 6 && (
                          <button onClick={() => setPollForm(p => ({ ...p, options: [...p.options, ""] }))} className="text-xs text-zff-green font-semibold hover:underline">
                            + Add option
                          </button>
                        )}
                      </div>
                      {pollFormError && <p className="text-xs text-red-600">{pollFormError}</p>}
                      <button onClick={createPoll} disabled={creatingPoll} className="btn-primary w-full text-sm py-2.5 disabled:opacity-60">
                        {creatingPoll ? "Creating…" : "Create Poll"}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {pollData.length === 0 ? (
                <div className="glass-card flex flex-col items-center justify-center py-16 px-6 text-center">
                  <BarChart2 className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-zff-black mb-1">No active polls right now</p>
                  <p className="text-xs text-muted-foreground">
                    {myGroups.length > 0 ? "Check back after the next matchday, or start one in your group." : "Check back after the next matchday — admins post fan polls here."}
                  </p>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {pollData.map((poll) => (
                  <div key={poll.id} className="glass-card p-6">
                    {poll.groupName && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zff-green bg-zff-green/10 border border-zff-green/20 rounded-full px-2 py-0.5 mb-3">
                        <Lock className="w-2.5 h-2.5" /> {poll.groupName}
                      </span>
                    )}
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

export default function CommunityPage() {
  return (
    <Suspense fallback={null}>
      <CommunityPageContent />
    </Suspense>
  );
}
