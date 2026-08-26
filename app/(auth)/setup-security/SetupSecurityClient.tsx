"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowRight, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { setRecoveryQuestionsAction } from "@/lib/actions/auth";
import { RECOVERY_QUESTIONS } from "@/lib/recoveryQuestions";
import { QuestionField } from "@/components/security/QuestionField";

const NEXT_STEP = "/privacy?from=onboarding";

// Shown once, right after signup. Security questions are how a username-
// only account gets recovered — there's no email or phone to send a reset
// link to — so this nudges every new user to set them up while making it
// easy to keep moving without doing so (skip is a real, working choice
// here, not a dead end dressed up as one).
export default function SetupSecurityClient() {
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [form, setForm] = useState({
    q1: RECOVERY_QUESTIONS[0], a1: "",
    q2: RECOVERY_QUESTIONS[1], a2: "",
  });
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setChecking(false);
    }
    checkAuth();
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    if (form.q1.trim().toLowerCase() === form.q2.trim().toLowerCase()) {
      setError("Pick two different security questions.");
      return;
    }
    if (!form.a1.trim() || !form.a2.trim()) {
      setError("Please answer both security questions.");
      return;
    }
    setLoading(true);
    const result = await setRecoveryQuestionsAction(form.q1.trim(), form.a1, form.q2.trim(), form.a2);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    router.push(NEXT_STEP);
  }

  if (checking) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 border-2 border-zff-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="mb-4">
          <Logo size={80} className="mx-auto" />
        </div>
        <h1 className="font-display text-2xl text-zff-black tracking-wider">SECURE YOUR ACCOUNT</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Set two security questions so you can get back in if you ever forget your password.
        </p>
      </div>

      {error && <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

      <form onSubmit={handleSave} className="space-y-4">
        <QuestionField
          label="Question 1" question={form.q1} answer={form.a1} otherQuestion={form.q2}
          onQuestionChange={(q) => setForm({ ...form, q1: q })}
          onAnswerChange={(a) => setForm({ ...form, a1: a })}
        />
        <QuestionField
          label="Question 2" question={form.q2} answer={form.a2} otherQuestion={form.q1}
          onQuestionChange={(q) => setForm({ ...form, q2: q })}
          onAnswerChange={(a) => setForm({ ...form, a2: a })}
        />
        <p className="text-xs text-muted-foreground leading-relaxed">
          This is your only way back into your account if you forget your password, so please{" "}
          <span className="font-medium text-zff-black">keep your answers to yourself</span>. If our
          suggested questions feel too easy to guess, feel free to write your own.
        </p>

        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
          {loading ? "Saving..." : <><ShieldCheck className="w-4 h-4" /><span>Save & Continue</span></>}
        </button>
      </form>

      <div className="mt-5 pt-5 border-t border-slate-100">
        {!confirmingSkip ? (
          <button
            type="button"
            onClick={() => setConfirmingSkip(true)}
            className="w-full text-center text-sm text-muted-foreground hover:text-zff-black transition-colors"
          >
            Skip for now
          </button>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-xs text-amber-800 flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Without security questions, there is no way to reset your password or recover this
              account if you get locked out — you can always set them up later from Settings.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmingSkip(false)} className="btn-outline flex-1 text-sm py-2">
                Go back
              </button>
              <button
                type="button"
                onClick={() => router.push(NEXT_STEP)}
                className="flex-1 text-sm py-2 rounded-xl border border-amber-300 text-amber-800 font-medium hover:bg-amber-100 transition-colors flex items-center justify-center gap-1.5"
              >
                Skip anyway <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
