"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/layout/TopBar";
import { BarChart2, Plus, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useFeatureFlag } from "@/lib/hooks/useFeatureFlag";

export default function PollsPage() {
  const [pollData, setPollData] = useState<{ id: string; question: string; options: { label: string; votes: number }[]; totalVotes: number; voted: string | null; groupName: string | null }[]>([]);
  const [myGroups, setMyGroups] = useState<{ id: string; name: string }[]>([]);
  const [createPollOpen, setCreatePollOpen] = useState(false);
  const [pollForm, setPollForm] = useState<{ leagueId: string; question: string; options: string[] }>({ leagueId: "", question: "", options: ["", ""] });
  const [creatingPoll, setCreatingPoll] = useState(false);
  const [pollFormError, setPollFormError] = useState("");
  const pollsEnabled = useFeatureFlag("polls");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

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
      } catch { /* keep empty */
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchPolls();

    return () => { mounted = false; };
  }, []);

  async function vote(pollId: string, option: string) {
    if (!pollsEnabled) return;
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
      <TopBar title="Fan Polls" subtitle="Vote on admin polls, or create your own for a group" />

      <div className="p-4 sm:p-6 lg:p-8">
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

        {loading ? (
          <div className="glass-card flex flex-col items-center justify-center py-16 px-6 text-center">
            <p className="text-sm text-muted-foreground">Loading polls…</p>
          </div>
        ) : pollData.length === 0 ? (
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
      </div>
    </div>
  );
}
