import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Content-Security-Policy is set per-request in proxy.ts
          // instead of here — it needs a fresh nonce on every request
          // (script-src 'nonce-<value>'), which a static config value
          // can't provide. A static 'unsafe-inline'/'unsafe-eval' script-src
          // used to live here, which meant CSP couldn't block an injected
          // inline script even if an XSS point were ever found.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
      {
        // The service worker itself must never be cached — browsers already
        // re-check it periodically, but a stale sw.js frozen behind a CDN
        // cache would mean a shipped fix never reaches installed clients.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  images: {
    // Restrict to known trusted image origins only.
    // A wildcard hostname ("**") allows the image optimizer to proxy any URL,
    // which is an SSRF vector and an abuse pathway.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "eqybrhfisdzurtgemeon.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Google OAuth avatars
      },
    ],
  },
};

export default nextConfig;
