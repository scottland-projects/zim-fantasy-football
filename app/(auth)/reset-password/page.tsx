"use client";
export const dynamic = "force-dynamic";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ password: "", confirm: "" });
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function exchangeCode() {
      const code = searchParams.get("code");
      const supabase = createClient();
      if (!code) {
        // The link may already have set a recovery session via a previous visit.
        const { data: { session } } = await supabase.auth.getSession();
        setVerifying(false);
        setLinkInvalid(!session);
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      setVerifying(false);
      setLinkInvalid(!!error);
    }
    exchangeCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: form.password });
    setLoading(false);
    if (error) { setError("Unable to set new password. Please request a new reset link."); return; }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 sm:p-10">
      <div className="text-center mb-8">
        <div className="mb-4">
          <Logo size={96} className="mx-auto" />
        </div>
        <h1 className="font-display text-3xl text-zff-black tracking-wider">SET NEW PASSWORD</h1>
        <p className="text-sm text-muted-foreground mt-1">Choose a new password for your account</p>
      </div>

      {verifying ? (
        <p className="text-center text-sm text-muted-foreground py-6">Verifying your reset link...</p>
      ) : linkInvalid ? (
        <div className="text-center space-y-5">
          <p className="text-sm text-slate-600">This reset link is invalid or has expired.</p>
          <Link href="/forgot-password" className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            Request a new link
          </Link>
        </div>
      ) : done ? (
        <div className="text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-zff-green/10 border border-zff-green/20 flex items-center justify-center">
            <CheckCircle className="w-7 h-7 text-zff-green" />
          </div>
          <p className="text-sm text-slate-600">Password updated. Redirecting you to sign in...</p>
        </div>
      ) : (
        <>
          {error && <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">New password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" required minLength={8} className="input pl-10 pr-10" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type={showPassword ? "text" : "password"} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Repeat new password" required className="input pl-10" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-60">
              {loading ? "Saving..." : <><span>Set new password</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </>
      )}
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
