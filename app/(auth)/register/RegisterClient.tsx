"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Lock, User, Phone, ArrowRight, CheckCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { phoneSignUpAction } from "@/lib/actions/auth";

function syntheticEmail(phone: string): string {
  return `${phone.replace(/\D/g, "")}@zff.internal`;
}

export default function RegisterClient() {
  const [loading, setLoading] = useState(false);
  const [slowLoading, setSlowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmEmailSent, setConfirmEmailSent] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", username: "", full_name: "", phone: "" });
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setSlowLoading(false); setError(null); setNotice(null);
    // Account creation can genuinely take several seconds (password hashing,
    // rate-limit checks) — reassure rather than let a static button read as hung.
    const slowTimer = setTimeout(() => setSlowLoading(true), 3000);

    if (!form.email && !form.phone) {
      setError("Please provide an email address or phone number.");
      setLoading(false); clearTimeout(slowTimer); setSlowLoading(false);
      return;
    }

    const supabase = createClient();
    const userMeta = { username: form.username.slice(0, 30), full_name: form.full_name.slice(0, 100), phone: form.phone.slice(0, 20) };

    // Phone-only signups use a synthetic email that can never receive a
    // confirmation link, so the account is created pre-confirmed server-side
    // and then signed in directly — no email confirmation step is possible
    // or needed for it.
    if (!form.email && form.phone) {
      const authEmail = syntheticEmail(form.phone);
      const result = await phoneSignUpAction(authEmail, form.password, userMeta.username, userMeta.full_name, userMeta.phone);
      if (result.error) { setError(result.error); setLoading(false); clearTimeout(slowTimer); setSlowLoading(false); return; }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: authEmail, password: form.password });
      setLoading(false); clearTimeout(slowTimer); setSlowLoading(false);
      if (signInError) { setError("Account created — please sign in."); router.push("/login"); return; }
      router.push("/privacy?from=onboarding");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: userMeta },
    });
    setLoading(false); clearTimeout(slowTimer); setSlowLoading(false);
    if (error) {
      const msg =
        error.status === 429
          ? "Too many sign-ups right now — please wait a few minutes and try again."
          : error.message.toLowerCase().includes("password")
            ? "Password must be at least 8 characters."
            : "Unable to create account. Please try again.";
      setError(msg);
      return;
    }
    if (!data.user?.identities || data.user.identities.length === 0) {
      setNotice("An account with these details already exists.");
      return;
    }
    if (!data.session) {
      // Email confirmation required before this account can sign in.
      setConfirmEmailSent(form.email);
      return;
    }
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
      {confirmEmailSent ? (
        <div className="text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-zff-green/10 border border-zff-green/20 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-zff-green" />
          </div>
          <p className="text-sm text-slate-600">
            We&apos;ve sent a confirmation link to <span className="font-semibold text-zff-black">{confirmEmailSent}</span>. Click it to activate your account, then sign in.
          </p>
          <Link href="/login" className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            Go to sign in
          </Link>
        </div>
      ) : (
      <>
      {error  && <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
      {notice && (
        <div className="mb-5 p-3.5 rounded-xl bg-zff-green/5 border border-zff-green/20 text-zff-black text-sm">
          {notice}{" "}
          <Link href="/login" className="text-zff-green font-semibold hover:underline">Sign in instead →</Link>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name</label>
            <div className="relative"><User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Tendai Moyo" required className="input pl-10" /></div>
          </div>
          <div>
            <label className="label">Username</label>
            <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">@</span><input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="tinashe_23" required className="input pl-8" /></div>
          </div>
        </div>
        <div>
          <label className="label">Email <span className="text-muted-foreground font-normal">(optional if phone provided)</span></label>
          <div className="relative"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="manager@example.co.zw" className="input pl-10" /></div>
        </div>
        <div>
          <label className="label">Phone Number <span className="text-muted-foreground font-normal">(optional if email provided)</span></label>
          <div className="relative"><Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+263 77 123 4567" className="input pl-10" /></div>
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
      </>
      )}
    </motion.div>
  );
}
