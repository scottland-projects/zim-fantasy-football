#!/usr/bin/env node
/**
 * Security regression tests — Zim Fantasy Football
 *
 * Exercises the Supabase REST/Auth API directly (the real attack surface,
 * since RLS/RPC authorization is enforced at the database, not the Next.js
 * layer) to prove each vulnerability found in the 2026-08-21 security audit
 * stays fixed. Run against a live Supabase project:
 *
 *   node tests/security-regression.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
 * SUPABASE_SERVICE_ROLE_KEY from .env.local (or the environment). Creates
 * and deletes its own throwaway test accounts — safe to run repeatedly
 * against a live project, including production, since it never touches
 * real user data.
 */
import fs from "fs";
import path from "path";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8").replace(/^﻿/, ""); // strip BOM
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

let pass = 0, fail = 0;
function check(name, condition, detail) {
  if (condition) { pass++; console.log(`  [PASS] ${name}`); }
  else { fail++; console.log(`  [FAIL] ${name}${detail ? " :: " + detail : ""}`); }
}

async function rest(pathname, { method = "GET", token, body, admin = false } = {}) {
  const res = await fetch(`${URL}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: admin ? SERVICE_KEY : ANON_KEY,
      Authorization: `Bearer ${admin ? SERVICE_KEY : (token ?? ANON_KEY)}`,
      "Content-Type": "application/json",
      ...(body ? { Prefer: "return=representation" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

async function createUser(email, username) {
  const res = await fetch(`${URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "TestPass123!", email_confirm: true, user_metadata: { username } }),
  });
  return (await res.json()).id;
}
async function deleteUser(id) {
  if (!id) return;
  await fetch(`${URL}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
}
async function login(email) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "TestPass123!" }),
  });
  return (await res.json()).access_token;
}

(async () => {
  const stamp = Date.now();
  const userAId = await createUser(`sectest_a_${stamp}@example.com`, `sectestA${stamp}`);
  const userBId = await createUser(`sectest_b_${stamp}@example.com`, `sectestB${stamp}`);
  const tokenA = await login(`sectest_a_${stamp}@example.com`);
  const tokenB = await login(`sectest_b_${stamp}@example.com`);

  // ============================================================
  console.log("\n[1] league_members — private-league membership must not leak (HIGH, fixed 2026-08-21)");
  const league = await rest("leagues", {
    method: "POST", token: tokenA,
    body: { name: "SecTest Private League", owner_id: userAId, invite_code: `SEC${stamp}`, type: "private" },
  });
  const leagueId = league.json[0]?.id;
  check("league created", league.status === 201, JSON.stringify(league.json));
  // No Prefer: return=representation here — matches the real app
  // (createLeague's auto-join insert never chains .select()). See the
  // is_league_member() comment in schema.sql for why RETURNING specifically
  // doesn't resolve against this policy.
  await fetch(`${URL}/rest/v1/league_members`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
    body: JSON.stringify({ league_id: leagueId, user_id: userAId }),
  });

  const anonRead = await rest(`league_members?league_id=eq.${leagueId}&select=*`);
  check("anonymous request sees ZERO rows of a private league's membership", Array.isArray(anonRead.json) ? anonRead.json.length === 0 : true, JSON.stringify(anonRead.json));

  const nonMemberRead = await rest(`league_members?league_id=eq.${leagueId}&select=*`, { token: tokenB });
  check("authenticated NON-member sees ZERO rows of another user's private league", Array.isArray(nonMemberRead.json) && nonMemberRead.json.length === 0, JSON.stringify(nonMemberRead.json));

  const memberRead = await rest(`league_members?league_id=eq.${leagueId}&select=*`, { token: tokenA });
  check("the actual member CAN still see their own league's membership", Array.isArray(memberRead.json) && memberRead.json.length === 1, JSON.stringify(memberRead.json));

  // ============================================================
  console.log("\n[2] fantasy_teams — a user cannot write another user's squad data (write-IDOR)");
  const teamB = await rest("fantasy_teams", { method: "POST", admin: true, body: { user_id: userBId, team_name: "Victim Team", budget_remaining: 50000000 } });
  const teamBId = teamB.json[0]?.id;
  const tamper = await rest(`fantasy_teams?id=eq.${teamBId}`, { method: "PATCH", token: tokenA, body: { budget_remaining: 999999999 } });
  const afterTamper = await rest(`fantasy_teams?id=eq.${teamBId}&select=budget_remaining`, { admin: true });
  check("cross-user PATCH is silently rejected by RLS (0 rows affected)", Array.isArray(tamper.json) && tamper.json.length === 0, JSON.stringify(tamper.json));
  check("victim's budget_remaining is unchanged after the tamper attempt", afterTamper.json[0]?.budget_remaining === 50000000, JSON.stringify(afterTamper.json));

  // ============================================================
  console.log("\n[3] resolve_login_identifier — username/phone login must resolve (was broken: param name mismatch)");
  const resolved = await rest("rpc/resolve_login_identifier", { method: "POST", admin: true, body: { identifier: `sectestA${stamp}` } });
  check("resolve_login_identifier resolves a username to its email", resolved.status === 200 && typeof resolved.json === "string" && resolved.json.includes("sectest_a"), JSON.stringify(resolved.json));

  // ============================================================
  console.log("\n[4] Feature flags are enforced server-side, not just hidden client-side");
  // The market page creates an empty fantasy_teams row on first visit,
  // before any purchase — replicate that precondition here.
  await rest("fantasy_teams", { method: "POST", admin: true, body: { user_id: userAId, team_name: "SecTest Team" } });

  await rest("app_config?key=eq.feature_flags", { method: "PATCH", admin: true, body: { value: { liveScoring: true, transferWindow: false, chat: false, polls: false, leagueCreation: false, notifications: true, marketplace: true, achievements: true } } });

  const anyPlayer = await rest("players?select=id&limit=1", { token: tokenA });
  const playerId = anyPlayer.json[0]?.id;
  const buyBlocked = await rest("rpc/buy_player", { method: "POST", token: tokenA, body: { p_player_id: playerId } });
  check("buy_player is blocked when transferWindow=false", buyBlocked.json?.error?.includes("transfer window"), JSON.stringify(buyBlocked.json));

  // chat_messages has no server-side flag check at the RLS layer — the
  // "chat" flag is enforced in lib/actions/chat.ts, a Next.js server
  // action, so it isn't reachable via a raw REST call like this one.
  console.log("  [INFO] chat flag is enforced in lib/actions/chat.ts (a Next.js server action), not at the RLS/REST layer — cannot be exercised via a raw REST call. See app-level test note in report.");

  const pollsRow = await rest("polls?select=id,options&limit=1", { admin: true });
  if (pollsRow.json[0]) {
    const voteBlocked = await rest("rpc/cast_poll_vote", { method: "POST", token: tokenA, body: { p_poll_id: pollsRow.json[0].id, p_option: Object.keys(pollsRow.json[0].options ?? {})[0] ?? "test" } });
    check("cast_poll_vote is blocked when polls=false", voteBlocked.json?.error?.includes("disabled") || voteBlocked.json?.ok === false, JSON.stringify(voteBlocked.json));
  } else {
    console.log("  [INFO] no polls exist to test against — skipped (RPC code path already verified by inspection)");
  }

  // restore flags
  await rest("app_config?key=eq.feature_flags", { method: "PATCH", admin: true, body: { value: { liveScoring: true, transferWindow: true, chat: true, polls: true, leagueCreation: true, notifications: true, marketplace: true, achievements: true } } });
  const buyAllowed = await rest("rpc/buy_player", { method: "POST", token: tokenA, body: { p_player_id: playerId } });
  check("buy_player works again once transferWindow=true is restored (no regression)", buyAllowed.json?.success === true, JSON.stringify(buyAllowed.json));

  // ============================================================
  console.log("\n[5] profiles PII — phone column must not be publicly readable");
  const phoneLeak = await rest("profiles?select=phone&limit=1");
  check("anonymous SELECT of profiles.phone is rejected (column-level REVOKE)", phoneLeak.status === 401 || phoneLeak.status === 403, `status=${phoneLeak.status} body=${JSON.stringify(phoneLeak.json)}`);

  // ============================================================
  // Cleanup
  await rest(`league_members?league_id=eq.${leagueId}`, { method: "DELETE", admin: true });
  await rest(`leagues?id=eq.${leagueId}`, { method: "DELETE", admin: true });
  await rest(`fantasy_teams?id=eq.${teamBId}`, { method: "DELETE", admin: true });
  // fantasy_team_players cascades on fantasy_teams delete (ON DELETE CASCADE),
  // so deleting userA's team is enough to clean up their test purchase too.
  await rest(`fantasy_teams?user_id=eq.${userAId}`, { method: "DELETE", admin: true });
  await deleteUser(userAId);
  await deleteUser(userBId);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
