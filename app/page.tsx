import { headers } from "next/headers";
import HomeClient from "./HomeClient";

// Reading headers() forces this page to render dynamically per-request
// (rather than being prerendered once at build time) — required so the
// CSP nonce proxy.ts generates on every request actually reaches
// this page's script tags. Nonce-based CSP and static generation are
// mutually exclusive per Next.js's own docs: a statically prerendered
// page has no request to read a nonce from in the first place.
export default async function HomePage() {
  await headers();
  return <HomeClient />;
}
