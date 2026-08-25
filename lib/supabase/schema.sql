-- =============================================
-- AFRICA FANTASY — SUPABASE SCHEMA
-- =============================================
-- Independent, all-clubs fantasy sports platform covering football,
-- cricket and rugby. Not affiliated with ZIFA, the Premier Soccer League,
-- Zimbabwe Cricket, Zimbabwe Rugby Union, or any real club — but the club,
-- competition and player-nickname data below reference real Zimbabwean
-- clubs and competitions where legally permitted (see Terms of Service
-- Section 6). Run this file in the Supabase SQL editor first, then
-- scoring.sql, then achievements.sql.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROFILES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'manager', 'moderator', 'admin')),
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  fantasy_points INTEGER DEFAULT 0,
  phone TEXT,
  favorite_player TEXT,
  supporter_branch TEXT,
  bio TEXT,
  -- Captured at onboarding so day-one navigation/defaults (e.g. which sport
  -- tab Predictions opens on) reflect what the user actually follows,
  -- instead of defaulting everyone into a football-first view.
  interested_sports TEXT[] DEFAULT ARRAY['football']::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Phone is PII collected only for the owning user's own account — never
-- exposed on the public profile read. See "Users can insert/update own
-- profile" above for how the owner still reads/writes their own row
-- (column grants don't affect a function's SECURITY DEFINER context, and
-- the owner reads their own row through the app's authenticated client
-- using an explicit column list that excludes phone from other users).
--
-- A plain "REVOKE SELECT (phone) ... FROM anon, authenticated" does NOT
-- work on its own and was confirmed live to leak every user's phone number
-- to a fully anonymous request: Supabase grants table-level
-- "GRANT SELECT ON ALL TABLES IN SCHEMA public" to anon/authenticated by
-- default, and a column-level REVOKE cannot narrow a privilege that was
-- granted at the table level — the broader table grant still wins. The
-- table-level SELECT has to be revoked first, then re-granted only for the
-- safe columns.
REVOKE SELECT ON profiles FROM anon, authenticated;
GRANT SELECT (id, username, full_name, avatar_url, role, xp, level, fantasy_points,
  favorite_player, supporter_branch, bio, interested_sports, created_at, updated_at) ON profiles TO anon, authenticated;
GRANT SELECT ON profiles TO service_role;

-- The RLS policies above gate WHICH ROW (your own), not which COLUMNS of
-- it — Supabase's default table-level INSERT/UPDATE grants to
-- `authenticated` covered every column, including role, xp, level, and
-- fantasy_points. Confirmed live: any authenticated user could
-- PATCH .../profiles?id=eq.<their own id> with {"role":"admin"} and
-- instantly become admin, completely bypassing every server-action role
-- check in the app (all of which just re-read this same column). Same
-- REVOKE-then-narrow-GRANT pattern as the SELECT fix above. INSERT is
-- revoked entirely rather than narrowed — no client code anywhere inserts
-- into profiles directly; account creation is exclusively the
-- on_auth_user_created trigger, which is SECURITY DEFINER and doesn't need
-- this grant regardless.
REVOKE INSERT, UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, favorite_player, supporter_branch, bio, interested_sports)
  ON profiles TO authenticated;

-- =============================================
-- TEAMS TABLE — canonical list of real Zimbabwean clubs
-- =============================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL, -- official club name, e.g. "Highlanders FC"
  short_name TEXT NOT NULL,
  -- fan nickname, e.g. "Bosso" — real and verified, but secondary to the
  -- official name above (see docs/test-data.md for the full mapping and
  -- how this was verified). NULL where a club has no separate nickname.
  nickname TEXT,
  city TEXT,
  primary_color TEXT DEFAULT '#15803D',
  crest_url TEXT,
  sport TEXT NOT NULL DEFAULT 'football' CHECK (sport IN ('football', 'cricket', 'rugby')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, sport)
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teams viewable by everyone" ON teams FOR SELECT USING (true);
CREATE POLICY "admin_write_teams" ON teams FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY (ARRAY['admin', 'manager']))
);

-- =============================================
-- PLAYERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
  club TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 5000000,
  image_url TEXT,
  total_points INTEGER DEFAULT 0,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  clean_sheets INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  minutes_played INTEGER DEFAULT 0,
  ownership_percent DECIMAL(5,2) DEFAULT 0,
  form DECIMAL(4,2) DEFAULT 5.0,
  is_injured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players are viewable by everyone" ON players FOR SELECT USING (true);
CREATE POLICY "admin_write_players" ON players FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY (ARRAY['admin', 'manager']))
);

-- =============================================
-- FANTASY TEAMS TABLE (a user's fantasy squad)
-- =============================================
CREATE TABLE IF NOT EXISTS fantasy_teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  team_name TEXT NOT NULL,
  formation TEXT DEFAULT '4-3-3' CHECK (formation IN ('4-3-3', '4-4-2', '3-5-2', '5-3-2')),
  total_points INTEGER DEFAULT 0,
  weekly_points INTEGER DEFAULT 0,
  budget_remaining INTEGER DEFAULT 100000000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE fantasy_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fantasy teams viewable by everyone" ON fantasy_teams FOR SELECT USING (true);
CREATE POLICY "Users manage own team" ON fantasy_teams FOR ALL USING (auth.uid() = user_id);

-- The USING clause above legitimately lets a user touch their own row —
-- the table-level grant is what needs narrowing, or "their own row"
-- includes budget_remaining/total_points/weekly_points, which should only
-- ever move through save_fantasy_team/buy_player/sell_player/
-- recalculate_*_team_points (all SECURITY DEFINER, none of which need this
-- grant). Confirmed live: a direct PATCH to /fantasy_teams could set
-- budget_remaining to anything before this fix. The one legitimate direct-
-- client write left in the app is the Market page's upsert-a-team-on-
-- first-visit (user_id, team_name, formation only).
REVOKE INSERT, UPDATE ON fantasy_teams FROM authenticated;
GRANT INSERT (user_id, team_name, formation) ON fantasy_teams TO authenticated;
-- user_id is included here too, not just team_name/formation — the
-- Market page's upsert (ON CONFLICT (user_id) DO UPDATE) puts every column
-- from its payload into the generated UPDATE's SET list, user_id included,
-- even though its value never actually changes. RLS's WITH CHECK (implicit
-- auth.uid() = user_id, same as USING) still blocks pointing the row at
-- anyone else regardless of this grant.
GRANT UPDATE (user_id, team_name, formation) ON fantasy_teams TO authenticated;

-- =============================================
-- FANTASY TEAM PLAYERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS fantasy_team_players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  fantasy_team_id UUID REFERENCES fantasy_teams(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  is_captain BOOLEAN DEFAULT FALSE,
  is_vice_captain BOOLEAN DEFAULT FALSE,
  is_starting BOOLEAN DEFAULT TRUE,
  bench_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fantasy_team_id, player_id)
);

ALTER TABLE fantasy_team_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team players viewable by everyone" ON fantasy_team_players FOR SELECT USING (true);
CREATE POLICY "Users manage own team players" ON fantasy_team_players FOR ALL USING (
  EXISTS (SELECT 1 FROM fantasy_teams WHERE id = fantasy_team_id AND user_id = auth.uid())
);

-- No client code anywhere in the app writes to this table directly — squad
-- changes only ever go through save_fantasy_team/buy_player/sell_player
-- (all SECURITY DEFINER). Revoked entirely rather than narrowed:
-- confirmed live that before this, a user could INSERT arbitrary
-- (free, unpaid) players into their own squad, exceed the 15-player cap,
-- or mark every player is_captain (stacking the 2x scoring multiplier).
REVOKE INSERT, UPDATE, DELETE ON fantasy_team_players FROM authenticated;

-- =============================================
-- LEAGUES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS leagues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'private' CHECK (type IN ('public', 'private')),
  invite_code TEXT UNIQUE,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  description TEXT,
  max_members INTEGER DEFAULT 20,
  prizes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public leagues viewable by everyone" ON leagues FOR SELECT USING (type = 'public' OR owner_id = auth.uid());
-- Without this, a non-owner MEMBER of a private league couldn't read that
-- league's own row at all — the embedded `leagues(...)` join in
-- refreshMyLeagues() came back null and got filtered out, so /leagues
-- silently omitted any private group you'd joined but didn't own. Found via
-- a user report ("I'm logged in as admin and can't see the private group
-- I'm in") that turned out to affect every non-owner member, not just admin.
CREATE POLICY "Members can view their leagues" ON leagues FOR SELECT USING (
  EXISTS (SELECT 1 FROM league_members WHERE league_members.league_id = leagues.id AND league_members.user_id = auth.uid())
);
CREATE POLICY "Authenticated users create leagues" ON leagues FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update leagues" ON leagues FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Admins update any league" ON leagues FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Owners delete leagues" ON leagues FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Admins delete any league" ON leagues FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- LEAGUE MEMBERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS league_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  points INTEGER DEFAULT 0,
  weekly_points INTEGER DEFAULT 0,
  rank INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- "viewable by members" means exactly that, not USING(true). A flat
-- USING(true) here was confirmed exploitable — a fully anonymous,
-- unauthenticated request with only the public anon key returned every
-- league's membership (user_id, points, rank) for every league, private or
-- public, defeating the private-league privacy model entirely (leagues.
-- SELECT already correctly hides private league metadata from non-members;
-- this table was the leak). The app only ever reads this table scoped to
-- leagues the caller already belongs to, so restricting to fellow-members
-- breaks no legitimate flow.
--
-- The membership check has to go through a SECURITY DEFINER function rather
-- than an inline EXISTS subquery on league_members itself — a policy that
-- queries its own table directly re-triggers that same policy for the
-- subquery, and Postgres refuses with "infinite recursion detected in
-- policy for relation league_members" rather than resolving it. Running the
-- check inside a SECURITY DEFINER function sidesteps this: that inner query
-- executes with the function's own privileges, not subject to the RLS
-- policy being evaluated, so there's nothing to recurse into.
-- Known limitation: an INSERT ... RETURNING (PostgREST's Prefer:
-- return=representation) fails RLS here even for the row's own owner,
-- because the SELECT-policy re-check inside RETURNING doesn't see the row
-- this same command just inserted through a SECURITY DEFINER function call.
-- A plain INSERT (no RETURNING) and any subsequent SELECT both work
-- correctly — confirmed live. Not a functional issue in practice: every
-- league_members insert in this app (createLeague, joinLeague,
-- joinPublicLeague) already omits .select(), so none of them hit this path.
-- If a future caller needs the inserted row back, re-fetch it in a second
-- request rather than chaining .select() on the insert.
CREATE OR REPLACE FUNCTION is_league_member(p_league_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (SELECT 1 FROM league_members WHERE league_id = p_league_id AND user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION is_league_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_league_member(UUID) TO authenticated;

CREATE POLICY "League members viewable by members" ON league_members FOR SELECT USING (
  is_league_member(league_id)
);
-- The original version of this policy checked only auth.uid() = user_id —
-- nothing about the target league at all. Since league ids are UUIDs
-- leaked via URLs/screenshots rather than secrets, and the app's own
-- invite-code check lived only in the joinLeague() server action (never
-- enforced at this layer), any authenticated user could INSERT a
-- membership row for ANY league — private ones included, no invite code
-- needed — confirmed live via a direct PostgREST call. Direct insert now
-- only works for genuinely public leagues; private-league joins go through
-- join_private_league() below, which validates the invite code itself
-- (SECURITY DEFINER, so it doesn't need this policy to pass).
-- Also allows the league's own OWNER to insert their own membership row
-- directly — createLeague() does exactly this immediately after creating a
-- brand-new PRIVATE league, so a policy that only allowed public leagues
-- would leave every new group's creator unable to join their own group.
CREATE POLICY "Users join public leagues or their own directly" ON league_members FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    EXISTS (SELECT 1 FROM leagues WHERE id = league_id AND type = 'public')
    OR EXISTS (SELECT 1 FROM leagues WHERE id = league_id AND owner_id = auth.uid())
  )
);
CREATE POLICY "Users leave leagues" ON league_members FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION join_private_league(p_invite_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user UUID := auth.uid();
  v_league RECORD;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'not authenticated'); END IF;

  SELECT id, name, type INTO v_league FROM leagues WHERE invite_code = upper(trim(p_invite_code));
  IF v_league.id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unable to join league. Please check the invite code.');
  END IF;

  INSERT INTO league_members (league_id, user_id) VALUES (v_league.id, v_user)
  ON CONFLICT (league_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'league_id', v_league.id, 'league_name', v_league.name, 'league_type', v_league.type);
END;
$$;

GRANT EXECUTE ON FUNCTION join_private_league(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION join_private_league(TEXT) FROM PUBLIC, anon;

-- points/weekly_points/rank should never be client-settable — only
-- recalculate_matchday_team_points writes them, and it's SECURITY DEFINER
-- (see scoring.sql), so it doesn't need this grant either. Confirmed live:
-- before this, any member could PATCH their own league_members row and
-- set points/rank to anything, corrupting a group's leaderboard directly.
REVOKE INSERT, UPDATE ON league_members FROM authenticated;
GRANT INSERT (league_id, user_id) ON league_members TO authenticated;

-- =============================================
-- MATCHES TABLE — fixtures between any two clubs
-- =============================================
CREATE TABLE IF NOT EXISTS matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  kickoff_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished', 'postponed')),
  matchday INTEGER DEFAULT 1,
  season TEXT DEFAULT '2026',
  sport TEXT NOT NULL DEFAULT 'football' CHECK (sport IN ('football', 'cricket', 'rugby')),
  -- Set once send_prediction_reminders() has notified users this match's
  -- predictions are closing soon, so the scheduled job doesn't re-notify
  -- everyone every time it runs.
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches viewable by everyone" ON matches FOR SELECT USING (true);
CREATE POLICY "admin_write_matches" ON matches FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY (ARRAY['admin', 'manager']))
);

-- =============================================
-- PLAYER MATCH STATS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS player_match_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  yellow_cards INTEGER DEFAULT 0,
  red_cards INTEGER DEFAULT 0,
  clean_sheet BOOLEAN DEFAULT FALSE,
  minutes_played INTEGER DEFAULT 0,
  fantasy_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, match_id)
);

ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stats viewable by everyone" ON player_match_stats FOR SELECT USING (true);
CREATE POLICY "Admins manage player stats" ON player_match_stats FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY (ARRAY['admin', 'manager']))
);

-- =============================================
-- MATCH EVENTS TABLE — live event log for a fixture
-- =============================================
-- `side` records which team's player the event belongs to. For a 'goal'
-- that side's team scores; for an 'own_goal' the OTHER side's team scores.
-- This lets the same event log describe any fixture between any two
-- clubs, with no assumption about which club is "ours".
CREATE TABLE IF NOT EXISTS match_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('goal', 'own_goal', 'assist', 'yellow_card', 'red_card')),
  side TEXT NOT NULL CHECK (side IN ('home', 'away')),
  minute INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Match events viewable by everyone" ON match_events FOR SELECT USING (true);
CREATE POLICY "admin_write_match_events" ON match_events FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY (ARRAY['admin', 'manager']))
);

-- =============================================
-- CHAT MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  reactions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat messages viewable by everyone" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users send messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON chat_messages FOR DELETE USING (auth.uid() = user_id);

-- The DELETE policy above only ever let someone remove their OWN message —
-- there was no way for anyone to enforce the Terms of Service's ban on
-- abusive chat content short of asking the poster to delete it themselves.
-- An RPC (not a second RLS policy) so the role check is unambiguous and in
-- one place, and moderator's first real, distinct capability — previously
-- assignable via Admin > Users but granted nothing anywhere.
CREATE OR REPLACE FUNCTION moderate_delete_chat_message(p_message_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'not authenticated'); END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user AND role IN ('admin', 'moderator')) THEN
    RETURN jsonb_build_object('error', 'not authorized');
  END IF;

  DELETE FROM chat_messages WHERE id = p_message_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'message not found'); END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION moderate_delete_chat_message(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION moderate_delete_chat_message(UUID) FROM PUBLIC, anon;

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'system' CHECK (type IN ('match', 'transfer', 'goal', 'league', 'reward', 'system', 'prediction')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_insert_notifications" ON notifications FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- `read` (marking a notification as seen) is the only field a user should
-- ever change on their own notification — title/body/type/user_id were
-- all directly writable too, letting a user rewrite their own notification
-- history's content.
REVOKE UPDATE ON notifications FROM authenticated;
GRANT UPDATE (read) ON notifications TO authenticated;

-- =============================================
-- ACHIEVEMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  badge_key TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT NOT NULL,
  badge_icon TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_key)
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievements viewable by everyone" ON achievements FOR SELECT USING (true);

-- Small, no-role-check XP grant for a user's own routine actions (voting on
-- a poll, creating one, a correct prediction). Deliberately separate from
-- grant_xp() in achievements.sql, which stays admin/manager-only on
-- purpose (see its comment) — this one is for the caller's OWN account
-- only and is never exposed directly to PostgREST, so it can't be used to
-- self-boost by naming an arbitrary target user or an arbitrary amount.
CREATE OR REPLACE FUNCTION _grant_xp_unchecked(p_user_id UUID, p_xp INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_xp    INTEGER;
  v_level INTEGER;
  v_threshold INTEGER;
BEGIN
  SELECT xp, level INTO v_xp, v_level FROM profiles WHERE id = p_user_id;
  v_xp    := COALESCE(v_xp, 0) + GREATEST(p_xp, 0);
  v_level := COALESCE(v_level, 1);

  LOOP
    v_threshold := v_level * 1000;
    EXIT WHEN v_xp < v_threshold OR v_level >= 10;
    v_xp    := v_xp - v_threshold;
    v_level := v_level + 1;
    INSERT INTO notifications (user_id, title, body, type)
    VALUES (p_user_id, 'Level Up! ' || v_level || ' 🎉', 'You reached Level ' || v_level || '!', 'reward');
  END LOOP;

  UPDATE profiles SET xp = v_xp, level = v_level WHERE id = p_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION _grant_xp_unchecked(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

-- =============================================
-- POLLS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS polls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  votes JSONB NOT NULL DEFAULT '{}',
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  -- NULL = a global/admin poll (visible to everyone, as before). Non-null =
  -- a poll created by a group member, scoped to that league/group only.
  league_id UUID REFERENCES leagues(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
-- Global polls (league_id NULL) stay visible to everyone, same as before.
-- Group polls are only visible to that group's members — a private friend
-- group's poll shouldn't leak to the whole platform.
CREATE POLICY "Polls viewable by everyone or group members" ON polls FOR SELECT USING (
  league_id IS NULL OR is_league_member(league_id)
);
CREATE POLICY "Admins manage polls" ON polls FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Group polls are created through create_group_poll() below (not a direct
-- INSERT), but the poll's OWN creator and the group's owner can delete a
-- group poll directly — basic moderation without needing an admin.
CREATE POLICY "Creator or group owner deletes group poll" ON polls FOR DELETE USING (
  league_id IS NOT NULL AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM leagues WHERE id = league_id AND owner_id = auth.uid())
  )
);

-- One-vote-per-user ledger — votes are only ever recorded through
-- cast_poll_vote() below, never via a direct client UPDATE on polls.votes.
CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  poll_id UUID REFERENCES polls(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  option TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, user_id)
);

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own votes" ON poll_votes FOR SELECT USING (auth.uid() = user_id);

-- Voting again with a different option CHANGES the vote (moves the tally
-- from the old option to the new one) rather than being rejected — users
-- asked for this. Re-picking the same option is a no-op. Changing a vote
-- does NOT grant another +5 XP (only a genuinely first vote does), so
-- flipping a pick back and forth can't be used to farm XP.
CREATE OR REPLACE FUNCTION cast_poll_vote(p_poll_id UUID, p_option TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_existing TEXT;
  v_votes    JSONB;
  v_new      JSONB;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not authenticated'); END IF;

  -- The admin panel's "Fan Polls" toggle only ever hid the voting UI
  -- client-side — this RPC never checked it itself.
  IF (SELECT (value->>'polls')::boolean FROM app_config WHERE key = 'feature_flags') IS FALSE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'polls are currently disabled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM polls WHERE id = p_poll_id AND options ? p_option) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid option');
  END IF;

  SELECT option INTO v_existing FROM poll_votes WHERE poll_id = p_poll_id AND user_id = v_user;

  IF v_existing IS NOT NULL AND v_existing = p_option THEN
    SELECT votes INTO v_votes FROM polls WHERE id = p_poll_id;
    RETURN jsonb_build_object('ok', true, 'votes', v_votes, 'choice', p_option, 'changed', false);
  END IF;

  SELECT votes INTO v_votes FROM polls WHERE id = p_poll_id;
  v_new := COALESCE(v_votes, '{}'::jsonb);

  IF v_existing IS NOT NULL THEN
    v_new := jsonb_set(v_new, ARRAY[v_existing], to_jsonb(GREATEST(0, COALESCE((v_new ->> v_existing)::int, 0) - 1)));
  END IF;

  v_new := jsonb_set(v_new, ARRAY[p_option], to_jsonb(COALESCE((v_new ->> p_option)::int, 0) + 1));

  IF v_existing IS NOT NULL THEN
    UPDATE poll_votes SET option = p_option WHERE poll_id = p_poll_id AND user_id = v_user;
  ELSE
    INSERT INTO poll_votes (poll_id, user_id, option) VALUES (p_poll_id, v_user, p_option);
  END IF;

  UPDATE polls SET votes = v_new WHERE id = p_poll_id;

  -- Small XP nudge for voting — ties polls into the same points/XP economy
  -- as everything else instead of being disconnected from it. Inlined
  -- rather than calling grant_xp() because that function is deliberately
  -- restricted to admin/manager callers (see its own comment) — a regular
  -- user voting on their own poll can't go through it. Only a genuinely
  -- first vote grants it — see the function's header comment.
  IF v_existing IS NULL THEN
    PERFORM _grant_xp_unchecked(v_user, 5);
  END IF;

  RETURN jsonb_build_object('ok', true, 'votes', v_new, 'choice', p_option, 'changed', v_existing IS NOT NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION cast_poll_vote(UUID, TEXT) TO authenticated;

-- Group members create their own polls — the platform doesn't need to be
-- the only source of polls, a friend group can run its own. Deliberately
-- an RPC (not a raw INSERT policy) so spam limits and validation live in
-- one enforced place rather than trusting the client.
CREATE OR REPLACE FUNCTION create_group_poll(p_league_id UUID, p_question TEXT, p_options TEXT[])
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_question  TEXT;
  v_options   JSONB;
  v_open_count INTEGER;
  v_poll_id   UUID;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not authenticated'); END IF;

  IF (SELECT (value->>'polls')::boolean FROM app_config WHERE key = 'feature_flags') IS FALSE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'polls are currently disabled');
  END IF;

  IF NOT is_league_member(p_league_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not a member of this group');
  END IF;

  v_question := trim(p_question);
  IF v_question = '' OR length(v_question) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'question must be 1-200 characters');
  END IF;

  IF array_length(p_options, 1) IS NULL OR array_length(p_options, 1) < 2 OR array_length(p_options, 1) > 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'polls need between 2 and 6 options');
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_options) o WHERE trim(o) = '' OR length(o) > 60) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'each option must be 1-60 characters');
  END IF;

  -- Cap open (unexpired) polls per group so one member can't spam the feed.
  SELECT count(*) INTO v_open_count FROM polls
  WHERE league_id = p_league_id AND (expires_at IS NULL OR expires_at > NOW());
  IF v_open_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'this group already has 5 open polls — wait for one to expire');
  END IF;

  SELECT jsonb_agg(trim(o)) INTO v_options FROM unnest(p_options) o;

  INSERT INTO polls (question, options, league_id, created_by, expires_at)
  VALUES (v_question, v_options, p_league_id, v_user, NOW() + INTERVAL '3 days')
  RETURNING id INTO v_poll_id;

  PERFORM _grant_xp_unchecked(v_user, 10);
  PERFORM award_achievements(v_user);

  RETURN jsonb_build_object('ok', true, 'poll_id', v_poll_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_group_poll(UUID, TEXT, TEXT[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION create_group_poll(UUID, TEXT, TEXT[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION cast_poll_vote(UUID, TEXT) FROM PUBLIC, anon;

-- =============================================
-- SCORE PREDICTIONS TABLE — lightweight game mode for users who don't want
-- to manage a full fantasy squad: predict a match's final score, earn points
-- based on accuracy once the match finishes. See scoring.sql for the points
-- formula and the score_predictions_for_match/reverse_predictions_for_match
-- functions the admin panel calls when a match is finished/reopened.
-- =============================================
CREATE TABLE IF NOT EXISTS score_predictions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  predicted_home_score INTEGER NOT NULL CHECK (predicted_home_score BETWEEN 0 AND 999),
  predicted_away_score INTEGER NOT NULL CHECK (predicted_away_score BETWEEN 0 AND 999),
  points_earned INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, match_id)
);

ALTER TABLE score_predictions ENABLE ROW LEVEL SECURITY;

-- Your own predictions are always visible to you (so you can see/edit them
-- before kickoff). Other users' predictions only become visible once the
-- match has kicked off — hiding them beforehand stops copying picks.
CREATE POLICY "own or post-kickoff predictions viewable" ON score_predictions FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM matches WHERE id = match_id AND status IN ('live', 'finished'))
);
CREATE POLICY "admin_write_predictions" ON score_predictions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY (ARRAY['admin', 'manager']))
);
-- Deliberately no direct INSERT/UPDATE policy for regular users — writes go
-- through submit_score_prediction below, which enforces the feature flag and
-- the kickoff cutoff server-side (the same reason cast_poll_vote above and
-- the transfer RPCs in scoring.sql exist as RPCs rather than raw table
-- writes: a client-side-only gate is trivially bypassed via direct RPC/REST
-- calls, so the check has to live in the function itself).

CREATE OR REPLACE FUNCTION submit_score_prediction(p_match_id UUID, p_home_score INT, p_away_score INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_status TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not authenticated'); END IF;

  IF (SELECT (value->>'scorePredictions')::boolean FROM app_config WHERE key = 'feature_flags') IS FALSE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'score predictions are currently disabled');
  END IF;

  -- Upper bound is 999, not football's old 0-20 range — cricket run totals
  -- (150-250+) and rugby point margins can both comfortably exceed 20.
  IF p_home_score IS NULL OR p_away_score IS NULL OR p_home_score < 0 OR p_home_score > 999 OR p_away_score < 0 OR p_away_score > 999 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid score');
  END IF;

  SELECT status INTO v_status FROM matches WHERE id = p_match_id;
  IF v_status IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'match not found'); END IF;
  IF v_status <> 'scheduled' THEN RETURN jsonb_build_object('ok', false, 'error', 'predictions are closed for this match'); END IF;

  INSERT INTO score_predictions (user_id, match_id, predicted_home_score, predicted_away_score)
  VALUES (v_user, p_match_id, p_home_score, p_away_score)
  ON CONFLICT (user_id, match_id) DO UPDATE
    SET predicted_home_score = EXCLUDED.predicted_home_score,
        predicted_away_score = EXCLUDED.predicted_away_score,
        updated_at = NOW();

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_score_prediction(UUID, INT, INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION submit_score_prediction(UUID, INT, INT) FROM PUBLIC, anon;

-- =============================================
-- APP CONFIG TABLE — feature flags
-- =============================================
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config viewable by everyone" ON app_config FOR SELECT USING (true);
CREATE POLICY "admin_write_config" ON app_config FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

INSERT INTO app_config (key, value) VALUES (
  'feature_flags',
  '{"liveScoring":true,"transferWindow":true,"chat":true,"polls":true,"leagueCreation":true,"notifications":true,"marketplace":true,"achievements":true,"fantasyTeams":true,"scorePredictions":true}'
) ON CONFLICT (key) DO NOTHING;

-- =============================================
-- USER SETTINGS TABLE
-- =============================================
-- notifications/display are JSONB, keyed per-toggle (see Settings page's
-- DEFAULT_SETTINGS for the exact keys) rather than one column per
-- preference — the frontend was always built against this richer shape;
-- an earlier flat-boolean version of this table (email_notifications,
-- push_notifications, marketing_emails) never matched what the app
-- actually queried, so every Settings save silently failed.
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  notifications JSONB NOT NULL DEFAULT
    '{"matchReminders":true,"predictionReminders":true,"transferDeadlines":true,"goalAlerts":true,"groupInvites":true,"rewardUnlocks":true,"weeklyDigest":true}'::jsonb,
  display JSONB NOT NULL DEFAULT
    '{"compactMode":false,"showAnimations":true,"showPlayerImages":true,"showFormGuide":true}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);

-- Makes every notification-generating trigger/function respect the
-- recipient's preferences automatically, rather than requiring each one
-- (15+ call sites across this file, scoring.sql and achievements.sql) to
-- remember to check user_settings itself.
CREATE OR REPLACE FUNCTION filter_notification_by_preference()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_prefs JSONB;
  v_key   TEXT;
BEGIN
  v_key := CASE NEW.type
    WHEN 'reward'     THEN 'rewardUnlocks'
    WHEN 'prediction' THEN 'predictionReminders'
    WHEN 'match'      THEN 'matchReminders'
    WHEN 'transfer'   THEN 'transferDeadlines'
    WHEN 'goal'       THEN 'goalAlerts'
    WHEN 'league'     THEN 'groupInvites'
    ELSE NULL -- 'system' and anything unmapped always sends, same as a
              -- transactional/account-critical message would
  END;

  IF v_key IS NULL THEN RETURN NEW; END IF;

  SELECT notifications INTO v_prefs FROM user_settings WHERE user_id = NEW.user_id;

  IF v_prefs IS NULL OR NOT (v_prefs ? v_key) OR (v_prefs ->> v_key)::boolean IS TRUE THEN
    RETURN NEW;
  END IF;

  RETURN NULL; -- preference explicitly off — suppress the insert
END;
$$;

DROP TRIGGER IF EXISTS trg_filter_notification_preference ON notifications;
CREATE TRIGGER trg_filter_notification_preference
  BEFORE INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION filter_notification_by_preference();

-- =============================================
-- RATE LIMITING TABLES — service-role only, no anon/authenticated policies
-- =============================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_time ON login_attempts (identifier, created_at);
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS signup_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_time ON signup_attempts (ip_address, created_at);
ALTER TABLE signup_attempts ENABLE ROW LEVEL SECURITY;

-- =============================================
-- REALTIME SUBSCRIPTIONS
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE player_match_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE match_events;
ALTER PUBLICATION supabase_realtime ADD TABLE fantasy_teams;

-- =============================================
-- SEED DATA — the 18 real 2026 Castle Lager PSL clubs, by their official
-- registered name, with each club's real fan nickname carried separately in
-- `nickname` (verified via web search 2026-08-24 against current PSL squad/
-- fixture sources — see docs/test-data.md). Players carry NO real names —
-- every player is seeded as "#{squad number}" only, position and club only.
--
-- 13 of the 18 clubs below use REAL current squad jersey numbers, researched
-- 2026-08-24 from Transfermarkt/FM26 community squad data and cross-checked
-- against current Castle Lager PSL standings — no player names were kept,
-- only number + broad position (GK/DEF/MID/FWD). Coverage is uneven because
-- Zimbabwean PSL squads are poorly digitized online: some clubs (Scottland
-- FC, ZPC Kariba FC, TelOne FC, Triangle United FC) have 20+ verified
-- numbers, others (Chicken Inn FC, Bulawayo Chiefs FC) have only 1. Treat
-- this as a best-effort real subset, not a claim of squad completeness.
--
-- The remaining 5 clubs (Hardrock FC, Herentals FC, Ngezi Platinum Stars
-- FC, MWOS FC, Agama FC) had NO publicly findable jersey-number data at
-- all — these keep the original illustrative 14-slot template (2 GK, 4
-- DEF, 4 MID, 4 FWD, ordinary football numbering conventions) and are NOT
-- real squad numbers. See LEGAL.md before broadening any of this to real
-- player names.
-- =============================================

INSERT INTO teams (name, nickname, short_name, city, primary_color) VALUES
  ('Scottland FC',            'Scottland',        'SCO', 'Harare',        '#15803D'),
  ('Hardrock FC',              'Golden Boys',      'HRK', 'Kwekwe',        '#CA8A04'),
  ('Dynamos FC',                'DeMbare',          'DYN', 'Harare',        '#1D4ED8'),
  ('Herentals FC',             'Vabvamburi',       'HER', 'Harare',        '#0F766E'),
  ('Ngezi Platinum Stars FC',  'Ngezi Platinum',   'NPS', 'Ngezi',         '#7E22CE'),
  ('CAPS United FC',           'Makepekepe',       'CAP', 'Harare',        '#15803D'),
  ('Highlanders FC',            'Bosso',            'HIG', 'Bulawayo',      '#0F172A'),
  ('MWOS FC',                   'The Punters',      'MWO', 'Norton',        '#B91C1C'),
  ('Simba Bhora FC',           'Simba Bhora',      'SIM', 'Shamva',        '#CA8A04'),
  ('Chicken Inn FC',            'Gamecocks',        'CHI', 'Bulawayo',      '#DC2626'),
  ('FC Platinum',               NULL,               'FCP', 'Zvishavane',    '#1D4ED8'),
  ('Bulawayo Chiefs FC',       'Amakhosi',         'BCH', 'Bulawayo',      '#000000'),
  ('ZPC Kariba FC',             'ZPC Kariba',       'ZPC', 'Kariba',        '#0369A1'),
  ('FC Hunters',                'Hunters',          'HUN', 'Marondera',     '#166534'),
  ('Agama United FC',           'Agama',            'AGU', 'Mount Darwin',  '#B45309'),
  ('TelOne FC',                 'WiFi Boys',        'TEL', 'Harare',        '#2563EB'),
  ('Manica Diamonds FC',       'Gem Boys',         'MAN', 'Mutare',        '#059669'),
  ('Triangle United FC',       'Sugar Sugar Boyz', 'TRI', 'Triangle',      '#EA580C')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  -- Real verified squad numbers per club, 'ClubName|POS:NUM,POS:NUM,...'.
  -- Researched 2026-08-24 (see header comment above for sourcing/caveats).
  v_real_rosters TEXT[] := ARRAY[
    'Scottland FC|GK:1,GK:16,DEF:3,DEF:4,DEF:5,DEF:18,DEF:21,DEF:22,DEF:23,DEF:24,MID:6,MID:13,MID:14,MID:15,MID:25,MID:44,MID:55,MID:74,FWD:7,FWD:8,FWD:9,FWD:10,FWD:11,FWD:12,FWD:17,FWD:19,FWD:20,FWD:26,FWD:28,FWD:30,FWD:77,FWD:80',
    'Dynamos FC|DEF:5,DEF:21,MID:11,MID:15,FWD:10,FWD:20',
    'CAPS United FC|GK:1,GK:6,GK:30,DEF:12,MID:8,MID:10,MID:13,MID:17,MID:19,MID:36,MID:44,MID:45,MID:89,FWD:3,FWD:9,FWD:24',
    'Highlanders FC|GK:1,DEF:4,MID:7,MID:19,FWD:11,FWD:22',
    'Simba Bhora FC|GK:31,GK:80,DEF:3,DEF:22,MID:6,FWD:17',
    'Chicken Inn FC|FWD:27',
    'FC Platinum|DEF:19,DEF:21,DEF:29,MID:9,MID:11,MID:25,MID:77,FWD:27,FWD:28',
    'Bulawayo Chiefs FC|MID:10',
    'ZPC Kariba FC|GK:26,GK:39,GK:66,DEF:6,DEF:10,DEF:17,DEF:28,DEF:37,DEF:49,MID:5,MID:8,MID:12,MID:13,MID:15,MID:19,MID:22,MID:23,MID:24,MID:45,MID:90,FWD:7,FWD:11,FWD:14,FWD:99',
    'FC Hunters|DEF:3,MID:4,MID:42,FWD:9',
    'TelOne FC|GK:1,GK:43,DEF:3,DEF:4,DEF:6,DEF:12,DEF:19,DEF:21,DEF:23,DEF:31,MID:2,MID:7,MID:11,MID:14,MID:17,MID:18,MID:77,MID:80,FWD:9,FWD:13,FWD:15,FWD:16,FWD:22,FWD:24,FWD:47,FWD:70',
    'Manica Diamonds FC|GK:13,GK:16',
    'Triangle United FC|GK:16,GK:25,GK:31,DEF:2,DEF:4,DEF:7,DEF:12,DEF:14,DEF:15,DEF:26,DEF:32,MID:5,MID:6,MID:13,MID:17,MID:18,MID:19,MID:20,MID:23,MID:27,MID:28,MID:29,MID:30,FWD:1,FWD:8,FWD:9,FWD:10,FWD:11,FWD:22'
  ];
  -- Clubs with no publicly verifiable real squad data — kept on the
  -- original illustrative 14-slot template (2 GK, 4 DEF, 4 MID, 4 FWD).
  v_placeholder_clubs TEXT[] := ARRAY['Hardrock FC','Herentals FC','Ngezi Platinum Stars FC','MWOS FC','Agama United FC'];
  v_slots TEXT[] := ARRAY['GK:1','GK:22','DEF:2','DEF:3','DEF:4','DEF:5','MID:6','MID:7','MID:8','MID:10','FWD:9','FWD:11','FWD:14','FWD:17'];
  v_roster TEXT;
  v_club TEXT;
  v_pairs TEXT[];
  v_pair TEXT;
  v_slot TEXT;
  v_pos TEXT;
  v_num INT;
  v_price INT;
  v_points INT;
  v_goals INT;
  v_assists INT;
  v_cs INT;
  v_form NUMERIC;
BEGIN
  PERFORM setseed(0.73);

  FOREACH v_roster IN ARRAY v_real_rosters LOOP
    v_club := split_part(v_roster, '|', 1);
    v_pairs := string_to_array(split_part(v_roster, '|', 2), ',');
    FOREACH v_pair IN ARRAY v_pairs LOOP
      v_pos := split_part(v_pair, ':', 1);
      v_num := split_part(v_pair, ':', 2)::INT;

      CASE v_pos
        WHEN 'GK' THEN
          v_price   := 4200000 + floor(random() * 1600000)::INT;
          v_points  := 55 + floor(random() * 40)::INT;
          v_goals   := 0;
          v_assists := floor(random() * 2)::INT;
          v_cs      := 3 + floor(random() * 6)::INT;
        WHEN 'DEF' THEN
          v_price   := 4400000 + floor(random() * 1800000)::INT;
          v_points  := 55 + floor(random() * 35)::INT;
          v_goals   := floor(random() * 3)::INT;
          v_assists := floor(random() * 4)::INT;
          v_cs      := 2 + floor(random() * 6)::INT;
        WHEN 'MID' THEN
          v_price   := 5500000 + floor(random() * 3000000)::INT;
          v_points  := 70 + floor(random() * 55)::INT;
          v_goals   := 1 + floor(random() * 6)::INT;
          v_assists := 2 + floor(random() * 9)::INT;
          v_cs      := floor(random() * 2)::INT;
        ELSE -- FWD
          v_price   := 6000000 + floor(random() * 5500000)::INT;
          v_points  := 75 + floor(random() * 95)::INT;
          v_goals   := 3 + floor(random() * 16)::INT;
          v_assists := 2 + floor(random() * 7)::INT;
          v_cs      := 0;
      END CASE;

      v_form := round((5.5 + random() * 4.3)::NUMERIC, 1);

      INSERT INTO players (name, position, club, price, total_points, goals, assists, clean_sheets, form)
      VALUES ('#' || v_num, v_pos, v_club, v_price, v_points, v_goals, v_assists, v_cs, v_form);
    END LOOP;
  END LOOP;

  FOREACH v_club IN ARRAY v_placeholder_clubs LOOP
    FOREACH v_slot IN ARRAY v_slots LOOP
      v_pos := split_part(v_slot, ':', 1);
      v_num := split_part(v_slot, ':', 2)::INT;

      CASE v_pos
        WHEN 'GK' THEN
          v_price   := 4200000 + floor(random() * 1600000)::INT;
          v_points  := 55 + floor(random() * 40)::INT;
          v_goals   := 0;
          v_assists := floor(random() * 2)::INT;
          v_cs      := 3 + floor(random() * 6)::INT;
        WHEN 'DEF' THEN
          v_price   := 4400000 + floor(random() * 1800000)::INT;
          v_points  := 55 + floor(random() * 35)::INT;
          v_goals   := floor(random() * 3)::INT;
          v_assists := floor(random() * 4)::INT;
          v_cs      := 2 + floor(random() * 6)::INT;
        WHEN 'MID' THEN
          v_price   := 5500000 + floor(random() * 3000000)::INT;
          v_points  := 70 + floor(random() * 55)::INT;
          v_goals   := 1 + floor(random() * 6)::INT;
          v_assists := 2 + floor(random() * 9)::INT;
          v_cs      := floor(random() * 2)::INT;
        ELSE -- FWD
          v_price   := 6000000 + floor(random() * 5500000)::INT;
          v_points  := 75 + floor(random() * 95)::INT;
          v_goals   := 3 + floor(random() * 16)::INT;
          v_assists := 2 + floor(random() * 7)::INT;
          v_cs      := 0;
      END CASE;

      v_form := round((5.5 + random() * 4.3)::NUMERIC, 1);

      INSERT INTO players (name, position, club, price, total_points, goals, assists, clean_sheets, form)
      VALUES ('#' || v_num, v_pos, v_club, v_price, v_points, v_goals, v_assists, v_cs, v_form);
    END LOOP;
  END LOOP;
END $$;

-- Seed fixtures — every club plays exactly once per matchday, paired using
-- well-known real rivalries where one exists (e.g. Highlanders FC vs
-- Dynamos FC — the "Bosso vs DeMbare" derby by nickname).
INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season) VALUES
  ('Highlanders FC',         'Dynamos FC',             NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('CAPS United FC',         'Bulawayo Chiefs FC',     NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Chicken Inn FC',         'Herentals FC',           NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('FC Platinum',            'Ngezi Platinum Stars FC', NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Simba Bhora FC',         'Hardrock FC',            NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('ZPC Kariba FC',          'FC Hunters',             NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Agama United FC',         'TelOne FC',              NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Manica Diamonds FC',     'Triangle United FC',     NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Scottland FC',            'MWOS FC',                NOW() - INTERVAL '14 days', 'finished',  1, '2026'),

  ('Dynamos FC',              'CAPS United FC',         NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Bulawayo Chiefs FC',     'Chicken Inn FC',         NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Herentals FC',           'FC Platinum',            NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Ngezi Platinum Stars FC', 'Simba Bhora FC',         NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Hardrock FC',             'ZPC Kariba FC',          NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('FC Hunters',              'Agama United FC',         NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('TelOne FC',               'Manica Diamonds FC',     NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Triangle United FC',     'Scottland FC',            NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('MWOS FC',                 'Highlanders FC',         NOW() - INTERVAL '7 days',  'finished',  2, '2026'),

  ('Highlanders FC',         'Bulawayo Chiefs FC',     NOW() + INTERVAL '2 days',  'scheduled', 3, '2026'),
  ('CAPS United FC',         'Herentals FC',           NOW() + INTERVAL '2 days',  'scheduled', 3, '2026'),
  ('Dynamos FC',              'Ngezi Platinum Stars FC', NOW() + INTERVAL '2 days',  'scheduled', 3, '2026'),
  ('Chicken Inn FC',         'Hardrock FC',            NOW() + INTERVAL '3 days',  'scheduled', 3, '2026'),
  ('FC Platinum',            'FC Hunters',              NOW() + INTERVAL '3 days',  'scheduled', 3, '2026'),
  ('Simba Bhora FC',         'TelOne FC',               NOW() + INTERVAL '3 days',  'scheduled', 3, '2026'),
  ('ZPC Kariba FC',          'Triangle United FC',     NOW() + INTERVAL '3 days',  'scheduled', 3, '2026'),
  ('Agama United FC',         'Scottland FC',            NOW() + INTERVAL '3 days',  'scheduled', 3, '2026'),
  ('Manica Diamonds FC',     'MWOS FC',                 NOW() + INTERVAL '3 days',  'scheduled', 3, '2026')
ON CONFLICT DO NOTHING;

-- =============================================
-- CRICKET & RUGBY — SCORE-PREDICTIONS ONLY (2026-08-24)
--
-- Real Zimbabwean domestic clubs, researched via web search. Deliberately
-- NO players/fantasy-squad tables for either sport yet — cricket has no
-- jersey-number convention (so football's number-only anonymization can't
-- carry over, and using real player names is a bigger legal-policy call than
-- this pass covers) and rugby domestic club rosters aren't publicly
-- findable at scale. Score predictions only need team-vs-team fixtures, not
-- player rosters, so both sports work fully through the existing
-- score_predictions / submit_score_prediction machinery with zero new
-- backend code — see teams.sport / matches.sport above.
--
-- Cricket: the 5 Zimbabwe Cricket domestic franchises (Logan Cup / Pro50 /
-- domestic T20, 2025/26 season) — stable structure, unchanged since ~2016.
-- home_score/away_score are predicted TOTAL RUNS per team (a deliberate
-- simplification of a full innings scorecard, consistent with common
-- run-total prediction formats).
--
-- Rugby: the 8 clubs of Zimbabwe's real, single, unified domestic
-- competition (the National Rugby League, historically nicknamed the
-- "Super Six" from a smaller era) — Harare and Bulawayo/regional clubs
-- play each other directly in one table, confirmed via multiple current
-- match reports (e.g. "Old Miltonians, Mat Warriors lock horns"; "Western
-- Panthers triumph over Gweru Sports Club"). A 2026-08-24 pass had wrongly
-- modeled this as two disjoint provincial leagues that never cross-play,
-- and included four clubs with no verifiable tie to this competition
-- (Bulldogs, Mahogany Bulls, Pitbulls RFC, and Highlanders — confirmed via
-- the ZRU itself to play in a separate "Intercity League") while missing
-- two real member clubs (Gweru Sports Club, Zvishavane Bulls) and
-- mis-naming one ("Western Suburbs Panthers" — the real name is "Western
-- Panthers"). Corrected 2026-08-25 after fresh multi-source verification.
-- home_score/away_score are match points, same as football's goals.
-- =============================================

INSERT INTO teams (name, short_name, city, primary_color, sport) VALUES
  ('Mashonaland Eagles',   'MHE', 'Harare',     '#1D4ED8', 'cricket'),
  ('Mid West Rhinos',      'MWR', 'Kwekwe',     '#B45309', 'cricket'),
  ('Southern Rocks',       'SRK', 'Masvingo',   '#059669', 'cricket'),
  ('Mountaineers',         'MTN', 'Mutare',     '#7E22CE', 'cricket'),
  ('Matabeleland Tuskers', 'MTB', 'Bulawayo',   '#0F172A', 'cricket'),

  ('Harare Sports Club',   'HSC', 'Harare',      '#0369A1', 'rugby'),
  ('Old Georgians',        'OG',  'Harare',      '#15803D', 'rugby'),
  ('Old Hararians',        'OH',  'Harare',      '#DC2626', 'rugby'),
  ('Old Miltonians',       'OM',  'Bulawayo',    '#0F172A', 'rugby'),
  ('Matabeleland Warriors', 'MWA', 'Bulawayo',   '#B91C1C', 'rugby'),
  ('Western Panthers',      'WP',  'Bulawayo',   '#1D4ED8', 'rugby'),
  ('Gweru Sports Club',     'GSC', 'Gweru',      '#EA580C', 'rugby'),
  ('Zvishavane Bulls',      'ZVB', 'Zvishavane', '#7C2D12', 'rugby')
ON CONFLICT DO NOTHING;

-- Cricket fixtures — 5 franchises, one bye per round.
INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season, sport) VALUES
  ('Mashonaland Eagles',   'Mid West Rhinos',      NOW() + INTERVAL '2 days',  'scheduled', 1, '2026', 'cricket'),
  ('Southern Rocks',       'Mountaineers',         NOW() + INTERVAL '2 days',  'scheduled', 1, '2026', 'cricket'),

  ('Matabeleland Tuskers', 'Southern Rocks',       NOW() + INTERVAL '9 days',  'scheduled', 2, '2026', 'cricket'),
  ('Mountaineers',         'Mashonaland Eagles',   NOW() + INTERVAL '9 days',  'scheduled', 2, '2026', 'cricket'),

  ('Mid West Rhinos',      'Matabeleland Tuskers', NOW() + INTERVAL '16 days', 'scheduled', 3, '2026', 'cricket'),
  ('Mashonaland Eagles',   'Southern Rocks',       NOW() + INTERVAL '16 days', 'scheduled', 3, '2026', 'cricket')
ON CONFLICT DO NOTHING;

-- Rugby fixtures — one unified table, single round-robin pairing (circle
-- method) across all 8 clubs, so Harare and Bulawayo/regional sides meet
-- directly, matching the real National Rugby League structure.
INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season, sport) VALUES
  ('Harare Sports Club', 'Zvishavane Bulls',      NOW() + INTERVAL '2 days',  'scheduled', 1, '2026', 'rugby'),
  ('Old Georgians',      'Gweru Sports Club',     NOW() + INTERVAL '2 days',  'scheduled', 1, '2026', 'rugby'),
  ('Old Hararians',      'Western Panthers',      NOW() + INTERVAL '2 days',  'scheduled', 1, '2026', 'rugby'),
  ('Old Miltonians',     'Matabeleland Warriors', NOW() + INTERVAL '2 days',  'scheduled', 1, '2026', 'rugby'),

  ('Harare Sports Club', 'Gweru Sports Club',     NOW() + INTERVAL '9 days',  'scheduled', 2, '2026', 'rugby'),
  ('Zvishavane Bulls',   'Western Panthers',      NOW() + INTERVAL '9 days',  'scheduled', 2, '2026', 'rugby'),
  ('Old Georgians',      'Matabeleland Warriors', NOW() + INTERVAL '9 days',  'scheduled', 2, '2026', 'rugby'),
  ('Old Hararians',      'Old Miltonians',        NOW() + INTERVAL '9 days',  'scheduled', 2, '2026', 'rugby'),

  ('Harare Sports Club', 'Western Panthers',      NOW() + INTERVAL '16 days', 'scheduled', 3, '2026', 'rugby'),
  ('Gweru Sports Club',  'Matabeleland Warriors', NOW() + INTERVAL '16 days', 'scheduled', 3, '2026', 'rugby'),
  ('Zvishavane Bulls',   'Old Miltonians',        NOW() + INTERVAL '16 days', 'scheduled', 3, '2026', 'rugby'),
  ('Old Georgians',      'Old Hararians',         NOW() + INTERVAL '16 days', 'scheduled', 3, '2026', 'rugby')
ON CONFLICT DO NOTHING;

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, avatar_url, phone)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''), split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  -- Requested username already taken: fall back to email prefix + random suffix
  -- rather than failing the signup outright.
  INSERT INTO profiles (id, username, full_name, avatar_url, phone)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1) || '_' || floor(random() * 9000 + 1000)::text,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER fantasy_teams_updated_at
  BEFORE UPDATE ON fantasy_teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- Login identifier resolution (username/phone -> email for sign-in)
-- =============================================
-- SECURITY DEFINER so it can read auth.users; EXECUTE is restricted to
-- service_role only below — never callable directly by anon/authenticated,
-- to avoid turning this into a username/phone -> email enumeration oracle.
-- The server-side login action (lib/actions/auth.ts) is the only caller.
-- Parameter MUST be named "identifier" — lib/actions/auth.ts calls this via
-- admin.rpc("resolve_login_identifier", { identifier: trimmed }), and
-- PostgREST resolves named-JSON RPC args by matching parameter names
-- exactly. A mismatched name (e.g. p_identifier) makes PostgREST return
-- "function not found" for every call, which the caller silently treats as
-- "no such identifier" — breaking username/phone login entirely while
-- leaving email login (which skips this RPC) looking fine.
CREATE OR REPLACE FUNCTION resolve_login_identifier(identifier TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_email TEXT;
  v_clean TEXT;
BEGIN
  IF identifier LIKE '%@%' THEN
    RETURN identifier;
  END IF;

  v_clean := REGEXP_REPLACE(identifier, '[\s\-()]', '', 'g');

  SELECT au.email INTO v_email
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE p.username = identifier
  LIMIT 1;
  IF v_email IS NOT NULL THEN RETURN v_email; END IF;

  SELECT au.email INTO v_email
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE REGEXP_REPLACE(COALESCE(p.phone, ''), '[\s\-()]', '', 'g') = v_clean
  LIMIT 1;
  RETURN v_email;
END;
$$;

REVOKE EXECUTE ON FUNCTION resolve_login_identifier(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION resolve_login_identifier(TEXT) TO service_role;

-- =============================================
-- Atomic chat reaction increments
-- =============================================
CREATE OR REPLACE FUNCTION increment_reaction(p_msg_id UUID, p_emoji TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_reactions JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE chat_messages
  SET reactions = jsonb_set(
    COALESCE(reactions, '{}'::jsonb),
    ARRAY[p_emoji],
    to_jsonb(COALESCE((reactions ->> p_emoji)::int, 0) + 1)
  )
  WHERE id = p_msg_id
  RETURNING reactions INTO v_reactions;

  IF v_reactions IS NULL THEN
    RAISE EXCEPTION 'message not found';
  END IF;

  RETURN v_reactions;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_reaction(UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION increment_reaction(UUID, TEXT) FROM PUBLIC, anon;

-- =============================================
-- Transactional fantasy squad save
-- =============================================
-- Re-validates squad rules server-side: exactly 15 players, exactly 11
-- starters, distinct captain/vice, both inside the squad, total price
-- within the $100.0M budget. Players may come from any club.
CREATE OR REPLACE FUNCTION save_fantasy_team(
  p_team_name TEXT,
  p_formation TEXT,
  p_player_ids UUID[],
  p_captain_id UUID,
  p_vice_captain_id UUID,
  p_starting_ids UUID[]
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user UUID := auth.uid();
  v_team_id UUID;
  v_total_price BIGINT;
  v_budget CONSTANT BIGINT := 100000000;
  v_pid UUID;
  v_order INT := 0;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'not authenticated'); END IF;

  -- Every sibling RPC (buy_player, sell_player, submit_score_prediction,
  -- cast_poll_vote, create_group_poll) checks its own feature flag
  -- server-side; this one didn't, so the "Fantasy Teams" toggle only ever
  -- hid the My Team page's UI, not this RPC.
  IF (SELECT (value->>'fantasyTeams')::boolean FROM app_config WHERE key = 'feature_flags') IS FALSE THEN
    RETURN jsonb_build_object('error', 'Fantasy Teams is currently disabled');
  END IF;

  IF array_length(p_player_ids, 1) IS DISTINCT FROM 15 THEN
    RETURN jsonb_build_object('error', 'Squad must have exactly 15 players');
  END IF;
  IF array_length(p_starting_ids, 1) IS DISTINCT FROM 11 THEN
    RETURN jsonb_build_object('error', 'Starting XI must have exactly 11 players');
  END IF;
  IF p_captain_id = p_vice_captain_id THEN
    RETURN jsonb_build_object('error', 'Captain and vice-captain must be different players');
  END IF;
  IF NOT (p_captain_id = ANY(p_player_ids)) OR NOT (p_vice_captain_id = ANY(p_player_ids)) THEN
    RETURN jsonb_build_object('error', 'Captain and vice-captain must be in the squad');
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_player_ids) x GROUP BY x HAVING count(*) > 1) THEN
    RETURN jsonb_build_object('error', 'Squad contains duplicate players');
  END IF;

  SELECT COALESCE(SUM(price), 0) INTO v_total_price FROM players WHERE id = ANY(p_player_ids);
  IF v_total_price > v_budget THEN
    RETURN jsonb_build_object('error', 'Squad exceeds the $100.0M budget');
  END IF;

  INSERT INTO fantasy_teams (user_id, team_name, formation, budget_remaining)
  VALUES (v_user, p_team_name, p_formation, v_budget - v_total_price)
  ON CONFLICT (user_id) DO UPDATE
    SET team_name = EXCLUDED.team_name, formation = EXCLUDED.formation,
        budget_remaining = EXCLUDED.budget_remaining, updated_at = NOW()
  RETURNING id INTO v_team_id;

  DELETE FROM fantasy_team_players WHERE fantasy_team_id = v_team_id;

  FOREACH v_pid IN ARRAY p_player_ids LOOP
    INSERT INTO fantasy_team_players (fantasy_team_id, player_id, is_captain, is_vice_captain, is_starting, bench_order)
    VALUES (
      v_team_id, v_pid,
      v_pid = p_captain_id, v_pid = p_vice_captain_id,
      v_pid = ANY(p_starting_ids),
      CASE WHEN v_pid = ANY(p_starting_ids) THEN NULL ELSE v_order END
    );
    v_order := v_order + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'team_id', v_team_id);
END;
$$;

GRANT EXECUTE ON FUNCTION save_fantasy_team(TEXT, TEXT, UUID[], UUID, UUID, UUID[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION save_fantasy_team(TEXT, TEXT, UUID[], UUID, UUID, UUID[]) FROM PUBLIC, anon;

-- =============================================
-- Market: buy/sell with row locking (prevents TOCTOU races) and budget/
-- squad-size validation
-- =============================================
CREATE OR REPLACE FUNCTION buy_player(p_player_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user UUID := auth.uid();
  v_team_id UUID;
  v_budget BIGINT;
  v_price BIGINT;
  v_squad_size INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'not authenticated'); END IF;

  -- The admin panel's "Transfer Window" toggle only ever hid the Buy/Sell
  -- buttons client-side — these RPCs never checked it themselves, so anyone
  -- calling them directly (or with the page already open) could still
  -- trade with the market supposedly frozen.
  IF (SELECT (value->>'transferWindow')::boolean FROM app_config WHERE key = 'feature_flags') IS FALSE THEN
    RETURN jsonb_build_object('error', 'the transfer window is currently closed');
  END IF;

  SELECT id, budget_remaining INTO v_team_id, v_budget
  FROM fantasy_teams WHERE user_id = v_user FOR UPDATE;
  IF v_team_id IS NULL THEN RETURN jsonb_build_object('error', 'no fantasy team yet'); END IF;

  SELECT price INTO v_price FROM players WHERE id = p_player_id FOR UPDATE;
  IF v_price IS NULL THEN RETURN jsonb_build_object('error', 'player not found'); END IF;

  IF EXISTS (SELECT 1 FROM fantasy_team_players WHERE fantasy_team_id = v_team_id AND player_id = p_player_id) THEN
    RETURN jsonb_build_object('error', 'already own this player');
  END IF;

  SELECT COUNT(*) INTO v_squad_size FROM fantasy_team_players WHERE fantasy_team_id = v_team_id;
  IF v_squad_size >= 15 THEN RETURN jsonb_build_object('error', 'squad is full (15 players max)'); END IF;

  IF v_price > v_budget THEN RETURN jsonb_build_object('error', 'insufficient budget'); END IF;

  INSERT INTO fantasy_team_players (fantasy_team_id, player_id, is_starting, bench_order)
  VALUES (v_team_id, p_player_id, FALSE, v_squad_size);

  UPDATE fantasy_teams SET budget_remaining = budget_remaining - v_price, updated_at = NOW() WHERE id = v_team_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION sell_player(p_player_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user UUID := auth.uid();
  v_team_id UUID;
  v_price BIGINT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('error', 'not authenticated'); END IF;

  IF (SELECT (value->>'transferWindow')::boolean FROM app_config WHERE key = 'feature_flags') IS FALSE THEN
    RETURN jsonb_build_object('error', 'the transfer window is currently closed');
  END IF;

  SELECT id INTO v_team_id FROM fantasy_teams WHERE user_id = v_user FOR UPDATE;
  IF v_team_id IS NULL THEN RETURN jsonb_build_object('error', 'no fantasy team yet'); END IF;

  SELECT price INTO v_price FROM players WHERE id = p_player_id;
  IF v_price IS NULL THEN RETURN jsonb_build_object('error', 'player not found'); END IF;

  IF NOT EXISTS (SELECT 1 FROM fantasy_team_players WHERE fantasy_team_id = v_team_id AND player_id = p_player_id) THEN
    RETURN jsonb_build_object('error', 'you do not own this player');
  END IF;

  DELETE FROM fantasy_team_players WHERE fantasy_team_id = v_team_id AND player_id = p_player_id;
  UPDATE fantasy_teams SET budget_remaining = budget_remaining + v_price, updated_at = NOW() WHERE id = v_team_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION buy_player(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION sell_player(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION buy_player(UUID) FROM PUBLIC, anon;

-- =============================================
-- SOUTH AFRICA & BOTSWANA EXPANSION (2026-08-25)
--
-- See supabase/migrations/20260825040000_add_south_africa_botswana_teams.sql
-- for full sourcing/confidence notes. Adds a `country` dimension to
-- teams/matches (previously implicit — every team was Zimbabwean) and
-- seeds real, web-verified clubs for South Africa (football, cricket,
-- rugby) and Botswana (football, rugby). Botswana cricket is excluded —
-- no current domestic club competition exists in any accessible source.
-- =============================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Zimbabwe';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS competition TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Zimbabwe';

-- South Africa — football (Betway Premiership)
INSERT INTO teams (name, nickname, short_name, city, primary_color, sport, country, competition) VALUES
  ('Kaizer Chiefs FC',            'Amakhosi',                 'KZC',  'Johannesburg', '#FFC72C', 'football', 'South Africa', 'Betway Premiership'),
  ('Orlando Pirates FC',          'Bucs',                     'ORL',  'Johannesburg', '#1A1A1A', 'football', 'South Africa', 'Betway Premiership'),
  ('Mamelodi Sundowns FC',        'The Brazilians',           'SUN',  'Pretoria',     '#FFD400', 'football', 'South Africa', 'Betway Premiership'),
  ('AmaZulu FC',                  NULL,                       'AMA',  'Durban',       NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('Lamontville Golden Arrows FC', 'Abafana Bes''thende',     'ARR',  'Durban',       NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('Chippa United FC',            'Chilli Boys',              'CHP',  'East London',  NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('Sekhukhune United FC',        'Babina Noko',              'SEK',  'Polokwane',    NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('TS Galaxy FC',                'The Rockets',              'TSG',  'Mbombela',     NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('Durban City FC',              NULL,                       'DBC',  'Durban',       NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('Marumo Gallants FC',          NULL,                       'MAR',  'Bloemfontein', NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('Polokwane City FC',           NULL,                       'PLK',  'Polokwane',    NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('Richards Bay FC',             NULL,                       'RIC',  'Richards Bay', NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('Siwelele FC',                 NULL,                       'SIW',  'Bloemfontein', NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('Stellenbosch FC',             NULL,                       'STE',  'Stellenbosch', NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('Milford FC',                  NULL,                       'MIL',  'Richards Bay', NULL,      'football', 'South Africa', 'Betway Premiership'),
  ('Kruger United FC',            NULL,                       'KRU',  'KaNyamazane',  NULL,      'football', 'South Africa', 'Betway Premiership')
ON CONFLICT DO NOTHING;

-- South Africa — cricket (CSA 4-Day Series, Division One)
INSERT INTO teams (name, nickname, short_name, city, primary_color, sport, country, competition) VALUES
  ('Lions',                NULL,      'LIO',  'Johannesburg',      '#003DA5', 'cricket', 'South Africa', 'CSA 4-Day Series (Division One)'),
  ('Titans',                NULL,     'TIT',  'Centurion',         '#0057B8', 'cricket', 'South Africa', 'CSA 4-Day Series (Division One)'),
  ('Warriors',              NULL,     'WAR',  'Gqeberha',          '#00A651', 'cricket', 'South Africa', 'CSA 4-Day Series (Division One)'),
  ('Dolphins',              NULL,     'DOL',  'Durban',            '#046A38', 'cricket', 'South Africa', 'CSA 4-Day Series (Division One)'),
  ('Western Province',      'Boys in Blue', 'WP', 'Cape Town',     '#0033A0', 'cricket', 'South Africa', 'CSA 4-Day Series (Division One)'),
  ('Boland',                NULL,     'BOL',  'Paarl',             NULL,      'cricket', 'South Africa', 'CSA 4-Day Series (Division One)'),
  ('North West',            'Dragons', 'NW',  'Potchefstroom',     NULL,      'cricket', 'South Africa', 'CSA 4-Day Series (Division One)'),
  ('KwaZulu-Natal Inland',  'Tuskers', 'KZNI', 'Pietermaritzburg', NULL,      'cricket', 'South Africa', 'CSA 4-Day Series (Division One)')
ON CONFLICT DO NOTHING;

-- South Africa — rugby (Currie Cup, 14 first-class provincial unions)
INSERT INTO teams (name, nickname, short_name, city, primary_color, sport, country, competition) VALUES
  ('Bulls',            'Blue Bulls',       'BUL', 'Pretoria',      '#003DA5', 'rugby', 'South Africa', 'Currie Cup'),
  ('Sharks',            NULL,               'SHA', 'Durban',        '#1A1A1A', 'rugby', 'South Africa', 'Currie Cup'),
  ('Golden Lions',      NULL,               'GLI', 'Johannesburg',  '#C8102E', 'rugby', 'South Africa', 'Currie Cup'),
  ('Stormers',          'Western Province', 'STO', 'Cape Town',     '#004B87', 'rugby', 'South Africa', 'Currie Cup'),
  ('Cheetahs',          NULL,               'CHE', 'Bloemfontein',  '#F7941D', 'rugby', 'South Africa', 'Currie Cup'),
  ('Griquas',           'Peacock Blues',    'GRQ', 'Kimberley',     '#002F6C', 'rugby', 'South Africa', 'Currie Cup'),
  ('Pumas',             NULL,               'PUM', 'Mbombela',      '#FFC72C', 'rugby', 'South Africa', 'Currie Cup'),
  ('Boland Cavaliers',  NULL,               'BOC', 'Wellington',    '#F26522', 'rugby', 'South Africa', 'Currie Cup'),
  ('Griffons',          NULL,               'GRI', 'Welkom',        NULL,      'rugby', 'South Africa', 'Currie Cup'),
  ('Border Bulldogs',   NULL,               'BOR', 'East London',   NULL,      'rugby', 'South Africa', 'Currie Cup'),
  ('Eastern Province',  'Elephants',        'EP',  'Gqeberha',      NULL,      'rugby', 'South Africa', 'Currie Cup'),
  ('SWD Eagles',        NULL,               'SWD', 'George',        NULL,      'rugby', 'South Africa', 'Currie Cup'),
  ('Valke',              NULL,               'VAL', 'Kempton Park',  NULL,      'rugby', 'South Africa', 'Currie Cup'),
  ('Leopards',           NULL,               'LEO', 'Potchefstroom', NULL,      'rugby', 'South Africa', 'Currie Cup')
ON CONFLICT DO NOTHING;

-- Botswana — football (FNB Botswana Premier League, 2026-27 roster)
INSERT INTO teams (name, nickname, short_name, city, primary_color, sport, country, competition) VALUES
  ('Township Rollers FC',    'Popa',              'TRO', 'Gaborone',      '#0033A0', 'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Gaborone United SC',     'Moyagoleele',       'GU',  'Gaborone',      NULL,      'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Mochudi Centre Chiefs SC', 'Magosi',          'MCC', 'Mochudi',       '#1A1A1A', 'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Morupule Wanderers FC',  'Bafana ba Magala',  'MOR', 'Palapye',       '#87CEEB', 'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Nico United',            'Majombolo',         'NIC', 'Selebi-Phikwe', NULL,      'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Orapa United FC',        'The Ostriches',     'ORA', 'Orapa',         '#F26522', 'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Botswana Police XI SC',  'The Jungle Kings',  'POL', 'Otse',          NULL,      'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Sua Flamingoes FC',      NULL,                'SUA', 'Sowa',          '#FF69B4', 'football', 'Botswana', 'FNB Botswana Premier League'),
  ('TAFIC FC',               'Matjimenyenga',     'TAF', 'Francistown',   NULL,      'football', 'Botswana', 'FNB Botswana Premier League'),
  ('BDF XI',                 NULL,                'BDF', 'Gaborone',      NULL,      'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Extension Gunners FC',   NULL,                'EXT', 'Lobatse',       '#1A1A1A', 'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Jwaneng Galaxy FC',      NULL,                'JWG', 'Jwaneng',       NULL,      'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Matebele FC',            NULL,                'MAT', 'Matebeleng',    NULL,      'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Enesia FC',              NULL,                'ENE', 'Francistown',   NULL,      'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Prisons XI Gaborone',    'The Warders',       'PRI', 'Gaborone',      NULL,      'football', 'Botswana', 'FNB Botswana Premier League'),
  ('Tonota FC',              NULL,                'TON', 'Tonota',        NULL,      'football', 'Botswana', 'FNB Botswana Premier League')
ON CONFLICT DO NOTHING;

-- Botswana — rugby (Botswana Super Rugby League, 7 corroborated clubs)
INSERT INTO teams (name, nickname, short_name, city, primary_color, sport, country, competition) VALUES
  ('Gaborone Rugby Football Club',        'Hogs',    'GRFC', 'Gaborone', NULL, 'rugby', 'Botswana', 'Botswana Super Rugby League'),
  ('Jaguars Rugby Club',                  NULL,      'JAG',  'Gaborone', NULL, 'rugby', 'Botswana', 'Botswana Super Rugby League'),
  ('Botho University Ryders',             NULL,      'BUR',  'Gaborone', NULL, 'rugby', 'Botswana', 'Botswana Super Rugby League'),
  ('Botswana Defence Force Rugby Club',   'Cheetahs', 'BDFR', 'Gaborone', NULL, 'rugby', 'Botswana', 'Botswana Super Rugby League'),
  ('University of Botswana Rugby Club',   'Rhinos',  'UBR',  'Gaborone', NULL, 'rugby', 'Botswana', 'Botswana Super Rugby League'),
  ('BIUST Buffalos',                      NULL,      'BIU',  'Palapye',  NULL, 'rugby', 'Botswana', 'Botswana Super Rugby League'),
  ('Jwaneng Wildebeests',                 NULL,      'JWB',  'Jwaneng',  NULL, 'rugby', 'Botswana', 'Botswana Super Rugby League')
ON CONFLICT DO NOTHING;

-- Demo fixtures for the new teams — same convention as the existing
-- Zimbabwe seed: 2 finished rounds (14/7 days ago, no scores — filled in
-- via the admin live-scoring flow) + 1 scheduled round (+3 days), grouped
-- into round-robin blocks of 4 (a-b/c-d, a-c/b-d, a-d/b-c — no repeats
-- across the 3 rounds) so every new competition has real content to
-- predict on and a populated Match Stats table immediately.

-- South Africa — football fixtures
INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season, sport, country) VALUES
  ('Kaizer Chiefs FC', 'Orlando Pirates FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'South Africa'),
  ('Mamelodi Sundowns FC', 'AmaZulu FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'South Africa'),
  ('Lamontville Golden Arrows FC', 'Chippa United FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'South Africa'),
  ('Sekhukhune United FC', 'TS Galaxy FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'South Africa'),
  ('Durban City FC', 'Marumo Gallants FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'South Africa'),
  ('Polokwane City FC', 'Richards Bay FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'South Africa'),
  ('Siwelele FC', 'Stellenbosch FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'South Africa'),
  ('Milford FC', 'Kruger United FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'South Africa'),

  ('Kaizer Chiefs FC', 'Mamelodi Sundowns FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'South Africa'),
  ('Orlando Pirates FC', 'AmaZulu FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'South Africa'),
  ('Lamontville Golden Arrows FC', 'Sekhukhune United FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'South Africa'),
  ('Chippa United FC', 'TS Galaxy FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'South Africa'),
  ('Durban City FC', 'Polokwane City FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'South Africa'),
  ('Marumo Gallants FC', 'Richards Bay FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'South Africa'),
  ('Siwelele FC', 'Milford FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'South Africa'),
  ('Stellenbosch FC', 'Kruger United FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'South Africa'),

  ('Kaizer Chiefs FC', 'AmaZulu FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'South Africa'),
  ('Orlando Pirates FC', 'Mamelodi Sundowns FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'South Africa'),
  ('Lamontville Golden Arrows FC', 'TS Galaxy FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'South Africa'),
  ('Chippa United FC', 'Sekhukhune United FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'South Africa'),
  ('Durban City FC', 'Richards Bay FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'South Africa'),
  ('Marumo Gallants FC', 'Polokwane City FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'South Africa'),
  ('Siwelele FC', 'Kruger United FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'South Africa'),
  ('Stellenbosch FC', 'Milford FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'South Africa')
ON CONFLICT DO NOTHING;

-- South Africa — cricket fixtures
INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season, sport, country) VALUES
  ('Lions', 'Titans', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'cricket', 'South Africa'),
  ('Warriors', 'Dolphins', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'cricket', 'South Africa'),
  ('Western Province', 'Boland', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'cricket', 'South Africa'),
  ('North West', 'KwaZulu-Natal Inland', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'cricket', 'South Africa'),

  ('Lions', 'Warriors', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'cricket', 'South Africa'),
  ('Titans', 'Dolphins', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'cricket', 'South Africa'),
  ('Western Province', 'North West', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'cricket', 'South Africa'),
  ('Boland', 'KwaZulu-Natal Inland', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'cricket', 'South Africa'),

  ('Lions', 'Dolphins', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'cricket', 'South Africa'),
  ('Titans', 'Warriors', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'cricket', 'South Africa'),
  ('Western Province', 'KwaZulu-Natal Inland', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'cricket', 'South Africa'),
  ('Boland', 'North West', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'cricket', 'South Africa')
ON CONFLICT DO NOTHING;

-- South Africa — rugby fixtures (Valke/Leopards is a standalone pairing —
-- 14 unions doesn't divide evenly into blocks of 4, so this pair just
-- alternates home advantage each round rather than joining a 4-block)
INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season, sport, country) VALUES
  ('Bulls', 'Sharks', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'rugby', 'South Africa'),
  ('Golden Lions', 'Stormers', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'rugby', 'South Africa'),
  ('Cheetahs', 'Griquas', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'rugby', 'South Africa'),
  ('Pumas', 'Boland Cavaliers', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'rugby', 'South Africa'),
  ('Griffons', 'Border Bulldogs', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'rugby', 'South Africa'),
  ('Eastern Province', 'SWD Eagles', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'rugby', 'South Africa'),
  ('Valke', 'Leopards', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'rugby', 'South Africa'),

  ('Bulls', 'Golden Lions', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'rugby', 'South Africa'),
  ('Sharks', 'Stormers', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'rugby', 'South Africa'),
  ('Cheetahs', 'Pumas', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'rugby', 'South Africa'),
  ('Griquas', 'Boland Cavaliers', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'rugby', 'South Africa'),
  ('Griffons', 'Eastern Province', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'rugby', 'South Africa'),
  ('Border Bulldogs', 'SWD Eagles', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'rugby', 'South Africa'),
  ('Leopards', 'Valke', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'rugby', 'South Africa'),

  ('Bulls', 'Stormers', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'rugby', 'South Africa'),
  ('Sharks', 'Golden Lions', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'rugby', 'South Africa'),
  ('Cheetahs', 'Boland Cavaliers', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'rugby', 'South Africa'),
  ('Griquas', 'Pumas', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'rugby', 'South Africa'),
  ('Griffons', 'SWD Eagles', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'rugby', 'South Africa'),
  ('Border Bulldogs', 'Eastern Province', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'rugby', 'South Africa'),
  ('Valke', 'Leopards', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'rugby', 'South Africa')
ON CONFLICT DO NOTHING;

-- Botswana — football fixtures
INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season, sport, country) VALUES
  ('Township Rollers FC', 'Gaborone United SC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'Botswana'),
  ('Mochudi Centre Chiefs SC', 'Morupule Wanderers FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'Botswana'),
  ('Nico United', 'Orapa United FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'Botswana'),
  ('Botswana Police XI SC', 'Sua Flamingoes FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'Botswana'),
  ('TAFIC FC', 'BDF XI', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'Botswana'),
  ('Extension Gunners FC', 'Jwaneng Galaxy FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'Botswana'),
  ('Matebele FC', 'Enesia FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'Botswana'),
  ('Prisons XI Gaborone', 'Tonota FC', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'football', 'Botswana'),

  ('Township Rollers FC', 'Mochudi Centre Chiefs SC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'Botswana'),
  ('Gaborone United SC', 'Morupule Wanderers FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'Botswana'),
  ('Nico United', 'Botswana Police XI SC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'Botswana'),
  ('Orapa United FC', 'Sua Flamingoes FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'Botswana'),
  ('TAFIC FC', 'Extension Gunners FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'Botswana'),
  ('BDF XI', 'Jwaneng Galaxy FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'Botswana'),
  ('Matebele FC', 'Prisons XI Gaborone', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'Botswana'),
  ('Enesia FC', 'Tonota FC', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'football', 'Botswana'),

  ('Township Rollers FC', 'Morupule Wanderers FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'Botswana'),
  ('Gaborone United SC', 'Mochudi Centre Chiefs SC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'Botswana'),
  ('Nico United', 'Sua Flamingoes FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'Botswana'),
  ('Orapa United FC', 'Botswana Police XI SC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'Botswana'),
  ('TAFIC FC', 'Jwaneng Galaxy FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'Botswana'),
  ('BDF XI', 'Extension Gunners FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'Botswana'),
  ('Matebele FC', 'Tonota FC', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'Botswana'),
  ('Enesia FC', 'Prisons XI Gaborone', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'football', 'Botswana')
ON CONFLICT DO NOTHING;

-- Botswana — rugby fixtures (3-team block round-robins with a rotating
-- bye, since 7 clubs doesn't split evenly into blocks of 4)
INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season, sport, country) VALUES
  ('Gaborone Rugby Football Club', 'Jaguars Rugby Club', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'rugby', 'Botswana'),
  ('Botho University Ryders', 'Botswana Defence Force Rugby Club', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'rugby', 'Botswana'),
  ('University of Botswana Rugby Club', 'BIUST Buffalos', NOW() - INTERVAL '14 days', 'finished', 1, '2026', 'rugby', 'Botswana'),

  ('Gaborone Rugby Football Club', 'Botho University Ryders', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'rugby', 'Botswana'),
  ('Jaguars Rugby Club', 'Botswana Defence Force Rugby Club', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'rugby', 'Botswana'),
  ('BIUST Buffalos', 'Jwaneng Wildebeests', NOW() - INTERVAL '7 days', 'finished', 2, '2026', 'rugby', 'Botswana'),

  ('Gaborone Rugby Football Club', 'Botswana Defence Force Rugby Club', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'rugby', 'Botswana'),
  ('Jaguars Rugby Club', 'Botho University Ryders', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'rugby', 'Botswana'),
  ('Jwaneng Wildebeests', 'University of Botswana Rugby Club', NOW() + INTERVAL '3 days', 'scheduled', 3, '2026', 'rugby', 'Botswana')
ON CONFLICT DO NOTHING;
REVOKE EXECUTE ON FUNCTION sell_player(UUID) FROM PUBLIC, anon;
