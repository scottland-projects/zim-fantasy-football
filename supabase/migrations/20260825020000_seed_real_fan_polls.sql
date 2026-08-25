-- Seeds 5 global (league_id NULL, visible to everyone) fan polls, requested
-- after a user noted the platform had zero polls. Every poll is grounded in
-- real, verified data — no invented "current form," standings, or facts:
--
-- - Real club/franchise/team names, matching the corrected roster from
--   20260825000000_correct_rugby_and_agama_fc_names.sql (Castle Lager PSL,
--   Logan Cup, National Rugby League).
-- - The two factual claims used as poll context (Scottland FC = defending
--   PSL champions; Southern Rocks = 2025-26 Logan Cup champions) are the
--   same facts verified via Wikipedia during that research pass — not
--   fabricated.
-- - The football-club poll uses a representative subset (8 of the 18 real
--   clubs) for a usable poll length, not a claim about who's actually
--   favoured this season, since no live standings data exists to back that
--   up. Cricket and rugby polls include every real team in each competition
--   (5 and 8 respectively — short enough to list in full).
-- - The last poll ("Which sport are you most excited to follow?") makes no
--   factual claim at all — pure opinion, about the app's own three sports.

INSERT INTO polls (question, options, votes, league_id, created_by) VALUES
(
  'Scottland FC head into the new Castle Lager PSL season as defending champions. Will they retain the title?',
  '["Yes, back-to-back", "No, a challenger wins it", "Too close to call"]'::jsonb,
  '{}'::jsonb,
  NULL,
  (SELECT id FROM profiles WHERE username = 'admin')
),
(
  'Which Castle Lager PSL club are you backing this season?',
  '["Dynamos FC", "Highlanders FC", "CAPS United FC", "FC Platinum", "Ngezi Platinum Stars FC", "Chicken Inn FC", "Simba Bhora FC", "Scottland FC"]'::jsonb,
  '{}'::jsonb,
  NULL,
  (SELECT id FROM profiles WHERE username = 'admin')
),
(
  'Southern Rocks are the reigning Logan Cup champions after their 2025-26 title. Which franchise wins it this year?',
  '["Mountaineers", "Mashonaland Eagles", "Matabeleland Tuskers", "Mid West Rhinos", "Southern Rocks"]'::jsonb,
  '{}'::jsonb,
  NULL,
  (SELECT id FROM profiles WHERE username = 'admin')
),
(
  'Which club lifts this year''s National Rugby League title?',
  '["Harare Sports Club", "Old Georgians", "Old Hararians", "Old Miltonians", "Matabeleland Warriors", "Western Panthers", "Gweru Sports Club", "Zvishavane Bulls"]'::jsonb,
  '{}'::jsonb,
  NULL,
  (SELECT id FROM profiles WHERE username = 'admin')
),
(
  'Which sport are you most excited to follow this season?',
  '["Football", "Cricket", "Rugby", "All three equally"]'::jsonb,
  '{}'::jsonb,
  NULL,
  (SELECT id FROM profiles WHERE username = 'admin')
);
