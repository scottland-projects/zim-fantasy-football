"use client";
export const dynamic = "force-dynamic";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, User, MapPin, Heart, FileText } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const supporters = ["Harare Central Branch","Bulawayo Branch","Mutare Branch","Gweru Branch","Masvingo Branch","Diaspora Branch","Online Supporter"];
const players = ["Khama Billiat","Leonard Sengwe","Tino Kadewere","Prince Dube","Ovidy Karuru","Knowledge Musona","Denver Mukamba","Shingirai Musendo"];
const steps = [{ id:1,title:"Tell us about yourself",icon:User},{id:2,title:"Your supporter branch",icon:MapPin},{id:3,title:"Favourite player",icon:Heart},{id:4,title:"Your bio",icon:FileText}];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name:"",supporter_branch:"",favorite_player:"",bio:"" });
  const router = useRouter();

  async function handleFinish() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Enumerate allowed fields explicitly — never spread user-controlled form data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("profiles").upsert({
        id:               user.id,
        username:         (user.email?.split("@")[0] ?? "fan").slice(0, 30).replace(/[^a-z0-9_]/gi, "_"),
        full_name:        form.full_name.slice(0, 100),
        supporter_branch: form.supporter_branch.slice(0, 60),
        favorite_player:  form.favorite_player.slice(0, 60),
        bio:              form.bio.slice(0, 300),
      }, { onConflict: "id" });
    }
    router.push("/dashboard");
  }
  const isLast = step === steps.length - 1;

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
          {step===0 && <div><label className="label">Your Full Name</label><input type="text" value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})} placeholder="e.g. Tatenda Chirwa" className="input" /></div>}
          {step===1 && <div><label className="label">Your Supporter Branch</label><div className="grid grid-cols-2 gap-2">{supporters.map(b=><button key={b} onClick={()=>setForm({...form,supporter_branch:b})} className={`p-3 rounded-xl text-sm border transition-all text-left ${form.supporter_branch===b?"border-zff-green bg-zff-green/10 text-zff-green font-medium":"border-slate-200 text-slate-600 hover:border-zff-green/30"}`}>{b}</button>)}</div></div>}
          {step===2 && <div><label className="label">Pick Your Favourite Player</label><div className="grid grid-cols-2 gap-2">{players.map(p=><button key={p} onClick={()=>setForm({...form,favorite_player:p})} className={`p-3 rounded-xl text-sm border transition-all text-left ${form.favorite_player===p?"border-zff-green bg-zff-green/10 text-zff-green font-medium":"border-slate-200 text-slate-600 hover:border-zff-green/30"}`}>{p}</button>)}</div></div>}
          {step===3 && <div><label className="label">Tell the community about yourself</label><textarea value={form.bio} onChange={(e)=>setForm({...form,bio:e.target.value})} placeholder="e.g. Die-hard football fan since 2005..." rows={4} className="input resize-none" /></div>}
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