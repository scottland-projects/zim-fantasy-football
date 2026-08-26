-- Backfills recovery_questions for every account that existed before that
-- feature shipped (admin + all seeded demo users) — none of them went
-- through usernameSignUpAction, so none had a row. New signups already get
-- their own real questions/answers at signup time; this is a one-time
-- catch-up for pre-existing accounts using a single shared, documented
-- pair (see docs/test-data.md) — fine for demo/seed accounts, not meant as
-- a real per-user answer.
INSERT INTO recovery_questions (user_id, question_1, answer_1_hash, question_2, answer_2_hash)
SELECT
  id,
  'What was the first sports team you ever supported?', crypt('highlanders', gen_salt('bf')),
  'What was your childhood nickname?', crypt('testuser2026', gen_salt('bf'))
FROM profiles
ON CONFLICT (user_id) DO NOTHING;
