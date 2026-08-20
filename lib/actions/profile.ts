"use server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient: mkClient } = require("@/lib/supabase/server");

export async function updateProfileAction(form: {
  full_name: string;
  bio: string;
  favorite_player: string;
  supporter_branch: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (form.full_name && form.full_name.length > 100) return { error: "Full name too long" };
  if (form.bio && form.bio.length > 300) return { error: "Bio too long" };
  if (form.favorite_player && form.favorite_player.length > 100) return { error: "Favourite player name too long" };
  if (form.supporter_branch && form.supporter_branch.length > 100) return { error: "Branch name too long" };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: form.full_name.trim(),
      bio: form.bio.trim(),
      favorite_player: form.favorite_player.trim(),
      supporter_branch: form.supporter_branch,
    })
    .eq("id", user.id);

  if (error) return { error: "Failed to save profile" };
  return { success: true };
}
