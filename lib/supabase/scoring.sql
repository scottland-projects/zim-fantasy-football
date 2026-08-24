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

CREATE OR REPLACE FUNCTION recalculate_single_team_points(
  p_team_id  UUID,
  p_matchday INTEGER,
  p_season   TEXT DEFAULT '2026'
)
RETURNS INTEGER
LANGUAGE plpgsql
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


-- ─── 7. Least-privilege grants ────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION calculate_player_match_points TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_matchday_team_points TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_single_team_points TO authenticated;
GRANT EXECUTE ON FUNCTION reverse_matchday_team_points TO authenticated;
REVOKE EXECUTE ON FUNCTION recalculate_matchday_team_points FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION recalculate_single_team_points FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION reverse_matchday_team_points FROM PUBLIC, anon;
