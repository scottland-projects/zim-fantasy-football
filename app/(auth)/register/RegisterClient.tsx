"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, User, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { usernameSignUpAction } from "@/lib/actions/auth";

export default function RegisterClient() {
  const [loading, setLoading] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ username: "", password: "", full_name: "" });
  const router = useRouter();

  // No email or phone collected — accounts are pre-confirmed via a
  // synthetic internal address (see usernameSignUpAction), so there's no
  // "check your inbox" step and nothing to hit Supabase's email-send rate
  // limit. Tradeoff: no "Forgot Password" recovery path for these accounts
  // short of an admin resetting it from the Admin panel.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setSlowLoading(false); setError(null);
    // Account creation can genuinely take several seconds (password hashing,
    // rate-limit checks) — reassure rather than let a static button read as hung.
    const slowTimer = setTimeout(() => setSlowLoading(true), 3000);

    const result = await usernameSignUpAction(form.username.trim(), form.password, form.full_name.slice(0, 100));
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
