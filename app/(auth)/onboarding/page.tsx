"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, User, MapPin, Heart, FileText, Target } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const supporters = ["Harare Central Branch","Bulawayo Branch","Mutare Branch","Gweru Branch","Masvingo Branch","Diaspora Branch","Online Supporter"];
const SPORTS = [
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "cricket",  label: "Cricket",  emoji: "🏏" },
  { id: "rugby",    label: "Rugby",    emoji: "🏉" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name:"",supporter_branch:"",favorite_player:"",bio:"" });
  const [sports, setSports] = useState<string[]>(["football"]);

  function toggleSport(id: string) {
    setSports((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      return next.length === 0 ? prev : next; // always keep at least one selected
    });
  }

  // Steps adapt to what you actually follow — the favourite-player step
  // (football-specific) only shows up if football is one of your sports,
  // instead of every user being funnelled through a football-only flow.
  const steps = [
    { id: 0, title: "Which sports do you follow?", icon: Target },
    { id: 1, title: "Tell us about yourself", icon: User },
    { id: 2, title: "Your supporter branch", icon: MapPin },
    ...(sports.includes("football") ? [{ id: 3, title: "Favourite player", icon: Heart }] : []),
    { id: 4, title: "Your bio", icon: FileText },
  ];
  // No real player names anywhere in this app — every player is a jersey
  // number under a club. Pull a handful of real top scorers for this step
  // instead of a hardcoded name list (which previously listed real,
  // identifiable footballers by name).
  const [players, setPlayers] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    async function loadTopPlayers() {
      const supabase = createClient();
      const { data } = await supabase
        .from("players")
        .select("name, club")
        .order("total_points", { ascending: false })
        .limit(8);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data) setPlayers((data as any[]).map((p) => `${p.club} ${p.name}`));
    }
    loadTopPlayers();
  }, []);

  async function handleFinish() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Enumerate allowed fields explicitly — never spread user-controlled form data.
      // Never touch `username` here: the handle_new_user() trigger already
      // created the profile row with the username chosen at registration.
      // This previously upserted a fabricated username derived from the
      // account's auth email — for phone signups that's the internal
      // synthetic address (e.g. "263782809284@zff.internal"), so finishing
      // onboarding silently replaced a real user's chosen username with a
      // meaningless digit string.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("profiles").update({
        full_name:        form.full_name.slice(0, 100),
        supporter_branch: form.supporter_branch.slice(0, 60),
        favorite_player:  form.favorite_player.slice(0, 60),
        bio:              form.bio.slice(0, 300),
        interested_sports: sports,
      }).eq("id", user.id);
    }
    router.push("/dashboard");
  }
  const isLast = step === steps.length - 1;
  const currentStepId = steps[step]?.id;

  return (
    <motion.div initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} className="glass-card p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="mb-4">
          <Logo size={80} className="mx-auto" />
        </div>
        <h1 className="font-display text-2xl text-zff-black tracking-wider">SET UP YOUR PROFILE</h1>
        <p className="text-xs text-muted-foreground mt-1">Step {step+1} of {steps.length}</p>
      </div>
      <div className="flex gap-1.5 mb-8">
        {steps.map((_,i) => <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${i<=step?"bg-zff-green":"bg-slate-200"}`} />)}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ x:20,opacity:0 }} animate={{ x:0,opacity:1 }} exit={{ x:-20,opacity:0 }} className="space-y-4 min-h-[160px]">
          {currentStepId===0 && (
            <div>
              <label className="label">Pick all the sports you follow</label>
              <div className="grid grid-cols-3 gap-2">
                {SPORTS.map(s => (
                  <button key={s.id} onClick={() => toggleSport(s.id)}
                    className={`p-4 rounded-xl text-sm border transition-all flex flex-col items-center gap-1.5 ${sports.includes(s.id) ? "border-zff-green bg-zff-green/10 text-zff-green font-medium" : "border-slate-200 text-slate-600 hover:border-zff-green/30"}`}>
                    <span className="text-2xl">{s.emoji}</span>
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">You can predict matches and follow updates for all of these — pick as many as you like.</p>
            </div>
          )}
          {currentStepId===1 && <div><label className="label">Your Full Name</label><input type="text" value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})} placeholder="e.g. Tatenda Chirwa" className="input" /></div>}
          {currentStepId===2 && <div><label className="label">Your Supporter Branch</label><div className="grid grid-cols-2 gap-2">{supporters.map(b=><button key={b} onClick={()=>setForm({...form,supporter_branch:b})} className={`p-3 rounded-xl text-sm border transition-all text-left ${form.supporter_branch===b?"border-zff-green bg-zff-green/10 text-zff-green font-medium":"border-slate-200 text-slate-600 hover:border-zff-green/30"}`}>{b}</button>)}</div></div>}
          {currentStepId===3 && <div><label className="label">Pick Your Favourite Player</label><div className="grid grid-cols-2 gap-2">{players.map(p=><button key={p} onClick={()=>setForm({...form,favorite_player:p})} className={`p-3 rounded-xl text-sm border transition-all text-left ${form.favorite_player===p?"border-zff-green bg-zff-green/10 text-zff-green font-medium":"border-slate-200 text-slate-600 hover:border-zff-green/30"}`}>{p}</button>)}</div></div>}
          {currentStepId===4 && <div><label className="label">Tell the community about yourself</label><textarea value={form.bio} onChange={(e)=>setForm({...form,bio:e.target.value})} placeholder="e.g. Die-hard sports fan since 2005..." rows={4} className="input resize-none" /></div>}
        </motion.div>
      </AnimatePresence>
      <div className="flex gap-3 mt-8">
        {step>0 && <button onClick={()=>setStep(step-1)} className="btn-outline px-5 py-3">Back</button>}
        <button onClick={isLast?handleFinish:()=>setStep(step+1)} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2 py-3">
          {loading?"Setting up...":isLast?"Enter the League":<><span>Next</span><ChevronRight className="w-4 h-4" /></>}
        </button>
      </div>
    </motion.div>
  );
}