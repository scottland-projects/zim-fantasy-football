// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require("@/lib/supabase/server");
import { NextResponse } from "next/server";

function safeRedirect(next: string | null): string {
  if (!next) return "/dashboard";
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  return "/dashboard";
}

export async function GET(request: Request) {
  const url    = new URL(request.url);
  const code   = url.searchParams.get("code");
  const next   = safeRedirect(url.searchParams.get("next"));
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? request.url).origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Check whether this user has completed onboarding.
  // A profile with no supporter_branch means they came straight from email confirmation
  // and have never gone through the onboarding flow.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("supporter_branch, full_name")
        .eq("id", user.id)
        .single();

      const onboardingComplete =
        profile && (profile.supporter_branch || profile.full_name);

      if (!onboardingComplete) {
        return NextResponse.redirect(`${origin}/onboarding`);
      }
    }
  } catch { /* if profile check fails, fall through to dashboard */ }

  return NextResponse.redirect(`${origin}${next}`);
}
