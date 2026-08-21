"use server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient: mkClient } = require("@/lib/supabase/server");
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function serviceRole() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

interface PlayerStat {
  player_id: string;
  minutes: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  clean_sheet: boolean;
}

async function requireAdmin() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, supabase: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: { role: string } | null };

  if (profile?.role !== "admin") return { error: "Not authorized" as const, supabase: null };

  return { error: null, supabase };
}

async function requireAdminOrManager() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, supabase: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as { data: { role: string } | null };

  if (!["admin", "manager"].includes(profile?.role ?? "")) return { error: "Not authorized" as const, supabase: null };

  return { error: null, supabase };
}

// Real auth emails aren't on `profiles` (and shouldn't be — see the
// column-level REVOKE on profiles.phone for the same PII-exposure reason),
// so the admin Users list previously fabricated a fake `@…demo` address
// from the username instead of showing the account's actual sign-in email.
// This fetches the real ones via the service role, admin-gated.
export async function listUserEmailsAction() {
  const { error } = await requireAdmin();
  if (error) return { error, emails: {} as Record<string, string> };

  const admin = serviceRole();
  const emails: Record<string, string> = {};
  let page = 1;
  // Cap at 20 pages (2,000 users) — enough for realistic scale without
  // unbounded work if the user base grows very large.
  for (; page <= 20; page++) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (listErr || !data?.users?.length) break;
    for (const u of data.users) if (u.email) emails[u.id] = u.email;
    if (data.users.length < 100) break;
  }
  return { error: null, emails };
}

export async function saveFlagsAction(flags: Record<string, boolean>) {
  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  await supabase
    .from("app_config")
    .update({ value: flags, updated_at: new Date().toISOString() })
    .eq("key", "feature_flags");

  return { success: true };
}

export async function updateMatchStatusAction(matchId: string, status: string) {
  const VALID_STATUSES = ["scheduled", "live", "finished", "postponed"];
  if (!VALID_STATUSES.includes(status)) return { error: "Invalid status" };

  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  const update: Record<string, string> = { status };
  if (status === "live") update.kickoff_time = new Date().toISOString();
  await supabase.from("matches").update(update).eq("id", matchId);
  return { success: true };
}

export async function cancelMatchLiveAction(matchId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single() as { data: { role: string } | null };
  if (!["admin", "manager"].includes(profile?.role ?? "")) return { error: "Not authorized" };

  // Fetch matchday so we can target the exact notifications
  const { data: match } = await supabase.from("matches").select("matchday").eq("id", matchId).single();
  if (!match) return { error: "Match not found" };

  // Revert status
  await supabase.from("matches").update({ status: "scheduled" }).eq("id", matchId);

  // Delete the "now LIVE!" notifications the trigger already sent
  await supabase.from("notifications")
    .delete()
    .like("title", `MD${match.matchday} is now LIVE!%`);

  return { success: true };
}

export async function saveFixtureAction(form: {
  home: string;
  away: string;
  matchday: string;
  kickoff: string;
  season: string;
}) {
  if (!form.away?.trim() || !form.matchday || !form.kickoff) return { error: "Missing required fields", data: null };

  const matchday = parseInt(form.matchday);
  if (isNaN(matchday) || matchday < 1 || matchday > 500) return { error: "Invalid matchday", data: null };

  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error", data: null };

  const { data, error: dbError } = await supabase.from("matches").insert({
    home_team: form.home.trim().slice(0, 100),
    away_team: form.away.trim().slice(0, 100),
    matchday,
    kickoff_time: form.kickoff,
    season: form.season.trim().slice(0, 20),
    status: "scheduled",
  }).select().single();

  if (dbError) return { error: dbError.message, data: null };
  revalidatePath("/admin");
  return { error: null, data };
}

export async function saveMatchStatsAction(
  matchId: string,
  playerStats: PlayerStat[],
  matchday: number,
  season: string,
) {
  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  const played = playerStats.filter(r => r.minutes > 0);

  if (played.length > 0) {
    await supabase.from("player_match_stats").upsert(
      played.map(r => ({
        player_id: r.player_id,
        match_id: matchId,
        goals: Math.max(0, Math.min(20, Math.floor(r.goals))),
        assists: Math.max(0, Math.min(20, Math.floor(r.assists))),
        yellow_cards: Math.max(0, Math.min(2, Math.floor(r.yellow_cards))),
        red_cards: Math.max(0, Math.min(1, Math.floor(r.red_cards))),
        clean_sheet: Boolean(r.clean_sheet),
        minutes_played: Math.max(0, Math.min(120, Math.floor(r.minutes))),
      })),
      { onConflict: "player_id,match_id" }
    );
  }

  const { data: match } = await supabase.from("matches").select("home_team, away_team").eq("id", matchId).single();
  const { data: playerClubs } = await supabase.from("players").select("id, club").in("id", played.map(r => r.player_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clubById = new Map((playerClubs ?? []).map((p: any) => [p.id, p.club]));

  let homeGoals = 0, awayGoals = 0;
  for (const r of played) {
    const club = clubById.get(r.player_id);
    if (club === match?.home_team) homeGoals += r.goals;
    else if (club === match?.away_team) awayGoals += r.goals;
  }

  await supabase.from("matches").update({
    status: "finished",
    home_score: homeGoals,
    away_score: awayGoals,
  }).eq("id", matchId);

  await supabase.rpc("recalculate_matchday_team_points", { p_matchday: matchday, p_season: season });

  return { success: true };
}

export async function savePrizesAction(leagueId: string, prizes: { first: string; second: string; third: string }) {
  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  const sanitized = {
    first: prizes.first.slice(0, 200),
    second: prizes.second.slice(0, 200),
    third: prizes.third.slice(0, 200),
  };

  await supabase
    .from("leagues")
    .update({ prizes: sanitized.first || sanitized.second || sanitized.third ? sanitized : null })
    .eq("id", leagueId);

  return { success: true };
}

export async function updateUserRoleAction(userId: string, role: string) {
  const VALID_ROLES = ["user", "manager", "moderator", "admin"];
  if (!VALID_ROLES.includes(role)) return { error: "Invalid role" };

  const { error } = await requireAdmin();
  if (error) return { error };

  // profiles' only UPDATE policy is "auth.uid() = id" (self-service edits to
  // your own bio etc.) — there is no role-based admin-override policy on
  // this table, so running this through the user-scoped client would have
  // RLS silently filter out the target row: 0 rows updated, no error
  // returned, and the caller sees { success: true } for a role change that
  // never happened. requireAdmin() has already authorized the caller above,
  // so the actual write goes through the service role.
  const { data, error: updateErr } = await serviceRole()
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id");

  if (updateErr) return { error: updateErr.message };
  if (!data || data.length === 0) return { error: "User not found" };

  revalidatePath("/admin");
  return { success: true };
}

export async function broadcastNotificationAction(title: string, body: string, type: string) {
  const VALID_TYPES = ["system", "match", "transfer", "goal", "league", "reward"];
  if (!title.trim() || !body.trim()) return { error: "Title and body are required" };
  if (!VALID_TYPES.includes(type)) return { error: "Invalid type" };

  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  const { data: flagRow } = await supabase.from("app_config").select("value").eq("key", "feature_flags").single();
  if (flagRow?.value?.notifications === false) return { error: "Notifications are currently disabled in Feature Flags" };

  const { data: profiles } = await supabase.from("profiles").select("id");
  if (!profiles?.length) return { success: true, count: 0 };

  await supabase.from("notifications").insert(
    profiles.map((p: { id: string }) => ({
      user_id: p.id,
      title: title.trim().slice(0, 100),
      body: body.trim().slice(0, 500),
      type,
      read: false,
    }))
  );

  revalidatePath("/admin");
  return { success: true, count: profiles.length };
}

export async function logMatchEventAction(event: {
  match_id: string;
  player_id: string | null;
  player_name: string;
  event_type: "goal" | "own_goal" | "assist" | "yellow_card" | "red_card";
  side: "home" | "away";
  minute: number;
}) {
  const { error, supabase } = await requireAdminOrManager();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  const { data: ev, error: evErr } = await supabase.from("match_events").insert({
    match_id: event.match_id,
    player_id: event.player_id,
    player_name: event.player_name.slice(0, 100),
    event_type: event.event_type,
    side: event.side,
    minute: Math.max(0, Math.min(120, event.minute)),
  }).select().single();
  if (evErr) return { error: evErr.message };

  if (event.event_type === "goal" || event.event_type === "own_goal") {
    await recalculateScore(supabase, event.match_id);
  }

  return { success: true, event: ev };
}

// A "goal" credits the scoring side's team; an "own_goal" credits the
// OTHER side. This generalises to any fixture between any two clubs, with
// no assumption about which club is "ours".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalculateScore(supabase: any, matchId: string) {
  const { data: rawEvents } = await supabase
    .from("match_events").select("event_type, side").eq("match_id", matchId)
    .in("event_type", ["goal", "own_goal"]);

  let homeGoals = 0, awayGoals = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (rawEvents ?? []).forEach((e: any) => {
    const scoringSide = e.event_type === "goal" ? e.side : (e.side === "home" ? "away" : "home");
    if (scoringSide === "home") homeGoals++; else awayGoals++;
  });

  await supabase.from("matches").update({
    home_score: homeGoals,
    away_score: awayGoals,
  }).eq("id", matchId);
}

export async function deleteMatchEventAction(eventId: string, matchId: string) {
  const { error, supabase } = await requireAdminOrManager();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  await supabase.from("match_events").delete().eq("id", eventId);
  await recalculateScore(supabase, matchId);

  return { success: true };
}

export async function reopenMatchAction(matchId: string, matchday: number, season: string) {
  const { error, supabase } = await requireAdminOrManager();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  // Reverse points before deleting stats — weekly_points is the match's contribution
  await supabase.rpc("reverse_matchday_team_points", { p_matchday: matchday, p_season: season });

  // Delete all saved stats for this match
  await supabase.from("player_match_stats").delete().eq("match_id", matchId);

  // Set match back to live so the manager can re-score
  await supabase.from("matches").update({ status: "live" }).eq("id", matchId);

  // The live trigger fires immediately and sends "now LIVE!" notifications —
  // delete them since this is a stat correction, not a real kickoff.
  // Also delete the stale "points are in!" notifications from the finalisation.
  await supabase.from("notifications").delete().like("title", `MD${matchday} is now LIVE!%`);
  await supabase.from("notifications").delete().like("title", `MD${matchday} points are in!%`);

  revalidatePath("/manager");
  revalidatePath("/admin");
  return { success: true };
}

export async function adminResetPasswordAction(targetUserId: string, newPassword: string) {
  if (!newPassword || newPassword.length < 8) return { error: "Password must be at least 8 characters" };

  const { error } = await requireAdmin();
  if (error) return { error };

  const admin = serviceRole();
  const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, { password: newPassword });
  if (updateError) return { error: updateError.message };
  return { success: true };
}

export async function editPlayerAction(id: string, player: { name: string; position: string; price: number; is_injured: boolean }) {
  const VALID_POSITIONS = ["GK", "DEF", "MID", "FWD"];
  if (!player.name?.trim()) return { error: "Name is required" };
  if (!VALID_POSITIONS.includes(player.position)) return { error: "Invalid position" };
  // price is raw dollars (e.g. 12000000 = $12.0M) — matches players.price in the DB
  // and lib/utils.ts formatPrice(). The client converts from the "$m" input before calling this.
  if (isNaN(player.price) || player.price < 100_000 || player.price > 20_000_000) return { error: "Price must be between $0.1M and $20M" };

  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  const { data, error: dbError } = await supabase.from("players").update({
    name: player.name.trim().slice(0, 100),
    position: player.position,
    price: Math.round(player.price / 100_000) * 100_000,
    is_injured: player.is_injured,
  }).eq("id", id).select().single();

  if (dbError) return { error: dbError.message };
  revalidatePath("/admin");
  return { error: null, data };
}

export async function deletePlayerAction(id: string) {
  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error" };

  const { error: dbError } = await supabase.from("players").delete().eq("id", id);
  if (dbError) return { error: dbError.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function addPlayerAction(player: { name: string; position: string; price: number }) {
  const VALID_POSITIONS = ["GK", "DEF", "MID", "FWD"];
  if (!player.name?.trim()) return { error: "Name is required", data: null };
  if (!VALID_POSITIONS.includes(player.position)) return { error: "Invalid position", data: null };
  // price is raw dollars (e.g. 12000000 = $12.0M) — matches players.price in the DB
  // and lib/utils.ts formatPrice(). The client converts from the "$m" input before calling this.
  if (isNaN(player.price) || player.price < 100_000 || player.price > 20_000_000) return { error: "Price must be between $0.1M and $20M", data: null };

  const { error, supabase } = await requireAdmin();
  if (error || !supabase) return { error: error ?? "Unknown error", data: null };

  const { data, error: dbError } = await supabase.from("players").insert({
    name: player.name.trim().slice(0, 100),
    position: player.position,
    price: Math.round(player.price / 100_000) * 100_000,
    total_points: 0,
    goals: 0,
    is_injured: false,
  }).select().single();

  if (dbError) return { error: dbError.message, data: null };
  revalidatePath("/admin");
  return { error: null, data };
}
