"use server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient: mkClient } = require("@/lib/supabase/server");
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { generateInviteCode } from "@/lib/utils";

function serviceRole() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function createLeague(
  name: string,
  description: string,
  prizes?: { first: string; second: string; third: string },
) {
  if (!name?.trim()) return { error: "League name is required" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // The admin panel's "League Creation" toggle only ever hid the Create
  // League button client-side — this action never checked it, so it did
  // nothing to actually stop new leagues from being created.
  const { data: flagRow } = await supabase.from("app_config").select("value").eq("key", "feature_flags").single();
  if (flagRow?.value?.leagueCreation === false) return { error: "League creation is currently disabled" };

  const inviteCode = generateInviteCode();

  const hasPrizes = prizes && (prizes.first || prizes.second || prizes.third);

  const { data: league, error } = await supabase
    .from("leagues")
    .insert({
      name: name.trim().slice(0, 100),
      description: description?.trim().slice(0, 500) || null,
      owner_id: user.id,
      invite_code: inviteCode,
      type: "private",
      prizes: hasPrizes ? prizes : null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from("league_members").insert({ league_id: league.id, user_id: user.id });
  revalidatePath("/leagues");
  return { league };
}

export async function joinLeague(inviteCode: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Use service role for the lookup — RLS would block regular users from
  // seeing private leagues, even with a valid invite code.
  const { data: league } = await serviceRole()
    .from("leagues")
    .select()
    .eq("invite_code", inviteCode.toUpperCase())
    .single();

  if (!league) return { error: "Unable to join league. Please check the invite code." };

  const { error } = await supabase
    .from("league_members")
    .insert({ league_id: league.id, user_id: user.id });

  if (error) return { error: "Unable to join league. Please check the invite code." };
  revalidatePath("/leagues");
  return { success: true, league };
}

export async function getPublicLeagues() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: leagues } = await supabase
    .from("leagues")
    .select("id, name, description, prizes")
    .eq("type", "public");

  if (!leagues?.length) return { leagues: [] };

  // Filter out leagues the user is already in
  if (user) {
    const { data: memberships } = await supabase
      .from("league_members")
      .select("league_id")
      .eq("user_id", user.id);
    const joined = new Set((memberships ?? []).map((m: { league_id: string }) => m.league_id));
    return { leagues: (leagues as { id: string; name: string; description: string | null; prizes: unknown }[]).filter(l => !joined.has(l.id)) };
  }

  return { leagues };
}

export async function joinPublicLeague(leagueId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // The RLS insert policy on league_members only checks that the caller is
  // inserting their own membership row — it has no idea whether the target
  // league is actually public. Without this check, calling this action
  // directly with a private league's id (leaked via a URL, a screenshot, a
  // referrer header — a UUID, but not a secret) joins it with no invite
  // code at all. That's the whole point of joinLeague()'s invite-code
  // check; this function must enforce its own name.
  const { data: league } = await supabase.from("leagues").select("type").eq("id", leagueId).single();
  if (!league || league.type !== "public") return { error: "League not found" };

  const { error } = await supabase
    .from("league_members")
    .insert({ league_id: leagueId, user_id: user.id });

  if (error) return { error: error.message };
  revalidatePath("/leagues");
  return { success: true };
}

export async function leaveLeagueAction(leagueId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Owners cannot leave their own league — they must delete it
  const { data: league } = await supabase.from("leagues").select("owner_id").eq("id", leagueId).single();
  if (league?.owner_id === user.id) return { error: "Owners cannot leave their own league. Delete it instead." };

  const { error } = await supabase.from("league_members").delete().eq("league_id", leagueId).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/leagues");
  return { success: true };
}

export async function deleteLeagueAction(leagueId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify caller is the owner OR an admin
  const { data: league } = await supabase.from("leagues").select("owner_id").eq("id", leagueId).single();
  if (!league) return { error: "League not found" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "admin";
  const isOwner = league.owner_id === user.id;
  if (!isOwner && !isAdmin) return { error: "Not authorised" };

  // Use service role to remove all members (owner can only delete their own
  // membership row via RLS; service role bypasses this for the cleanup)
  const admin = serviceRole();
  await admin.from("league_members").delete().eq("league_id", leagueId);
  const { error } = await admin.from("leagues").delete().eq("id", leagueId);

  if (error) return { error: error.message };
  revalidatePath("/leagues");
  return { success: true };
}

export async function getLeagueStandings(leagueId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Verify the caller is a member of this league before returning any data
  const { data: membership } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return [];

  const { data } = await supabase
    .from("league_members")
    .select(`*, profiles(username, avatar_url, level), fantasy_teams(team_name, weekly_points)`)
    .eq("league_id", leagueId)
    .order("points", { ascending: false });
  return data ?? [];
}
