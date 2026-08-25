-- Corrects domestic-competition seed data after a fresh multi-source
-- research pass (web search + primary sources: Wikipedia, Herald/Sunday
-- News/Chronicle Zimbabwe, the Zimbabwe Rugby Union), triggered by a user
-- question about whether the 2026-08-24 seeding pass had actually found
-- every real competition/team. See docs/test-data.md for the full
-- reasoning and sources.
--
-- Football: "Agama FC" is actually "Agama United FC" — the club promoted
-- into the Castle Lager Premier Soccer League this season under that name.
--
-- Rugby: the previous 10-club roster modeled Zimbabwe's domestic rugby as
-- two disjoint provincial leagues (Bulawayo vs Harare) that never
-- cross-play. That's wrong — it's one unified "National Rugby League"
-- (historically nicknamed the "Super Six"). Four clubs had no verifiable
-- tie to this competition (Bulldogs, Mahogany Bulls, Pitbulls RFC, and
-- Highlanders — confirmed via the ZRU to play in a separate "Intercity
-- League" instead) and are removed; two real member clubs were missing
-- (Gweru Sports Club, Zvishavane Bulls) and are added; one club's name was
-- wrong ("Western Suburbs Panthers" — the real name is "Western
-- Panthers") and is corrected. All rugby fixtures are regenerated for the
-- corrected 8-club roster as a single round-robin (the old fixtures
-- referenced now-invalid team names and are deleted; this cascades to
-- their score_predictions via score_predictions_match_id_fkey ON DELETE
-- CASCADE). Achievement badges that were only earned via a
-- since-deleted rugby prediction (9x multi_sport_fan, 1x triple_threat)
-- are removed so no user is left holding a trophy their data no longer
-- supports.

-- ── Football: Agama FC -> Agama United FC ──────────────────────────────
UPDATE teams   SET name = 'Agama United FC', short_name = 'AGU' WHERE name = 'Agama FC' AND sport = 'football';
UPDATE players SET club = 'Agama United FC' WHERE club = 'Agama FC';
UPDATE matches SET home_team = 'Agama United FC' WHERE home_team = 'Agama FC' AND sport = 'football';
UPDATE matches SET away_team = 'Agama United FC' WHERE away_team = 'Agama FC' AND sport = 'football';

-- ── Rugby: correct the club roster ──────────────────────────────────────
UPDATE teams SET name = 'Western Panthers', short_name = 'WP'
  WHERE name = 'Western Suburbs Panthers' AND sport = 'rugby';

DELETE FROM teams WHERE sport = 'rugby'
  AND name IN ('Bulldogs', 'Highlanders', 'Mahogany Bulls', 'Pitbulls RFC');

INSERT INTO teams (name, short_name, city, primary_color, sport) VALUES
  ('Gweru Sports Club', 'GSC', 'Gweru',      '#EA580C', 'rugby'),
  ('Zvishavane Bulls',  'ZVB', 'Zvishavane', '#7C2D12', 'rugby')
ON CONFLICT DO NOTHING;

-- ── Rugby: regenerate fixtures for the corrected 8-club roster ─────────
-- The old fixtures referenced teams that no longer exist; deleting them
-- cascades to their score_predictions automatically.
DELETE FROM matches WHERE sport = 'rugby';

INSERT INTO matches (home_team, away_team, kickoff_time, status, matchday, season, sport, home_score, away_score) VALUES
  ('Harare Sports Club',   'Zvishavane Bulls',      NOW() - INTERVAL '15 days', 'finished', 1, '2026', 'rugby', 24, 17),
  ('Old Georgians',        'Gweru Sports Club',     NOW() - INTERVAL '15 days', 'finished', 1, '2026', 'rugby', 31, 12),
  ('Old Hararians',        'Western Panthers',      NOW() - INTERVAL '15 days', 'finished', 1, '2026', 'rugby', 19, 22),
  ('Old Miltonians',       'Matabeleland Warriors',  NOW() - INTERVAL '15 days', 'finished', 1, '2026', 'rugby', 27, 9),

  ('Harare Sports Club',   'Gweru Sports Club',     NOW() - INTERVAL '8 days',  'finished', 2, '2026', 'rugby', 20, 18),
  ('Zvishavane Bulls',     'Western Panthers',      NOW() - INTERVAL '8 days',  'finished', 2, '2026', 'rugby', 15, 15),
  ('Old Georgians',        'Matabeleland Warriors',  NOW() - INTERVAL '8 days',  'finished', 2, '2026', 'rugby', 24, 13),
  ('Old Hararians',        'Old Miltonians',        NOW() - INTERVAL '8 days',  'finished', 2, '2026', 'rugby', 17, 17),

  ('Harare Sports Club',   'Western Panthers',      NOW() + INTERVAL '1 day',   'scheduled', 3, '2026', 'rugby', NULL, NULL),
  ('Gweru Sports Club',    'Matabeleland Warriors',  NOW() + INTERVAL '1 day',   'scheduled', 3, '2026', 'rugby', NULL, NULL),
  ('Zvishavane Bulls',     'Old Miltonians',        NOW() + INTERVAL '1 day',   'scheduled', 3, '2026', 'rugby', NULL, NULL),
  ('Old Georgians',        'Old Hararians',         NOW() + INTERVAL '1 day',   'scheduled', 3, '2026', 'rugby', NULL, NULL),

  ('Harare Sports Club',   'Matabeleland Warriors',  NOW() + INTERVAL '8 days',  'scheduled', 4, '2026', 'rugby', NULL, NULL),
  ('Western Panthers',     'Old Miltonians',        NOW() + INTERVAL '8 days',  'scheduled', 4, '2026', 'rugby', NULL, NULL),
  ('Gweru Sports Club',    'Old Hararians',         NOW() + INTERVAL '8 days',  'scheduled', 4, '2026', 'rugby', NULL, NULL),
  ('Zvishavane Bulls',     'Old Georgians',         NOW() + INTERVAL '8 days',  'scheduled', 4, '2026', 'rugby', NULL, NULL)
ON CONFLICT DO NOTHING;

-- ── Achievements: drop badges no longer supported by current predictions ──
WITH sport_counts AS (
  SELECT sp.user_id, COUNT(DISTINCT m.sport) AS n_sports
  FROM score_predictions sp JOIN matches m ON sp.match_id = m.id
  GROUP BY sp.user_id
)
DELETE FROM achievements a
USING (
  SELECT a2.id FROM achievements a2
  LEFT JOIN sport_counts sc ON sc.user_id = a2.user_id
  WHERE a2.badge_key IN ('multi_sport_fan', 'triple_threat')
    AND COALESCE(sc.n_sports, 0) < (CASE WHEN a2.badge_key = 'triple_threat' THEN 3 ELSE 2 END)
) stale
WHERE a.id = stale.id;
