"use server";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient: mkClient } = require("@/lib/supabase/server");
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

function serviceRole() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requestIp(): Promise<string> {
  const h = await headers();
  // Vercel sets x-forwarded-for on every request; take the first (client) hop.
  return (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
}

const SIGNUP_MAX_PER_IP = 5;
const SIGNUP_WINDOW_MINUTES = 60;

// Shared by every synthetic-email signup path below (phone, username-only).
// Creating users via the Admin API bypasses GoTrue's own public-signup rate
// limits entirely — nothing else throttles this path, so a script could
// mint unlimited fake accounts by varying the identifier each call. This
// per-IP limit is the only thing standing in for that.
async function checkSignupRateLimit(admin: ReturnType<typeof serviceRole>): Promise<string | null> {
  const ip = await requestIp();
  const since = new Date(Date.now() - SIGNUP_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await admin
    .from("signup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ip)
    .gte("created_at", since);

  if ((count ?? 0) >= SIGNUP_MAX_PER_IP) {
    return "Too many accounts created recently. Please try again later.";
  }
  await admin.from("signup_attempts").insert({ ip_address: ip });
  return null;
}

// Phone-only signup uses a synthetic "@zff.internal" email that can't
// receive mail, so it can never complete Supabase's normal email-confirmation
// flow (that previously left these accounts permanently unconfirmed and
// unable to log in). There's no real email to verify here, so the service
// role creates the account pre-confirmed instead.
export async function phoneSignUpAction(email: string, password: string, username: string, fullName: string, phone: string) {
  const admin = serviceRole();
  const rateLimitError = await checkSignupRateLimit(admin);
  if (rateLimitError) return { error: rateLimitError };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName, phone },
  });
  if (error) return { error: error.message.toLowerCase().includes("already") ? "An account with these details already exists." : "Unable to create account. Please try again." };
  return { success: true, userId: data.user?.id };
}

// Username-only signup — no email or phone collected at all. Same
// pre-confirmed synthetic-email trick as the phone path above, keyed by
// username instead. Security questions used to be collected here too, but
// now happen as a skippable step right after signup (setRecoveryQuestionsAction
// below) so a slow/fiddly step doesn't block account creation itself.
// Every check below is re-validated here even though the form already
// enforces most of it client-side — the client-side rules (minLength,
// maxLength, pattern, disabled buttons) are only a UX convenience and are
// trivially bypassed by anyone calling this server action directly (Burp
// Suite, curl, a modified fetch call), so nothing here can be trusted to
// have already been checked.
export async function usernameSignUpAction(username: string, password: string, fullName: string) {
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    return { error: "Username must be 3-20 characters: letters, numbers, and underscores only." };
  }
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters." };

  const admin = serviceRole();
  const rateLimitError = await checkSignupRateLimit(admin);
  if (rateLimitError) return { error: rateLimitError };

  const email = `${clean}@zff.internal`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: clean, full_name: fullName.trim().slice(0, 100) },
  });
  if (error) return { error: error.message.toLowerCase().includes("already") ? "That username is already taken." : "Unable to create account. Please try again." };

  return { success: true, userId: data.user?.id, email };
}

// Sets (or replaces) the current signed-in user's two recovery questions —
// called both from the post-signup setup step and from Settings, so it
// always operates on whoever's actual session this is, never a client-
// supplied user id. Reuses the same set_recovery_questions RPC signup used
// to call directly (ON CONFLICT DO UPDATE, so calling it again from
// Settings cleanly overwrites the previous pair).
export async function setRecoveryQuestionsAction(q1: string, a1: string, q2: string, a2: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const question1 = q1.trim(), question2 = q2.trim();
  const answer1 = a1.trim(), answer2 = a2.trim();
  if (question1.length < 6 || question1.length > 150 || question2.length < 6 || question2.length > 150) {
    return { error: "Security questions must be 6-150 characters." };
  }
  if (question1.toLowerCase() === question2.toLowerCase()) return { error: "Pick two different security questions." };
  if (!answer1 || answer1.length > 100 || !answer2 || answer2.length > 100) {
    return { error: "Please answer both security questions (100 characters max)." };
  }

  const admin = serviceRole();
  const { error } = await admin.rpc("set_recovery_questions", {
    p_user_id: user.id, p_q1: question1, p_a1: answer1, p_q2: question2, p_a2: answer2,
  });
  if (error) return { error: "Unable to save security questions. Please try again." };

  return { success: true };
}

// Whether the current user has recovery questions set, and if so the
// question text (never the answers — those stay hashed and one-way).
// Used to show a "set up" vs "change" state in Settings and to warn a
// freshly-registered user before they skip the setup step. Reads the
// table directly via the service role rather than the RPCs above, which
// are keyed by username for the logged-out recovery flow — this already
// has the authenticated user id, no need to round-trip through a username.
export async function getMyRecoveryQuestionsStatusAction() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const admin = serviceRole();
  const { data } = await admin
    .from("recovery_questions")
    .select("question_1, question_2")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return { success: true, isSet: false as const };
  return { success: true, isSet: true as const, question1: data.question_1 as string, question2: data.question_2 as string };
}

const RECOVERY_MAX_ATTEMPTS = 8;
const RECOVERY_WINDOW_MINUTES = 15;

async function checkRecoveryRateLimit(admin: ReturnType<typeof serviceRole>, username: string): Promise<string | null> {
  const since = new Date(Date.now() - RECOVERY_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await admin
    .from("recovery_attempts")
    .select("id", { count: "exact", head: true })
    .eq("username", username)
    .gte("created_at", since);

  if ((count ?? 0) >= RECOVERY_MAX_ATTEMPTS) {
    return `Too many attempts. Please wait ${RECOVERY_WINDOW_MINUTES} minutes and try again.`;
  }
  return null;
}

// Step 1 of account recovery — looks up which two questions a username set
// at signup. Returns only the question text, never anything answer-related.
// Counts against the same recovery_attempts budget as the actual answer
// check below, so this can't be hammered separately to enumerate usernames
// indefinitely without ever tripping a limit.
export async function getRecoveryQuestionsAction(username: string) {
  const clean = username.trim().toLowerCase().slice(0, 100);
  if (!clean) return { error: "Enter your username" };

  const admin = serviceRole();
  const rateLimitError = await checkRecoveryRateLimit(admin, clean);
  if (rateLimitError) return { error: rateLimitError };
  await admin.from("recovery_attempts").insert({ username: clean });

  const { data, error } = await admin.rpc("get_recovery_questions", { p_username: clean });
  if (error || !data?.length) return { error: "No account found with that username, or it has no recovery questions set up." };
  return { success: true, question1: data[0].question_1 as string, question2: data[0].question_2 as string };
}

// Step 2 — verifies both answers and, if correct, sets a new password
// directly via the Admin API (verify_recovery_answers never touches
// auth.users itself, just returns the user id on a match). Answers are
// length-capped before being passed anywhere — not a real cost concern
// since bcrypt truncates at 72 bytes internally either way, but rejecting
// clearly-invalid input early is cheaper than round-tripping it to Postgres.
export async function recoverAccountAction(username: string, answer1: string, answer2: string, newPassword: string) {
  if (!newPassword || newPassword.length < 8) return { error: "Password must be at least 8 characters" };
  if (!answer1 || answer1.length > 100 || !answer2 || answer2.length > 100) return { error: "One or both answers are incorrect." };

  const clean = username.trim().toLowerCase().slice(0, 100);
  const admin = serviceRole();
  const rateLimitError = await checkRecoveryRateLimit(admin, clean);
  if (rateLimitError) return { error: rateLimitError };

  await admin.from("recovery_attempts").insert({ username: clean });

  const { data: userId, error } = await admin.rpc("verify_recovery_answers", { p_username: clean, p_a1: answer1, p_a2: answer2 });
  if (error || !userId) return { error: "One or both answers are incorrect." };

  const { error: updateError } = await admin.auth.admin.updateUserById(userId as string, { password: newPassword });
  if (updateError) return { error: "Unable to reset password. Please try again." };

  return { success: true };
}

export async function signUp(formData: FormData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;
  const fullName = formData.get("full_name") as string;

  const { error } = await supabase.auth.signUp({
    email, password,
    options: { data: { username, full_name: fullName } },
  });

  if (error) return { error: error.message };
  redirect("/onboarding");
}

export async function signIn(formData: FormData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_MINUTES = 15;
const GENERIC_LOGIN_ERROR = "Invalid credentials. Please try again.";

// Resolves a username/phone/email identifier and signs in, entirely
// server-side. Two things this closes that the previous client-side flow
// didn't:
//  1. resolve_login_identifier is no longer reachable by anon at all — it's
//     called here via the service role, and the resolved email is never
//     sent to the browser, so this route can't be used as a
//     username/phone -> email enumeration oracle (see supabase/migrations/
//     20260818150000_security_audit_fixes.sql).
//  2. Every failure path (unknown identifier, wrong password, disabled
//     account) returns the exact same generic message — a differing error
//     for "no such user" vs "wrong password" is itself an enumeration leak.
// A simple DB-backed rate limit throttles repeated attempts per identifier,
// since Vercel's serverless functions can't hold in-memory state across
// invocations/instances.
export async function signInWithIdentifierAction(identifier: string, password: string) {
  const trimmed = identifier.trim();
  if (!trimmed || !password) return { error: GENERIC_LOGIN_ERROR };

  const key = trimmed.toLowerCase();
  const admin = serviceRole();

  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000).toISOString();
  const { count } = await admin
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("identifier", key)
    .gte("created_at", since);

  if ((count ?? 0) >= LOGIN_MAX_ATTEMPTS) {
    return { error: `Too many attempts. Please wait ${LOGIN_WINDOW_MINUTES} minutes and try again.` };
  }

  let email = trimmed;
  if (!trimmed.includes("@")) {
    const { data } = await admin.rpc("resolve_login_identifier", { identifier: trimmed });
    if (!data) {
      await admin.from("login_attempts").insert({ identifier: key });
      return { error: GENERIC_LOGIN_ERROR };
    }
    email = data as string;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await admin.from("login_attempts").insert({ identifier: key });
    return { error: GENERIC_LOGIN_ERROR };
  }

  return { success: true };
}

export async function signOut() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await mkClient();
  await supabase.auth.signOut();
  redirect("/");
}
