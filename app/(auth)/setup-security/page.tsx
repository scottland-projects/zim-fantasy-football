import { headers } from "next/headers";
import SetupSecurityClient from "./SetupSecurityClient";

// See app/page.tsx for why this reads headers() — forces dynamic
// rendering so this page's scripts get the CSP nonce proxy.ts
// generates per-request.
export default async function SetupSecurityPage() {
  await headers();
  return <SetupSecurityClient />;
}
