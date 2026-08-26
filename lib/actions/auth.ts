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
// username instead. Two required security questions (see
// lib/recoveryQuestions.ts) replace the normal "email a reset link" flow,
// which can't work here — there's no real address to send to. If storing
// the questions fails after the account was already created, the account
// is rolled back so the user gets a clean error and can just try again,
// rather than being left with an unrecoverable account.
export async function usernameSignUpAction(
  username: string, password: string, fullName: string,
  q1: string, a1: string, q2: string, a2: string
) {
  const clean = username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
    return { error: "Username must be 3-20 characters: letters, numbers, and underscores only." };
  }
  if (!q1 || !q2 || q1 === q2) return { error: "Pick two different security questions." };
  if (!a1.trim() || !a2.trim()) return { error: "Please answer both security questions." };

  const admin = serviceRole();
  const rateLimitError = await checkSignupRateLimit(admin);
  if (rateLimitError) return { error: rateLimitError };

  const email = `${clean}@zff.internal`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: clean, full_name: fullName },
  });
  if (error) return { error: error.message.toLowerCase().includes("already") ? "That username is already taken." : "Unable to create account. Please try again." };

  const { error: qError } = await admin.rpc("set_recovery_questions", {
    p_user_id: data.user!.id, p_q1: q1, p_a1: a1, p_q2: q2, p_a2: a2,
  });
  if (qError) {
    await admin.auth.admin.deleteUser(data.user!.id);
    return { error: "Unable to create account. Please try again." };
  }

  return { success: true, userId: data.user?.id, email };
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
export async function getRecoveryQuestionsAction(username: string) {
  const clean = username.trim().toLowerCase();
  if (!clean) return { error: "Enter your username" };

  const admin = serviceRole();
  const rateLimitError = await checkRecoveryRateLimit(admin, clean);
  if (rateLimitError) return { error: rateLimitError };

  const { data, error } = await admin.rpc("get_recovery_questions", { p_username: clean });
  if (error || !data?.length) return { error: "No account found with that username, or it has no recovery questions set up." };
  return { success: true, question1: data[0].question_1 as string, question2: data[0].question_2 as string };
}

// Step 2 — verifies both answers and, if correct, sets a new password
// directly via the Admin API (verify_recovery_answers never touches
// auth.users itself, just returns the user id on a match).
export async function recoverAccountAction(username: string, answer1: string, answer2: string, newPassword: string) {
  if (!newPassword || newPassword.length < 8) return { error: "Password must be at least 8 characters" };

  const clean = username.trim().toLowerCase();
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
