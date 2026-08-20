import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/onboarding", "/privacy", "/terms", "/forgot-password", "/reset-password", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname)
  ) {
    return NextResponse.next({ request });
  }

  // Build a mutable response so Supabase can refresh the session cookie
  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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

  // Authenticated user hitting auth pages → send to app. /auth/callback is
  // excluded: it must always run its own exchange-and-redirect logic, even
  // for an already-authenticated user (e.g. confirming an email change or
  // following a fresh magic link while a prior session is still active).
  if (user && isPublic && pathname !== "/" && pathname !== "/auth/callback") {
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
