import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/onboarding", "/privacy", "/terms", "/forgot-password", "/reset-password", "/auth/callback"];

// Subset of PUBLIC_PATHS that an ALREADY-AUTHENTICATED user should be
// bounced away from (back to /dashboard) — the sign-in/sign-up pages.
// Everything else in PUBLIC_PATHS (onboarding, privacy, terms, auth
// callback) must stay reachable while logged in: onboarding is only ever
// visited by a freshly-authenticated user, and privacy/terms are ordinary
// pages a logged-in user can legitimately want to read.
const AUTH_ONLY_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname)
  ) {
    return NextResponse.next({ request });
  }

  // A per-request nonce for the Content-Security-Policy's script-src, in
  // place of 'unsafe-inline'/'unsafe-eval' (previously set statically in
  // next.config.ts, which meant CSP couldn't actually block an injected
  // inline script even if an XSS point were ever found — the policy
  // allowed ANY inline script, attacker-supplied or not). Next.js's own
  // page-bootstrap/hydration scripts pick up this same nonce automatically
  // via the x-nonce request header below (App Router's documented
  // pattern), so this needs no changes anywhere else — the app has no
  // custom <script> tags of its own to update. 'strict-dynamic' lets
  // Next's nonce'd bootstrap script load its own chunk scripts, which
  // don't carry the nonce directly.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https://*.supabase.co https://lh3.googleusercontent.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://analytics.google.com",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  // Build a mutable response so Supabase can refresh the session cookie
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", cspHeader);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          // Write cookies to both the forwarded request and the response
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set("Content-Security-Policy", cspHeader);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    }
  );

  // Always use getUser() — getSession() trusts the client-side JWT without
  // re-validating with Supabase Auth and is NOT safe for route protection.
  const { data: { user } } = await supabase.auth.getUser();

  // Exact-prefix match only (path === p, or path starts with "p/") — a plain
  // startsWith() would also treat an unrelated route like "/loginhistory" as
  // public just because it shares a prefix with "/login".
  const isPublic =
    pathname === "/" ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Unauthenticated user trying to reach a protected route → login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname); // preserve destination for post-login redirect
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting a sign-in/sign-up page → send to app.
  const isAuthOnly = AUTH_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (user && isAuthOnly) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on every route except Next.js internals and static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
