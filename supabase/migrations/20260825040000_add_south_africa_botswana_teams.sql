-- =============================================
-- SOUTH AFRICA & BOTSWANA EXPANSION (2026-08-25)
--
-- Adds a `country` dimension to teams/matches (previously implicit —
-- every team was Zimbabwean) and seeds real, web-verified clubs for South
-- Africa (football, cricket, rugby) and Botswana (football, rugby).
-- Botswana cricket is deliberately excluded: research found no current,
-- named domestic club competition in any accessible source — the only
-- historical structure found was a stale 2001 inter-town format, not a
-- club league, so there is nothing real to seed.
--
-- Sourcing/confidence notes (research done via multi-source web search,
-- cross-checked against Wikipedia, official league/federation sites, and
-- recent sports news — same standard as the original Zimbabwe seed):
--   * South Africa football (Betway Premiership, 16 clubs): fully verified
--     for name/city; colour/nickname unverified for several of the newest
--     top-flight entrants (Durban City, Marumo Gallants, Polokwane City,
--     Richards Bay, Siwelele, Stellenbosch, Milford, Kruger United) — left
--     NULL rather than guessed.
--   * South Africa cricket (CSA 4-Day Series, Division One, 8 teams):
--     Boland and North West have no verifiable colour in any source found;
--     North West's "Dragons" identity (2017 rebrand) is real and used as
--     its nickname.
--   * South Africa rugby (Currie Cup): seeded as the 14 first-class
--     provincial unions that feed both Currie Cup divisions — a stable
--     list — rather than the Premier Division's variable 8-team lineup
--     (4 permanent URC-affiliated unions + 4 rotating SA Cup qualifiers
--     each season). The 4 permanent unions plus Cheetahs/Griquas/Pumas/
--     Boland Cavaliers are cross-verified on name/city/colour; Griffons,
--     Border Bulldogs, Eastern Province, SWD Eagles, Valke and Leopards
--     are real unions confirmed via a single aggregated source pass —
--     their colours are left NULL rather than guessed.
--   * Botswana football (FNB Botswana Premier League, 16 clubs): seeded
--     as the 2026-27 roster (season starts 30 Aug 2026) — i.e. the
--     2025-26 table's bottom three (Black Lions, Santa Green, Calendar
--     Stars) replaced by the three promoted sides (Enesia FC, Prisons XI
--     Gaborone, Tonota FC), each independently confirmed via a second
--     source beyond the original reference.
--   * Botswana rugby (Botswana Super Rugby League): the official union
--     site's own table pages disagree with each other on the current
--     roster, so only the 7 clubs independently corroborated by a second
--     source (news coverage or the club/university's own site) are
--     seeded; "Great North" and "BAC North" appeared in only one source
--     each and are deliberately omitted.
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

-- =============================================
-- Demo fixtures for the new teams — same convention as the existing
-- Zimbabwe seed: 2 finished rounds (14/7 days ago, no scores — filled in
-- via the admin live-scoring flow) + 1 scheduled round (+3 days), grouped
-- into round-robin blocks of 4 (a-b/c-d, a-c/b-d, a-d/b-c — no repeats
-- across the 3 rounds) so every new competition has real content to
-- predict on and a populated Match Stats table immediately.
-- =============================================

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
