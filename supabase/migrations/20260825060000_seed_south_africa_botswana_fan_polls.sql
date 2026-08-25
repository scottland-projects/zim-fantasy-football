-- Adds 5 more global fan polls (league_id NULL, visible to everyone),
-- covering the newly-seeded South Africa and Botswana competitions —
-- following the same "no invented facts" standard as the original
-- 20260825020000_seed_real_fan_polls.sql:
--
-- - All club/franchise/union names are the real, web-verified teams
--   seeded in 20260825040000_add_south_africa_botswana_teams.sql.
-- - The Currie Cup poll uses only the 8 unions actually in the 2026
--   Premier Division (the ones genuinely competing for the trophy this
--   season), not the full 14-union seed list.
-- - The one factual claim used as poll context — Gaborone Hogs as
--   defending Botswana Super Rugby League champions — is the same fact
--   verified via independent news (Mmegi Online) during the original
--   research pass, not fabricated.
-- - The football/cricket "who are you backing" polls make no title-
--   holder claim at all, same as the original Zimbabwe club poll, since
--   no verified "defending champion" fact was found for those three
--   competitions.

INSERT INTO polls (question, options, votes, league_id, created_by) VALUES
(
  'Which Betway Premiership club are you backing this season?',
  '["Kaizer Chiefs FC", "Orlando Pirates FC", "Mamelodi Sundowns FC", "AmaZulu FC", "Chippa United FC", "Sekhukhune United FC", "Stellenbosch FC", "TS Galaxy FC"]'::jsonb,
  '{}'::jsonb,
  NULL,
  (SELECT id FROM profiles WHERE username = 'admin')
),
(
  'Which franchise wins the CSA 4-Day Series (Division One) this season?',
  '["Lions", "Titans", "Warriors", "Dolphins", "Western Province", "Boland", "North West", "KwaZulu-Natal Inland"]'::jsonb,
  '{}'::jsonb,
  NULL,
  (SELECT id FROM profiles WHERE username = 'admin')
),
(
  'Which union lifts the Currie Cup this season?',
  '["Bulls", "Sharks", "Golden Lions", "Stormers", "Cheetahs", "Griquas", "Pumas", "Boland Cavaliers"]'::jsonb,
  '{}'::jsonb,
  NULL,
  (SELECT id FROM profiles WHERE username = 'admin')
),
(
  'Which FNB Botswana Premier League club are you backing this season?',
  '["Township Rollers FC", "Gaborone United SC", "Mochudi Centre Chiefs SC", "Morupule Wanderers FC", "Orapa United FC", "TAFIC FC", "Botswana Police XI SC", "Nico United"]'::jsonb,
  '{}'::jsonb,
  NULL,
  (SELECT id FROM profiles WHERE username = 'admin')
),
(
  'Gaborone Rugby Football Club (the Hogs) enter the season as Botswana Super Rugby League''s defending champions. Can they retain the title?',
  '["Yes, back-to-back", "No, a challenger wins it", "Too close to call"]'::jsonb,
  '{}'::jsonb,
  NULL,
  (SELECT id FROM profiles WHERE username = 'admin')
);
