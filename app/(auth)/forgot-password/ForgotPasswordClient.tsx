"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { User, Lock, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { useRouter } from "next/navigation";
import { getRecoveryQuestionsAction, recoverAccountAction } from "@/lib/actions/auth";

export default function ForgotPasswordClient() {
  const [username, setUsername] = useState("");
  const [questions, setQuestions] = useState<{ q1: string; q2: string } | null>(null);
  const [answers, setAnswers] = useState({ a1: "", a2: "" });
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function lookupQuestions(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const result = await getRecoveryQuestionsAction(username);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setQuestions({ q1: result.question1!, q2: result.question2! });
  }

  async function submitRecovery(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const result = await recoverAccountAction(username, answers.a1, answers.a2, newPassword);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setDone(true);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="mb-4">
          <Logo size={96} className="mx-auto" />
        </div>
        <h1 className="font-display text-3xl text-zff-black tracking-wider">RECOVER ACCOUNT</h1>
        <p className="text-sm text-muted-foreground mt-1">Answer your security questions to set a new password</p>
      </div>

      {done ? (
        <div className="text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-zff-green/10 border border-zff-green/20 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-zff-green" />
          </div>
          <p className="text-sm text-slate-600">
            Your password has been reset. You can now sign in with your new password.
          </p>
          <button onClick={() => router.push("/login")} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            Go to sign in
          </button>
        </div>
      ) : questions ? (
        <>
          {error && <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
          <form onSubmit={submitRecovery} className="space-y-5">
            <div>
              <label className="label">{questions.q1}</label>
              <input type="text" value={answers.a1} onChange={(e) => setAnswers({ ...answers, a1: e.target.value })} required className="input" />
            </div>
            <div>
              <label className="label">{questions.q2}</label>
              <input type="text" value={answers.a2} onChange={(e) => setAnswers({ ...answers, a2: e.target.value })} required className="input" />
            </div>
            <div>
              <label className="label">New password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} className="input pl-10" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-60">
              {loading ? "Verifying..." : <><span>Reset Password</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </>
      ) : (
        <>
          {error && <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
          <form onSubmit={lookupQuestions} className="space-y-5">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="tinashe_23" required autoComplete="username" className="input pl-10" />
              </div>
            </div>
            <button type="submit" disabled={loading || !username.trim()} className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-60">
              {loading ? "Looking up..." : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </>
      )}

      {!done && (
        <p className="text-center text-sm text-muted-foreground mt-8">
          <Link href="/login" className="text-zff-green hover:text-zff-green-dark font-semibold inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </Link>
        </p>
      )}
    </motion.div>
  );
}
