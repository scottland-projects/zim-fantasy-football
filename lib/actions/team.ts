"use server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient: mkClient } = require("@/lib/supabase/server");
import { revalidatePath } from "next/cache";

export async function saveTeam(
  teamName: string,
  formation: string,
  playerIds: string[],
  captainId: string,
  viceCaptainId: string,
  startingIds: string[]
) {
  if (!teamName?.trim()) return { error: "Team name is required" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // save_fantasy_team validates squad size (15), starting XI (11), distinct
  // captain/vice-captain, and total price against the budget server-side,
  // and writes the team + squad in a single transaction — see
  // lib/supabase/schema.sql
  const { data, error } = await supabase.rpc("save_fantasy_team", {
    p_team_name: teamName.trim().slice(0, 60),
    p_formation: formation,
    p_player_ids: playerIds,
    p_captain_id: captainId,
    p_vice_captain_id: viceCaptainId,
    p_starting_ids: startingIds,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  revalidatePath("/my-team");
  return { success: true };
}

export async function getMyTeam() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: team } = await supabase
    .from("fantasy_teams")
    .select(`*, fantasy_team_players(*, players(*))`)
    .eq("user_id", user.id)
    .single();

  return team;
}
