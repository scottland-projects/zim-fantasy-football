-- =============================================
-- ZIM FANTASY FOOTBALL — SUPABASE SCHEMA
-- =============================================
-- Independent, all-clubs fantasy football platform. Not affiliated with
-- ZIFA, the Premier Soccer League, or any real club — every club and
-- player below is fictional. Run this file in the Supabase SQL editor
-- first, then scoring.sql, then achievements.sql.

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
REVOKE SELECT (phone) ON profiles FROM anon, authenticated;
GRANT SELECT (id, username, full_name, avatar_url, role, xp, level, fantasy_points,
  favorite_player, supporter_branch, bio, created_at, updated_at) ON profiles TO anon, authenticated;
GRANT SELECT (phone) ON profiles TO service_role;

-- =============================================
-- TEAMS TABLE — canonical list of fictional clubs
-- =============================================
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  short_name TEXT NOT NULL,
  city TEXT,
  primary_color TEXT DEFAULT '#15803D',
  crest_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE POLICY "League members viewable by members" ON league_members FOR SELECT USING (true);
CREATE POLICY "Users join leagues" ON league_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave leagues" ON league_members FOR DELETE USING (auth.uid() = user_id);

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

-- =============================================
-- NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'system' CHECK (type IN ('match', 'transfer', 'goal', 'league', 'reward', 'system')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "admin_insert_notifications" ON notifications FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

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

-- =============================================
-- POLLS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS polls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  votes JSONB NOT NULL DEFAULT '{}',
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Polls viewable by everyone" ON polls FOR SELECT USING (true);
CREATE POLICY "Admins manage polls" ON polls FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
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

CREATE OR REPLACE FUNCTION cast_poll_vote(p_poll_id UUID, p_option TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_existing TEXT;
  v_votes    JSONB;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not authenticated'); END IF;
  IF NOT EXISTS (SELECT 1 FROM polls WHERE id = p_poll_id AND options ? p_option) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid option');
  END IF;

  SELECT option INTO v_existing FROM poll_votes WHERE poll_id = p_poll_id AND user_id = v_user;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already voted', 'choice', v_existing);
  END IF;

  INSERT INTO poll_votes (poll_id, user_id, option) VALUES (p_poll_id, v_user, p_option);

  UPDATE polls
  SET votes = jsonb_set(COALESCE(votes, '{}'::jsonb), ARRAY[p_option], to_jsonb(COALESCE((votes ->> p_option)::int, 0) + 1))
  WHERE id = p_poll_id
  RETURNING votes INTO v_votes;

  RETURN jsonb_build_object('ok', true, 'votes', v_votes, 'choice', p_option);
END;
$$;

GRANT EXECUTE ON FUNCTION cast_poll_vote(UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION cast_poll_vote(UUID, TEXT) FROM PUBLIC, anon;

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
  '{"liveScoring":true,"transferWindow":true,"chat":true,"polls":true,"leagueCreation":true,"notifications":true,"marketplace":true,"achievements":true}'
) ON CONFLICT (key) DO NOTHING;

-- =============================================
-- USER SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  marketing_emails BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);

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
-- SEED DATA — the 18 real 2026 Castle Lager PSL clubs, identified by their
-- common fan nicknames (or short name where no widely-used nickname exists)
-- rather than full registered club names. Players carry NO real names —
-- every player is seeded as "{club code} #{squad number}" only. Squad
-- numbers below follow ordinary football numbering conventions (1 = GK,
-- etc.) but are illustrative, not scraped from any official/verified squad
-- list — no claim is made that a given number belongs to a specific real
-- individual. See LEGAL.md before broadening this to real player names.
-- =============================================

INSERT INTO teams (name, short_name, city, primary_color) VALUES
  ('Scottland',         'SCO', 'Harare',        '#15803D'),
  ('Golden Boys',        'HRK', 'Kwekwe',        '#CA8A04'),
  ('DeMbare',            'DYN', 'Harare',        '#1D4ED8'),
  ('Vabvamburi',         'HER', 'Harare',        '#0F766E'),
  ('Ngezi Platinum',     'NPS', 'Ngezi',         '#7E22CE'),
  ('Makepekepe',         'CAP', 'Harare',        '#15803D'),
  ('Bosso',              'HIG', 'Bulawayo',      '#0F172A'),
  ('The Punters',        'MWO', 'Norton',        '#B91C1C'),
  ('Simba Bhora',        'SIM', 'Shamva',        '#CA8A04'),
  ('Gamecocks',          'CHI', 'Bulawayo',      '#DC2626'),
  ('FC Platinum',        'FCP', 'Zvishavane',    '#1D4ED8'),
  ('Amakhosi',           'BCH', 'Bulawayo',      '#000000'),
  ('ZPC Kariba',         'ZPC', 'Kariba',        '#0369A1'),
  ('Hunters',            'HUN', 'Marondera',     '#166534'),
  ('Agama',              'AGA', 'Mount Darwin',  '#B45309'),
  ('WiFi Boys',          'TEL', 'Harare',        '#2563EB'),
  ('Gem Boys',           'MAN', 'Mutare',        '#059669'),
  ('Sugar Sugar Boyz',   'TRI', 'Triangle',      '#EA580C')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_clubs TEXT[] := ARRAY['Scottland','Golden Boys','DeMbare','Vabvamburi','Ngezi Platinum','Makepekepe','Bosso','The Punters','Simba Bhora','Gamecocks','FC Platinum','Amakhosi','ZPC Kariba','Hunters','Agama','WiFi Boys','Gem Boys','Sugar Sugar Boyz'];
  -- position + squad number per slot, 14 players per club (2 GK, 4 DEF, 4 MID, 4 FWD)
  v_slots TEXT[] := ARRAY['GK:1','GK:22','DEF:2','DEF:3','DEF:4','DEF:5','MID:6','MID:7','MID:8','MID:10','FWD:9','FWD:11','FWD:14','FWD:17'];
  v_club TEXT;
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
  FOREACH v_club IN ARRAY v_clubs LOOP
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
-- well-known real rivalries where one exists (e.g. Bosso vs DeMbare).
INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season) VALUES
  ('Bosso',           'DeMbare',          NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Makepekepe',      'Amakhosi',         NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Gamecocks',       'Vabvamburi',       NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('FC Platinum',     'Ngezi Platinum',   NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Simba Bhora',     'Golden Boys',      NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('ZPC Kariba',      'Hunters',          NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Agama',           'WiFi Boys',        NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Gem Boys',        'Sugar Sugar Boyz', NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Scottland',       'The Punters',      NOW() - INTERVAL '14 days', 'finished',  1, '2026'),

  ('DeMbare',         'Makepekepe',       NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Amakhosi',        'Gamecocks',        NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Vabvamburi',      'FC Platinum',      NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Ngezi Platinum',  'Simba Bhora',      NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Golden Boys',     'ZPC Kariba',       NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Hunters',         'Agama',            NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('WiFi Boys',       'Gem Boys',         NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Sugar Sugar Boyz','Scottland',        NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('The Punters',     'Bosso',            NOW() - INTERVAL '7 days',  'finished',  2, '2026'),

  ('Bosso',           'Amakhosi',         NOW() + INTERVAL '2 days',  'scheduled', 3, '2026'),
  ('Makepekepe',      'Vabvamburi',       NOW() + INTERVAL '2 days',  'scheduled', 3, '2026'),
  ('DeMbare',         'Ngezi Platinum',   NOW() + INTERVAL '2 days',  'scheduled', 3, '2026'),
  ('Gamecocks',       'Golden Boys',      NOW() + INTERVAL '3 days',  'scheduled', 3, '2026'),
  ('FC Platinum',     'Hunters',          NOW() + INTERVAL '3 days',  'scheduled', 3, '2026'),
  ('Simba Bhora',     'WiFi Boys',        NOW() + INTERVAL '3 days',  'scheduled', 3, '2026'),
  ('ZPC Kariba',      'Sugar Sugar Boyz', NOW() + INTERVAL '3 days',  'scheduled', 3, '2026'),
  ('Agama',           'Scottland',        NOW() + INTERVAL '3 days',  'scheduled', 3, '2026'),
  ('Gem Boys',        'The Punters',      NOW() + INTERVAL '3 days',  'scheduled', 3, '2026')
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
REVOKE EXECUTE ON FUNCTION sell_player(UUID) FROM PUBLIC, anon;
