"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Always show the same success state, whether or not the account exists —
    // confirming/denying an email's existence here would leak account data.
    if (error && !error.message.toLowerCase().includes("rate limit")) {
      setError("Something went wrong. Please try again.");
      return;
    }
    if (error) {
      setError("Too many requests — please wait a moment and try again.");
      return;
    }
    setSent(true);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="mb-4">
          <Logo size={96} className="mx-auto" />
        </div>
        <h1 className="font-display text-3xl text-zff-black tracking-wider">RESET PASSWORD</h1>
        <p className="text-sm text-muted-foreground mt-1">We&apos;ll email you a link to choose a new one</p>
      </div>

      {sent ? (
        <div className="text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-zff-green/10 border border-zff-green/20 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-zff-green" />
          </div>
          <p className="text-sm text-slate-600">
            If an account exists for <span className="font-semibold text-zff-black">{email}</span>, a password reset link is on its way. Check your inbox (and spam folder).
          </p>
          <Link href="/login" className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      ) : (
        <>
          {error && <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="input pl-10"
                />
              </div>
            </div>
            <button type="submit" disabled={loading || !email.trim()} className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-60">
              {loading ? "Sending..." : <><span>Send reset link</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-8">
            <Link href="/login" className="text-zff-green hover:text-zff-green-dark font-semibold inline-flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
            </Link>
          </p>
        </>
      )}
    </motion.div>
  );
}
