"use server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient: mkClient } = require("@/lib/supabase/server");

export async function sendChatMessageAction(message: string) {
  const trimmed = message.trim();
  if (!trimmed || trimmed.length > 200) return { error: "Invalid message" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // The admin panel's "Matchday Chat" toggle only ever hid the compose UI
  // client-side — sendChatMessageAction itself never checked it, so the
  // moderation kill-switch didn't actually stop anyone who already had the
  // page open (or called this action directly) from posting.
  const { data: flagRow } = await supabase.from("app_config").select("value").eq("key", "feature_flags").single();
  if (flagRow?.value?.chat === false) return { error: "Chat is currently disabled" };

  const { error } = await supabase.from("chat_messages").insert({
    user_id: user.id,
    message: trimmed,
  });

  if (error) return { error: "Failed to send message" };
  return { success: true };
}

export async function reactToMessageAction(msgId: string, emoji: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // increment_reaction does the read-increment-write inside one statement,
  // avoiding the lost-update race of a separate select + update.
  const { data: reactions, error } = await supabase.rpc("increment_reaction", { p_msg_id: msgId, p_emoji: emoji });
  if (error) return { error: "Failed to react to message" };

  return { success: true, reactions };
}

export async function deleteChatMessageAction(msgId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Scoped to user_id so users can only delete their own messages
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("id", msgId)
    .eq("user_id", user.id);

  if (error) return { error: "Failed to delete message" };
  return { success: true };
}

// Lets an admin or moderator remove someone ELSE's message — previously the
// only delete path was self-scoped (above), so there was no way to enforce
// the Terms of Service's ban on abusive chat content short of asking the
// poster to remove it themselves. moderate_delete_chat_message is the
// role-checked RPC; this just wraps it as a server action like every other
// chat operation here.
export async function moderateDeleteChatMessageAction(msgId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("moderate_delete_chat_message", { p_message_id: msgId });
  if (error) return { error: "Failed to remove message" };
  if (data?.error) return { error: data.error };
  return { success: true };
}
