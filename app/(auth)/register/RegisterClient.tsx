"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, User, ArrowRight, HelpCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { usernameSignUpAction } from "@/lib/actions/auth";
import { RECOVERY_QUESTIONS } from "@/lib/recoveryQuestions";

export default function RegisterClient() {
  const [loading, setLoading] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "", password: "", full_name: "",
    q1: RECOVERY_QUESTIONS[0], a1: "",
    q2: RECOVERY_QUESTIONS[1], a2: "",
  });
  const router = useRouter();

  // No email or phone collected — accounts are pre-confirmed via a
  // synthetic internal address (see usernameSignUpAction), so there's no
  // "check your inbox" step and nothing to hit Supabase's email-send rate
  // limit. Two required security questions replace email-based "Forgot
  // Password" recovery, since there's no real address to send a link to.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setSlowLoading(false); setError(null);
    // Account creation can genuinely take several seconds (password hashing,
    // rate-limit checks) — reassure rather than let a static button read as hung.
    const slowTimer = setTimeout(() => setSlowLoading(true), 3000);

    if (form.q1 === form.q2) {
      setError("Pick two different security questions.");
      setLoading(false); clearTimeout(slowTimer); setSlowLoading(false);
      return;
    }

    const result = await usernameSignUpAction(
      form.username.trim(), form.password, form.full_name.slice(0, 100),
      form.q1, form.a1, form.q2, form.a2
    );
    if (result.error) { setError(result.error); setLoading(false); clearTimeout(slowTimer); setSlowLoading(false); return; }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: result.email!, password: form.password });
    setLoading(false); clearTimeout(slowTimer); setSlowLoading(false);
    if (signInError) { setError("Account created — please sign in."); router.push("/login"); return; }
    router.push("/privacy?from=onboarding");
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="mb-4">
          <Logo size={96} className="mx-auto" />
        </div>
        <h1 className="font-display text-3xl text-zff-black tracking-wider">JOIN THE GAME</h1>
        <p className="text-sm text-muted-foreground mt-1">Create your Africa Fantasy account</p>
      </div>
      {error && <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">Full Name</label>
          <div className="relative"><User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Tendai Moyo" required className="input pl-10" /></div>
        </div>
        <div>
          <label className="label">Username</label>
          <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span><input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="tinashe_23" required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" title="Letters, numbers, and underscores only" className="input pl-8" /></div>
        </div>
        <div>
          <label className="label">Password</label>
          <div className="relative"><Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" required minLength={8} className="input pl-10" /></div>
        </div>

        <div className="pt-1 border-t border-slate-100">
          <p className="text-xs font-semibold text-zff-black mt-4 mb-3 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-zff-green" /> Security Questions
            <span className="text-muted-foreground font-normal">— used to recover your account if you forget your password</span>
          </p>
          <div className="space-y-3">
            <div>
              <select value={form.q1} onChange={(e) => setForm({ ...form, q1: e.target.value })} className="input text-sm">
                {RECOVERY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
              <input type="text" value={form.a1} onChange={(e) => setForm({ ...form, a1: e.target.value })} placeholder="Your answer" required maxLength={100} className="input mt-2 text-sm" />
            </div>
            <div>
              <select value={form.q2} onChange={(e) => setForm({ ...form, q2: e.target.value })} className="input text-sm">
                {RECOVERY_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
              <input type="text" value={form.a2} onChange={(e) => setForm({ ...form, a2: e.target.value })} placeholder="Your answer" required maxLength={100} className="input mt-2 text-sm" />
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          By creating an account you agree to the{" "}
          <Link href="/terms" target="_blank" className="text-zff-green hover:underline font-medium">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" target="_blank" className="text-zff-green hover:underline font-medium">Privacy Policy</Link>
          {" "}of OMNI Global.
        </p>
        {slowLoading && (
          <p className="text-xs text-center text-muted-foreground">Still working — this can take a few seconds…</p>
        )}
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
          {loading ? "Creating account..." : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-8">Already have an account?{" "}<Link href="/login" className="text-zff-green hover:text-zff-green-dark font-semibold">Sign in</Link></p>
    </motion.div>
  );
}
