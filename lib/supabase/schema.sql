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
-- SEED DATA — six original, fictional Zimbabwean clubs
-- =============================================
-- None of these names, crests, or players correspond to any real club,
-- league, or footballer. Purely original placeholder content for launch.

INSERT INTO teams (name, short_name, city, primary_color) VALUES
  ('Harare Rangers',     'HRR', 'Harare',     '#15803D'),
  ('Bulawayo Barons',    'BUL', 'Bulawayo',   '#CA8A04'),
  ('Mutare Miners',      'MUT', 'Mutare',     '#B91C1C'),
  ('Gweru Warriors',     'GWE', 'Gweru',      '#1D4ED8'),
  ('Masvingo Eagles',    'MAS', 'Masvingo',   '#0F766E'),
  ('Kwekwe City',        'KWK', 'Kwekwe',     '#7E22CE')
ON CONFLICT DO NOTHING;

INSERT INTO players (name, position, club, price, total_points, goals, assists, clean_sheets, form) VALUES
  -- Harare Rangers
  ('Tapiwa Chirwa',      'GK',  'Harare Rangers',   5200000, 84, 0, 0, 7, 7.0),
  ('Munashe Gutu',       'GK',  'Harare Rangers',   4200000, 58, 0, 0, 4, 6.0),
  ('Blessing Chikwira',  'DEF', 'Harare Rangers',   5800000, 88, 2, 3, 6, 7.5),
  ('Tanaka Muredzi',     'DEF', 'Harare Rangers',   5200000, 76, 1, 2, 5, 6.9),
  ('Simbarashe Gwenzi',  'DEF', 'Harare Rangers',   4800000, 69, 0, 2, 4, 6.4),
  ('Farai Nyoni',        'DEF', 'Harare Rangers',   4600000, 64, 1, 1, 4, 6.1),
  ('Kudakwashe Marufu',  'MID', 'Harare Rangers',   8200000, 124, 6, 10, 1, 8.8),
  ('Tendai Muchineripi', 'MID', 'Harare Rangers',   7200000, 109, 4, 8, 1, 8.3),
  ('Anesu Chidyausiku',  'MID', 'Harare Rangers',   6400000, 91, 3, 5, 0, 7.6),
  ('Rutendo Mapfumo',    'FWD', 'Harare Rangers',   11200000, 168, 17, 8, 0, 9.5),
  ('Takudzwa Mhofu',     'FWD', 'Harare Rangers',   9500000, 138, 12, 6, 0, 8.8),
  ('Believe Chuma',      'FWD', 'Harare Rangers',   7800000, 112, 9, 5, 0, 8.1),
  ('Panashe Zishiri',    'FWD', 'Harare Rangers',   6800000, 94, 7, 4, 0, 7.5),
  ('Wisdom Chademana',   'MID', 'Harare Rangers',   6000000, 82, 2, 6, 0, 7.2),

  -- Bulawayo Barons
  ('Nkosana Ndlovu',     'GK',  'Bulawayo Barons',  5000000, 81, 0, 0, 7, 6.9),
  ('Mthokozisi Sibanda', 'GK',  'Bulawayo Barons',  4000000, 52, 0, 0, 3, 5.8),
  ('Thabani Moyo',       'DEF', 'Bulawayo Barons',  5600000, 85, 2, 2, 6, 7.3),
  ('Sanele Dube',        'DEF', 'Bulawayo Barons',  5000000, 71, 1, 1, 5, 6.6),
  ('Nkululeko Khumalo',  'DEF', 'Bulawayo Barons',  4700000, 66, 0, 2, 4, 6.2),
  ('Mandla Nyathi',      'DEF', 'Bulawayo Barons',  4500000, 61, 1, 1, 3, 6.0),
  ('Sipho Mahlangu',     'MID', 'Bulawayo Barons',  7900000, 117, 5, 9, 1, 8.4),
  ('Bongani Ncube',      'MID', 'Bulawayo Barons',  6900000, 99, 3, 7, 0, 7.8),
  ('Zenzo Mabhena',      'MID', 'Bulawayo Barons',  6100000, 87, 3, 5, 0, 7.4),
  ('Sikhumbuzo Mpofu',   'FWD', 'Bulawayo Barons',  10500000, 152, 15, 7, 0, 9.1),
  ('Prosper Zulu',       'FWD', 'Bulawayo Barons',  8800000, 126, 10, 6, 0, 8.5),
  ('Nqobizitha Sithole', 'FWD', 'Bulawayo Barons',  7200000, 103, 8, 4, 0, 7.9),
  ('Lindani Gumbo',      'FWD', 'Bulawayo Barons',  6300000, 85, 6, 3, 0, 7.2),
  ('Ayanda Phiri',       'MID', 'Bulawayo Barons',  5700000, 76, 2, 5, 0, 6.9),

  -- Mutare Miners
  ('Godfrey Mutasa',     'GK',  'Mutare Miners',    4900000, 77, 0, 0, 6, 6.7),
  ('Trust Zvidzai',      'GK',  'Mutare Miners',    3900000, 49, 0, 0, 3, 5.6),
  ('Charles Musanhu',    'DEF', 'Mutare Miners',    5400000, 79, 1, 2, 5, 7.0),
  ('Lameck Chiwara',     'DEF', 'Mutare Miners',    4900000, 67, 1, 1, 4, 6.3),
  ('Pardon Mativenga',   'DEF', 'Mutare Miners',    4600000, 62, 0, 1, 4, 6.0),
  ('Netsai Marange',     'DEF', 'Mutare Miners',    4400000, 58, 0, 1, 3, 5.8),
  ('Talent Chigumba',    'MID', 'Mutare Miners',    7500000, 108, 4, 8, 0, 8.0),
  ('Praise Mudhindo',    'MID', 'Mutare Miners',    6600000, 92, 3, 6, 0, 7.5),
  ('Ishmael Bere',       'MID', 'Mutare Miners',    5900000, 80, 2, 4, 0, 7.0),
  ('Delight Chisango',   'FWD', 'Mutare Miners',    9900000, 141, 13, 6, 0, 8.9),
  ('Method Manyeza',     'FWD', 'Mutare Miners',    8300000, 118, 9, 5, 0, 8.2),
  ('Providence Katsande','FWD', 'Mutare Miners',    6900000, 96, 7, 4, 0, 7.6),
  ('Blessing Mangoma',   'FWD', 'Mutare Miners',    6000000, 79, 5, 3, 0, 7.0),
  ('Custom Nemasango',   'MID', 'Mutare Miners',    5500000, 72, 2, 4, 0, 6.7),

  -- Gweru Warriors
  ('Innocent Nyathi',    'GK',  'Gweru Warriors',   5100000, 83, 0, 0, 7, 7.0),
  ('Perfect Chinamasa',  'GK',  'Gweru Warriors',   4100000, 55, 0, 0, 4, 5.9),
  ('Vengai Muzenda',     'DEF', 'Gweru Warriors',   5700000, 87, 2, 3, 6, 7.4),
  ('Tafara Mudimu',      'DEF', 'Gweru Warriors',   5100000, 73, 1, 2, 5, 6.7),
  ('Gift Muchena',       'DEF', 'Gweru Warriors',   4800000, 68, 1, 1, 4, 6.3),
  ('Everson Chivende',   'DEF', 'Gweru Warriors',   4500000, 60, 0, 1, 3, 5.9),
  ('Nyasha Mataruse',    'MID', 'Gweru Warriors',   8000000, 120, 5, 9, 1, 8.5),
  ('Milton Chidavaenzi', 'MID', 'Gweru Warriors',   7000000, 104, 4, 7, 0, 8.0),
  ('Denford Bwanya',     'MID', 'Gweru Warriors',   6200000, 89, 3, 5, 0, 7.4),
  ('Marvellous Chirinda','FWD', 'Gweru Warriors',   10800000, 158, 16, 7, 0, 9.3),
  ('Hardlife Zvirekwi',  'FWD', 'Gweru Warriors',   9000000, 129, 11, 6, 0, 8.6),
  ('Godknows Murwira',   'FWD', 'Gweru Warriors',   7400000, 106, 8, 5, 0, 8.0),
  ('Fortune Chikandiwa', 'FWD', 'Gweru Warriors',   6500000, 89, 6, 3, 0, 7.3),
  ('Progress Muteswa',   'MID', 'Gweru Warriors',   5800000, 78, 2, 5, 0, 7.0),

  -- Masvingo Eagles
  ('Loveness Mutero',    'GK',  'Masvingo Eagles',  4800000, 75, 0, 0, 6, 6.6),
  ('Shepherd Chivasa',   'GK',  'Masvingo Eagles',  3800000, 47, 0, 0, 3, 5.5),
  ('Clemence Nherera',   'DEF', 'Masvingo Eagles',  5300000, 78, 1, 2, 5, 6.9),
  ('Norest Chapfika',    'DEF', 'Masvingo Eagles',  4800000, 65, 1, 1, 4, 6.2),
  ('Passmore Chiweshe',  'DEF', 'Masvingo Eagles',  4500000, 60, 0, 1, 3, 5.9),
  ('Regis Mavhima',      'DEF', 'Masvingo Eagles',  4300000, 55, 0, 1, 3, 5.7),
  ('Silence Musaigwa',   'MID', 'Masvingo Eagles',  7300000, 105, 4, 7, 0, 7.9),
  ('Lovemore Chinyerere','MID', 'Masvingo Eagles',  6400000, 89, 3, 6, 0, 7.4),
  ('Munyaradzi Gapare',  'MID', 'Masvingo Eagles',  5700000, 76, 2, 4, 0, 6.9),
  ('Freedom Sithole',    'FWD', 'Masvingo Eagles',  9600000, 136, 12, 6, 0, 8.7),
  ('Justice Machaya',    'FWD', 'Masvingo Eagles',  8000000, 114, 9, 5, 0, 8.0),
  ('Learnmore Bepe',     'FWD', 'Masvingo Eagles',  6700000, 92, 7, 4, 0, 7.4),
  ('Comfort Rusike',     'FWD', 'Masvingo Eagles',  5900000, 76, 5, 3, 0, 6.8),
  ('Terrence Dziruni',   'MID', 'Masvingo Eagles',  5300000, 68, 2, 3, 0, 6.5),

  -- Kwekwe City
  ('Ngonidzashe Mari',   'GK',  'Kwekwe City',      4700000, 73, 0, 0, 6, 6.5),
  ('Believe Sango',      'GK',  'Kwekwe City',      3700000, 45, 0, 0, 3, 5.4),
  ('Kelvin Chirinda',    'DEF', 'Kwekwe City',      5100000, 76, 1, 2, 5, 6.8),
  ('Elton Musarurwa',    'DEF', 'Kwekwe City',      4600000, 63, 1, 1, 4, 6.1),
  ('Obert Muzenda',      'DEF', 'Kwekwe City',      4400000, 58, 0, 1, 3, 5.8),
  ('Ronald Chinembiri',  'DEF', 'Kwekwe City',      4200000, 53, 0, 1, 3, 5.6),
  ('Ashley Manyowa',     'MID', 'Kwekwe City',      7100000, 102, 4, 7, 0, 7.8),
  ('Collen Warinda',     'MID', 'Kwekwe City',      6200000, 86, 3, 5, 0, 7.3),
  ('Kelvin Madzongwe',   'MID', 'Kwekwe City',      5500000, 73, 2, 4, 0, 6.8),
  ('Devine Chidzambwa',  'FWD', 'Kwekwe City',      9200000, 131, 11, 5, 0, 8.5),
  ('Blessed Gono',       'FWD', 'Kwekwe City',      7700000, 110, 8, 5, 0, 7.9),
  ('Anymore Chikafu',    'FWD', 'Kwekwe City',      6400000, 88, 6, 4, 0, 7.3),
  ('Ontibile Ndoro',     'FWD', 'Kwekwe City',      5700000, 72, 5, 3, 0, 6.7),
  ('Farirai Bhasera',    'MID', 'Kwekwe City',      5100000, 64, 2, 3, 0, 6.4)
ON CONFLICT DO NOTHING;

-- Seed fixtures — no club is favoured; matchdays rotate every club through
-- home and away fixtures against different opponents.
INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season) VALUES
  ('Harare Rangers',  'Bulawayo Barons', NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Mutare Miners',   'Gweru Warriors',  NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Masvingo Eagles', 'Kwekwe City',     NOW() - INTERVAL '14 days', 'finished',  1, '2026'),
  ('Bulawayo Barons', 'Mutare Miners',   NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Gweru Warriors',  'Masvingo Eagles', NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Kwekwe City',     'Harare Rangers',  NOW() - INTERVAL '7 days',  'finished',  2, '2026'),
  ('Harare Rangers',  'Gweru Warriors',  NOW() + INTERVAL '2 days',  'scheduled', 3, '2026'),
  ('Mutare Miners',   'Kwekwe City',     NOW() + INTERVAL '2 days',  'scheduled', 3, '2026'),
  ('Bulawayo Barons', 'Masvingo Eagles', NOW() + INTERVAL '3 days',  'scheduled', 3, '2026')
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
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''), split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  -- Requested username already taken: fall back to email prefix + random suffix
  -- rather than failing the signup outright.
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    split_part(NEW.email, '@', 1) || '_' || floor(random() * 9000 + 1000)::text,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
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
CREATE OR REPLACE FUNCTION resolve_login_identifier(p_identifier TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT au.email INTO v_email
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE p.username = p_identifier OR p.phone = p_identifier
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
