import { headers } from "next/headers";
import OnboardingClient from "./OnboardingClient";

// See app/page.tsx for why this reads headers() — forces dynamic
// rendering so this page's scripts get the CSP nonce proxy.ts
// generates per-request.
export default async function OnboardingPage() {
  await headers();
  return <OnboardingClient />;
}
