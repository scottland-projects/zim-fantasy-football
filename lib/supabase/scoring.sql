-- =============================================
-- SCORING ENGINE — AFRICA FANTASY
-- =============================================
-- Run this file in the Supabase SQL editor AFTER schema.sql
--
-- Scoring rules:
--   Playing time  ≥ 1  min  : +1 pt (all)
--   Playing time  ≥ 60 min  : +1 pt bonus (all)
--   Goal (GK)               : +10 pts
--   Goal (DEF)               : +6  pts
--   Goal (MID)               : +5  pts
--   Goal (FWD)               : +4  pts
--   Assist (all)             : +3  pts
--   Clean sheet GK/DEF ≥60' : +4  pts
--   Clean sheet MID    ≥60' : +1  pt
--   Yellow card              : -1  pt
--   Red card                 : -3  pts
--   Captain multiplier       : ×2  on total player points
--   Vice-captain multiplier  : ×1.5 on total player points
-- =============================================

-- ─── 1. Pure scoring formula ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_player_match_points(
  p_position     TEXT,
  p_goals        INTEGER,
  p_assists      INTEGER,
  p_yellow_cards INTEGER,
  p_red_cards    INTEGER,
  p_clean_sheet  BOOLEAN,
  p_minutes      INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  pts INTEGER := 0;
BEGIN
  IF p_minutes >= 1  THEN pts := pts + 1; END IF;
  IF p_minutes >= 60 THEN pts := pts + 1; END IF;

  CASE p_position
    WHEN 'GK'  THEN pts := pts + (p_goals * 10);
    WHEN 'DEF' THEN pts := pts + (p_goals * 6);
    WHEN 'MID' THEN pts := pts + (p_goals * 5);
    WHEN 'FWD' THEN pts := pts + (p_goals * 4);
    ELSE             pts := pts + (p_goals * 4);
  END CASE;

  pts := pts + (p_assists * 3);

  IF p_clean_sheet AND p_minutes >= 60 THEN
    CASE p_position
      WHEN 'GK'  THEN pts := pts + 4;
      WHEN 'DEF' THEN pts := pts + 4;
      WHEN 'MID' THEN pts := pts + 1;
      ELSE             pts := pts + 0;
    END CASE;
  END IF;

  pts := pts - (p_yellow_cards * 1);
  pts := pts - (p_red_cards    * 3);

  RETURN GREATEST(pts, 0);
END;
$$;


-- ─── 2. Trigger: auto-calculate fantasy_points on insert/update ─────────────

CREATE OR REPLACE FUNCTION trg_calc_stat_points()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_position TEXT;
BEGIN
  SELECT position INTO v_position FROM players WHERE id = NEW.player_id;

  NEW.fantasy_points := calculate_player_match_points(
    v_position,
    NEW.goals,
    NEW.assists,
    NEW.yellow_cards,
    NEW.red_cards,
    NEW.clean_sheet,
    NEW.minutes_played
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_stat_upsert ON player_match_stats;
CREATE TRIGGER on_stat_upsert
  BEFORE INSERT OR UPDATE ON player_match_stats
  FOR EACH ROW EXECUTE FUNCTION trg_calc_stat_points();


-- ─── 3. Trigger: roll up player career totals after a stat row saves ─────────

CREATE OR REPLACE FUNCTION trg_rollup_player_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE players
  SET
    total_points   = (SELECT COALESCE(SUM(fantasy_points), 0) FROM player_match_stats WHERE player_id = NEW.player_id),
    goals          = (SELECT COALESCE(SUM(goals),          0) FROM player_match_stats WHERE player_id = NEW.player_id),
    assists        = (SELECT COALESCE(SUM(assists),        0) FROM player_match_stats WHERE player_id = NEW.player_id),
    clean_sheets   = (SELECT COALESCE(COUNT(*), 0)            FROM player_match_stats WHERE player_id = NEW.player_id AND clean_sheet = TRUE),
    yellow_cards   = (SELECT COALESCE(SUM(yellow_cards),   0) FROM player_match_stats WHERE player_id = NEW.player_id),
    red_cards      = (SELECT COALESCE(SUM(red_cards),      0) FROM player_match_stats WHERE player_id = NEW.player_id),
    minutes_played = (SELECT COALESCE(SUM(minutes_played), 0) FROM player_match_stats WHERE player_id = NEW.player_id)
  WHERE id = NEW.player_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_stat_saved ON player_match_stats;
CREATE TRIGGER on_stat_saved
  AFTER INSERT OR UPDATE ON player_match_stats
  FOR EACH ROW EXECUTE FUNCTION trg_rollup_player_totals();


-- ─── 4. Function: recalculate all fantasy team scores for a matchday ─────────
--
-- Call this after all player_match_stats for a matchday are entered:
--   SELECT recalculate_matchday_team_points(3, '2026');
--
-- Every scoring/XP RPC below is reachable directly via PostgREST by any
-- authenticated user with a valid session, not only through the app's
-- admin-gated server actions — so each one checks the caller's role itself
-- rather than trusting the caller to already be authorized.

CREATE OR REPLACE FUNCTION recalculate_matchday_team_points(
  p_matchday INTEGER,
  p_season   TEXT DEFAULT '2026'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  v_team_matchday_pts INTEGER;
  v_player_pts        INTEGER;
  v_multiplier        NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR rec IN
    SELECT DISTINCT ft.id AS team_id, ft.user_id
    FROM fantasy_teams ft
  LOOP
    v_team_matchday_pts := 0;

    DECLARE
      player_rec RECORD;
    BEGIN
      FOR player_rec IN
        SELECT
          ftp.player_id,
          ftp.is_captain,
          ftp.is_vice_captain,
          ftp.is_starting,
          COALESCE(pms.fantasy_points, 0) AS match_pts,
          COALESCE(pms.minutes_played, 0) AS minutes
        FROM fantasy_team_players ftp
        LEFT JOIN player_match_stats pms
          ON pms.player_id = ftp.player_id
          AND pms.match_id IN (
            SELECT id FROM matches
            WHERE matchday = p_matchday AND season = p_season
          )
        WHERE ftp.fantasy_team_id = rec.team_id
          AND ftp.is_starting = TRUE
      LOOP
        v_player_pts := player_rec.match_pts;

        IF player_rec.is_captain THEN
          v_multiplier := 2.0;
        ELSIF player_rec.is_vice_captain THEN
          v_multiplier := 1.5;
        ELSE
          v_multiplier := 1.0;
        END IF;

        v_team_matchday_pts := v_team_matchday_pts + FLOOR(v_player_pts * v_multiplier);
      END LOOP;
    END;

    UPDATE fantasy_teams
    SET
      weekly_points = v_team_matchday_pts,
      total_points  = total_points + v_team_matchday_pts,
      updated_at    = NOW()
    WHERE id = rec.team_id;

    UPDATE profiles
    SET
      fantasy_points = (SELECT total_points FROM fantasy_teams WHERE id = rec.team_id),
      updated_at     = NOW()
    WHERE id = rec.user_id;

    UPDATE league_members
    SET
      points        = (SELECT total_points FROM fantasy_teams WHERE id = rec.team_id),
      weekly_points = v_team_matchday_pts
    WHERE user_id = rec.user_id;

  END LOOP;

  UPDATE league_members lm
  SET rank = sub.new_rank
  FROM (
    SELECT
      id,
      RANK() OVER (PARTITION BY league_id ORDER BY points DESC) AS new_rank
    FROM league_members
  ) sub
  WHERE lm.id = sub.id;

END;
$$;


-- ─── 5. Convenience: recalculate points for a single team (e.g. after a      ─
--        late transfer). Call from admin or an API route.                       ─
--        SELECT recalculate_single_team_points('<team_uuid>', 3, '2026');   ─

-- SECURITY DEFINER: was INVOKER, relying on the calling admin/manager's
-- own table grants for its internal UPDATEs to fantasy_teams and profiles
-- — grants that were far broader than they should have been (see the
-- profiles/fantasy_teams REVOKE comments in schema.sql) and have since
-- been narrowed. The auth.uid()-based role check below is unaffected by
-- SECURITY DEFINER (auth.uid() always reflects the real session) and
-- remains the actual authorization gate — this only changes which role's
-- grants satisfy the internal writes, matching every other privileged
-- function in this schema.
CREATE OR REPLACE FUNCTION recalculate_single_team_points(
  p_team_id  UUID,
  p_matchday INTEGER,
  p_season   TEXT DEFAULT '2026'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_pts   INTEGER := 0;
  player_rec   RECORD;
  v_multiplier NUMERIC;
  v_user_id    UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT user_id INTO v_user_id FROM fantasy_teams WHERE id = p_team_id;

  FOR player_rec IN
    SELECT
      ftp.player_id,
      ftp.is_captain,
      ftp.is_vice_captain,
      COALESCE(pms.fantasy_points, 0) AS match_pts
    FROM fantasy_team_players ftp
    LEFT JOIN player_match_stats pms
      ON pms.player_id = ftp.player_id
      AND pms.match_id IN (
        SELECT id FROM matches
        WHERE matchday = p_matchday AND season = p_season
      )
    WHERE ftp.fantasy_team_id = p_team_id
      AND ftp.is_starting = TRUE
  LOOP
    IF player_rec.is_captain THEN
      v_multiplier := 2.0;
    ELSIF player_rec.is_vice_captain THEN
      v_multiplier := 1.5;
    ELSE
      v_multiplier := 1.0;
    END IF;

    v_team_pts := v_team_pts + FLOOR(player_rec.match_pts * v_multiplier);
  END LOOP;

  UPDATE fantasy_teams
  SET weekly_points = v_team_pts, updated_at = NOW()
  WHERE id = p_team_id;

  UPDATE profiles
  SET fantasy_points = (SELECT total_points FROM fantasy_teams WHERE id = p_team_id)
  WHERE id = v_user_id;

  RETURN v_team_pts;
END;
$$;


-- ─── 6. Convenience: reverse a matchday's points (used when re-opening a     ─
--        match for correction). SELECT reverse_matchday_team_points(3,'2026'); ─

CREATE OR REPLACE FUNCTION reverse_matchday_team_points(
  p_matchday INTEGER,
  p_season   TEXT DEFAULT '2026'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE rec RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR rec IN SELECT id, user_id, weekly_points FROM fantasy_teams LOOP
    UPDATE fantasy_teams
    SET total_points  = GREATEST(0, total_points - weekly_points),
        weekly_points = 0,
        updated_at    = NOW()
    WHERE id = rec.id;

    UPDATE profiles
    SET fantasy_points = (SELECT total_points FROM fantasy_teams WHERE id = rec.id),
        updated_at     = NOW()
    WHERE id = rec.user_id;

    UPDATE league_members
    SET points        = (SELECT total_points FROM fantasy_teams WHERE id = rec.id),
        weekly_points = 0
    WHERE user_id = rec.user_id;
  END LOOP;

  UPDATE league_members lm
  SET rank = sub.new_rank
  FROM (
    SELECT id, RANK() OVER (PARTITION BY league_id ORDER BY points DESC) AS new_rank
    FROM league_members
  ) sub
  WHERE lm.id = sub.id;
END;
$$;


-- ─── 8. Score-prediction points — separate lightweight game mode ────────────
--
-- Scoring rules (classic 3-2-1-0 scheme):
--   Exact scoreline                        : 3 pts
--   Correct outcome + correct goal margin  : 2 pts
--   Correct outcome only (W/D/L)           : 1 pt
--   Wrong outcome                          : 0 pts

CREATE OR REPLACE FUNCTION calculate_prediction_points(
  p_pred_home   INTEGER,
  p_pred_away   INTEGER,
  p_actual_home INTEGER,
  p_actual_away INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  pred_outcome   TEXT;
  actual_outcome TEXT;
BEGIN
  IF p_pred_home = p_actual_home AND p_pred_away = p_actual_away THEN
    RETURN 3;
  END IF;

  pred_outcome   := CASE WHEN p_pred_home   > p_pred_away   THEN 'H' WHEN p_pred_home   < p_pred_away   THEN 'A' ELSE 'D' END;
  actual_outcome := CASE WHEN p_actual_home > p_actual_away THEN 'H' WHEN p_actual_home < p_actual_away THEN 'A' ELSE 'D' END;

  IF pred_outcome <> actual_outcome THEN
    RETURN 0;
  END IF;

  IF (p_pred_home - p_pred_away) = (p_actual_home - p_actual_away) THEN
    RETURN 2;
  END IF;

  RETURN 1;
END;
$$;

-- Call after a match's home_score/away_score are finalised (the admin panel
-- does this from saveMatchStatsAction right after marking the match
-- 'finished'). Scores every prediction on that match in one pass.
CREATE OR REPLACE FUNCTION score_predictions_for_match(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_home INTEGER;
  v_away INTEGER;
  v_user_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT home_score, away_score INTO v_home, v_away FROM matches WHERE id = p_match_id;
  IF v_home IS NULL OR v_away IS NULL THEN
    RAISE EXCEPTION 'match has no final score yet';
  END IF;

  UPDATE score_predictions
  SET points_earned = calculate_prediction_points(predicted_home_score, predicted_away_score, v_home, v_away),
      updated_at    = NOW()
  WHERE match_id = p_match_id;

  -- Check cross-sport achievements (streaks, multi-sport badges, etc.) for
  -- everyone whose prediction on this match just got scored — this is how
  -- a predictions-only user earns achievements at all, since award_achievements
  -- previously only ran from the football-fantasy scoring chain.
  FOR v_user_id IN SELECT DISTINCT user_id FROM score_predictions WHERE match_id = p_match_id LOOP
    PERFORM award_achievements(v_user_id);
  END LOOP;
END;
$$;

-- Counterpart to reopenMatchAction — clears points when a match is reopened
-- for a stat correction, so stale points don't linger on the leaderboard.
CREATE OR REPLACE FUNCTION reverse_predictions_for_match(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE score_predictions SET points_earned = NULL, updated_at = NOW() WHERE match_id = p_match_id;
END;
$$;


-- ─── 9. Prediction reminders — closing-soon notifications ───────────────────
--
-- Scheduled via pg_cron (see the bottom of this file) to run every 15
-- minutes. No auth.uid() check — pg_cron invokes this outside any user
-- session, so it can't be admin/manager-gated the normal way. It's not
-- exposed to PostgREST either (REVOKE'd from every client-facing role
-- below), so the only way to trigger it is the cron schedule itself.

CREATE OR REPLACE FUNCTION send_prediction_reminders()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  m RECORD;
BEGIN
  FOR m IN
    SELECT id, home_team, away_team, sport, kickoff_time
    FROM matches
    WHERE status = 'scheduled'
      AND reminder_sent_at IS NULL
      AND kickoff_time BETWEEN NOW() AND NOW() + INTERVAL '60 minutes'
  LOOP
    INSERT INTO notifications (user_id, title, body, type)
    SELECT
      p.id,
      'Predictions closing soon ⏰',
      m.home_team || ' vs ' || m.away_team || ' kicks off within the hour — get your ' || m.sport || ' prediction in before it locks.',
      'prediction'
    FROM profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM score_predictions sp WHERE sp.match_id = m.id AND sp.user_id = p.id
    );

    UPDATE matches SET reminder_sent_at = NOW() WHERE id = m.id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION send_prediction_reminders FROM PUBLIC, anon, authenticated;


-- ─── 10. Prediction streak — consecutive correct predictions for one sport ──
--
-- Computed on demand rather than stored, so it self-heals no matter what
-- order matches get finished in (an admin correcting an older match after a
-- newer one has already been scored wouldn't desync a stored counter).
-- "Correct" here means any nonzero prediction score (at least got the
-- winner/draw right), not just an exact scoreline.

CREATE OR REPLACE FUNCTION get_prediction_streak(p_user_id UUID, p_sport TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  v_streak INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT sp.points_earned
    FROM score_predictions sp
    JOIN matches m ON m.id = sp.match_id
    WHERE sp.user_id = p_user_id AND m.sport = p_sport AND sp.points_earned IS NOT NULL
    ORDER BY m.kickoff_time DESC
  LOOP
    EXIT WHEN rec.points_earned = 0;
    v_streak := v_streak + 1;
  END LOOP;
  RETURN v_streak;
END;
$$;

GRANT EXECUTE ON FUNCTION get_prediction_streak TO authenticated;
REVOKE EXECUTE ON FUNCTION get_prediction_streak FROM PUBLIC, anon;


-- ─── 11. Least-privilege grants ────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION calculate_player_match_points TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_matchday_team_points TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_single_team_points TO authenticated;
GRANT EXECUTE ON FUNCTION reverse_matchday_team_points TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_prediction_points TO authenticated;
GRANT EXECUTE ON FUNCTION score_predictions_for_match TO authenticated;
GRANT EXECUTE ON FUNCTION reverse_predictions_for_match TO authenticated;
REVOKE EXECUTE ON FUNCTION recalculate_matchday_team_points FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION recalculate_single_team_points FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION reverse_matchday_team_points FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION score_predictions_for_match FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION reverse_predictions_for_match FROM PUBLIC, anon;


-- ─── 12. Schedule the prediction-reminder job ────────────────────────────
--
-- Requires the pg_cron extension (Supabase supports this on all paid plans
-- and most free-tier projects — enable it under Database → Extensions if
-- the CREATE EXTENSION line below errors). Re-running this block is safe:
-- cron.schedule() on an existing job name updates it in place.

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'prediction-reminders',
  '*/15 * * * *',
  $$SELECT send_prediction_reminders();$$
);
