-- Previously cast_poll_vote() rejected a second vote outright ("already
-- voted"). Users asked whether they should be able to change their vote —
-- decided yes, with one safeguard: changing a vote moves the tally from the
-- old option to the new one but does NOT grant another +5 XP, so flipping a
-- pick back and forth can't be used to farm XP. Re-picking the same option
-- you already chose is a no-op (not an error, not a re-count).
--
-- See lib/supabase/schema.sql's cast_poll_vote() for the full function with
-- context comments — this migration mirrors that same replacement against
-- the live database.

CREATE OR REPLACE FUNCTION public.cast_poll_vote(p_poll_id uuid, p_option text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user     UUID := auth.uid();
  v_existing TEXT;
  v_votes    JSONB;
  v_new      JSONB;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not authenticated'); END IF;

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

  IF v_existing IS NULL THEN
    PERFORM _grant_xp_unchecked(v_user, 5);
  END IF;

  RETURN jsonb_build_object('ok', true, 'votes', v_new, 'choice', p_option, 'changed', v_existing IS NOT NULL);
END;
$function$
