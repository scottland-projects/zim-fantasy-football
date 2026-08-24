import { headers } from "next/headers";
import TermsClient from "./TermsClient";

// See app/page.tsx for why this reads headers() — forces dynamic
// rendering so this page's scripts get the CSP nonce proxy.ts
// generates per-request.
export default async function TermsPage() {
  await headers();
  return <TermsClient />;
}
