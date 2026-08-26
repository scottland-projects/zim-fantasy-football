-- =============================================
-- SECURITY-QUESTION ACCOUNT RECOVERY (2026-08-26)
--
-- Registration no longer collects email or phone (see the username-only
-- signup change), which means Supabase's normal "email a reset link" flow
-- can never work for these accounts — there's no real address to send to.
-- Two required security questions at signup replace it as the recovery
-- path. Answers are hashed with pgcrypto (bcrypt via crypt()/gen_salt),
-- same as a password — never stored or returned in plaintext, and never
-- readable by the client at all (RLS enabled, zero policies — service-role
-- only, same pattern as login_attempts/signup_attempts below).
-- =============================================

CREATE TABLE IF NOT EXISTS recovery_questions (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  question_1 TEXT NOT NULL,
  answer_1_hash TEXT NOT NULL,
  question_2 TEXT NOT NULL,
  answer_2_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE recovery_questions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS recovery_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_username_time ON recovery_attempts (username, created_at);
ALTER TABLE recovery_attempts ENABLE ROW LEVEL SECURITY;

-- Called once, at signup, via the service role (lib/actions/auth.ts).
CREATE OR REPLACE FUNCTION set_recovery_questions(
  p_user_id UUID, p_q1 TEXT, p_a1 TEXT, p_q2 TEXT, p_a2 TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO recovery_questions (user_id, question_1, answer_1_hash, question_2, answer_2_hash)
  VALUES (
    p_user_id, p_q1, crypt(lower(trim(p_a1)), gen_salt('bf')),
    p_q2, crypt(lower(trim(p_a2)), gen_salt('bf'))
  )
  ON CONFLICT (user_id) DO UPDATE SET
    question_1 = EXCLUDED.question_1, answer_1_hash = EXCLUDED.answer_1_hash,
    question_2 = EXCLUDED.question_2, answer_2_hash = EXCLUDED.answer_2_hash;
END;
$$;
REVOKE EXECUTE ON FUNCTION set_recovery_questions FROM PUBLIC, anon, authenticated;

-- Returns just the question TEXT for a username — never the answer hashes
-- — so the recovery page can show what to answer before the user proves
-- anything. Usernames are public @handles shown throughout the app (not
-- secret like an email), so confirming one exists here isn't a new leak.
CREATE OR REPLACE FUNCTION get_recovery_questions(p_username TEXT)
RETURNS TABLE(question_1 TEXT, question_2 TEXT) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT rq.question_1, rq.question_2
  FROM recovery_questions rq
  JOIN profiles p ON p.id = rq.user_id
  WHERE lower(p.username) = lower(p_username);
END;
$$;
REVOKE EXECUTE ON FUNCTION get_recovery_questions FROM PUBLIC, anon, authenticated;

-- Returns the user_id on a correct pair of answers, NULL otherwise — the
-- caller (recoverAccountAction) then resets the password via the Admin
-- API, this function never touches auth.users itself.
CREATE OR REPLACE FUNCTION verify_recovery_answers(p_username TEXT, p_a1 TEXT, p_a2 TEXT)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT rq.user_id, rq.answer_1_hash, rq.answer_2_hash INTO v_row
  FROM recovery_questions rq
  JOIN profiles p ON p.id = rq.user_id
  WHERE lower(p.username) = lower(p_username);

  IF v_row IS NULL THEN RETURN NULL; END IF;

  IF crypt(lower(trim(p_a1)), v_row.answer_1_hash) = v_row.answer_1_hash
     AND crypt(lower(trim(p_a2)), v_row.answer_2_hash) = v_row.answer_2_hash THEN
    RETURN v_row.user_id;
  END IF;

  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION verify_recovery_answers FROM PUBLIC, anon, authenticated;
