"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Bell, Shield, Palette, Save, Check, AlertTriangle, KeyRound, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_SETTINGS = {
  notifications: {
    matchReminders:    true,
    transferDeadlines: true,
    goalAlerts:        true,
    leagueInvites:     true,
    rewardUnlocks:     true,
    weeklyDigest:      true,
  },
  display: {
    compactMode:      false,
    showAnimations:   true,
    showPlayerImages: true,
    showFormGuide:    true,
  },
};

type Settings = typeof DEFAULT_SETTINGS;

const NOTIF_LABELS: Record<string, { label: string; desc: string }> = {
  matchReminders:    { label: "Match Reminders",         desc: "Get notified 1 hour before kickoff" },
  transferDeadlines: { label: "Transfer Deadline Alerts", desc: "Alerts when transfer window closes" },
  goalAlerts:        { label: "Live Goal Alerts",         desc: "Instant alerts for your players' goals" },
  leagueInvites:     { label: "League Invitations",       desc: "Notify when someone invites you" },
  rewardUnlocks:     { label: "Achievement Unlocks",      desc: "Celebrate when you earn a badge" },
  weeklyDigest:      { label: "Weekly Digest",            desc: "Summary of your performance each week" },
};

const DISPLAY_LABELS: Record<string, { label: string; desc: string }> = {
  compactMode:      { label: "Compact Mode",      desc: "Tighter spacing to see more at once" },
  showAnimations:   { label: "Show Animations",   desc: "Smooth transitions and motion effects" },
  showPlayerImages: { label: "Player Images",     desc: "Show player photo cards on the pitch" },
  showFormGuide:    { label: "Form Colour Guide", desc: "Colour-code form ratings in the market" },
};

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "relative w-11 h-6 rounded-full border transition-all shrink-0",
        value ? "bg-zff-green/20 border-zff-green/40" : "bg-slate-100 border-slate-200"
      )}
    >
      <div className={cn(
        "absolute top-0.5 w-5 h-5 rounded-full transition-all shadow-sm",
        value ? "left-5 bg-zff-green" : "left-0.5 bg-slate-300"
      )} />
    </button>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [pwOpen, setPwOpen]               = useState(false);
  const [pwForm, setPwForm]               = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError]             = useState("");
  const [pwSaving, setPwSaving]           = useState(false);
  const [pwDone, setPwDone]               = useState(false);
  const [showPw, setShowPw]               = useState({ current: false, next: false, confirm: false });

  // Load settings from Supabase on mount
  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from("user_settings")
          .select("notifications, display")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data) {
          setSettings({
            notifications: { ...DEFAULT_SETTINGS.notifications, ...(data.notifications ?? {}) },
            display:       { ...DEFAULT_SETTINGS.display,       ...(data.display ?? {}) },
          });
        }
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  function updateNotification(key: string, value: boolean) {
    setSettings(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
  }

  function updateDisplay(key: string, value: boolean) {
    setSettings(prev => ({
      ...prev,
      display: { ...prev.display, [key]: value },
    }));
  }

  async function changePassword() {
    setPwError("");
    if (!pwForm.current) { setPwError("Enter your current password"); return; }
    if (pwForm.next.length < 8) { setPwError("New password must be at least 8 characters"); return; }
    if (pwForm.next !== pwForm.confirm) { setPwError("New passwords do not match"); return; }
    setPwSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;

      // Verify current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: pwForm.current,
      });
      if (signInErr) { setPwError("Current password is incorrect"); return; }

      // Set new password
      const { error: updateErr } = await supabase.auth.updateUser({ password: pwForm.next });
      if (updateErr) { setPwError(updateErr.message); return; }

      // Sign out every other active session (other devices/browsers) — a
      // password change should immediately invalidate any session an
      // attacker may already hold, not just prevent future logins with the
      // old password. `scope: "others"` keeps the current session signed in.
      await supabase.auth.signOut({ scope: "others" });

      setPwDone(true);
      setPwOpen(false);
      setPwForm({ current: "", next: "", confirm: "" });
      setTimeout(() => setPwDone(false), 3000);
    } catch { setPwError("Something went wrong — please try again"); }
    finally { setPwSaving(false); }
  }


  async function saveSettings() {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("user_settings")
        .upsert({
          user_id:       user.id,
          notifications: settings.notifications,
          display:       settings.display,
          updated_at:    new Date().toISOString(),
        }, { onConflict: "user_id" });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* silently fail */ }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar title="Settings" subtitle="Configure your experience" />
        <div className="p-8 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-zff-green border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar title="Settings" subtitle="Configure your experience" />

      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">

        {/* Notification Preferences */}
        <div className="glass-card p-7">
          <h2 className="font-bold text-zff-black mb-5 flex items-center gap-2">
            <Bell className="w-4 h-4 text-zff-green" /> Notification Preferences
          </h2>
          <div className="space-y-4">
            {Object.entries(settings.notifications).map(([key, value]) => {
              const meta = NOTIF_LABELS[key];
              return (
                <div key={key} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-zff-black">{meta?.label ?? key}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta?.desc}</p>
                  </div>
                  <Toggle value={value} onChange={v => updateNotification(key, v)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Display Preferences */}
        <div className="glass-card p-7">
          <h2 className="font-bold text-zff-black mb-5 flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-400" /> Display Preferences
          </h2>
          <div className="space-y-4">
            {Object.entries(settings.display).map(([key, value]) => {
              const meta = DISPLAY_LABELS[key];
              return (
                <div key={key} className="flex items-center justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-zff-black">{meta?.label ?? key}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta?.desc}</p>
                  </div>
                  <Toggle value={value} onChange={v => updateDisplay(key, v)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Security */}
        <div className="glass-card p-7">
          <h2 className="font-bold text-zff-black mb-5 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" /> Account Security
          </h2>
          <div className="space-y-3">
            {/* Change password — inline form */}
            {!pwOpen ? (
              <button onClick={() => { setPwOpen(true); setPwError(""); }}
                className="btn-outline w-full text-sm py-2.5 flex items-center justify-center gap-2">
                <KeyRound className="w-4 h-4" />
                {pwDone ? "✓ Password updated" : "Change Password"}
              </button>
            ) : (
              <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                {[
                  { key: "current", label: "Current password", placeholder: "Enter current password" },
                  { key: "next",    label: "New password",      placeholder: "At least 8 characters" },
                  { key: "confirm", label: "Confirm new password", placeholder: "Repeat new password" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                    <div className="relative">
                      <input
                        type={showPw[key as keyof typeof showPw] ? "text" : "password"}
                        value={pwForm[key as keyof typeof pwForm]}
                        onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="input text-sm py-2 pr-10"
                      />
                      <button type="button"
                        onClick={() => setShowPw(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showPw[key as keyof typeof showPw] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                {pwError && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{pwError}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setPwOpen(false); setPwForm({ current: "", next: "", confirm: "" }); setPwError(""); }}
                    className="btn-outline text-sm py-2 px-4 flex-1">Cancel</button>
                  <button onClick={changePassword} disabled={pwSaving}
                    className="btn-primary text-sm py-2 px-4 flex-1 disabled:opacity-60">
                    {pwSaving ? "Updating…" : "Update Password"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={saveSettings}
          disabled={saving}
          className={cn(
            "btn-primary flex items-center gap-2 py-2.5 px-6 transition-all disabled:opacity-60",
            saved && "bg-emerald-600 border-emerald-600"
          )}
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : saved ? "Settings Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
