-- =============================================
-- ACHIEVEMENTS ENGINE — AFRICA FANTASY
-- =============================================
-- Run AFTER scoring.sql.
-- Call recalculate_matchday_team_points() normally —
-- it will call award_all_achievements() automatically.
--
-- XP rewards per badge:
--   top_scorer         200 XP  (fantasy team — football)
--   top_manager        500 XP  (fantasy team — football)
--   trophy_md_winner   300 XP  (fantasy team — football)
--   trophy_fan_fav     150 XP  (community chat — any sport)
--   transfer_master    200 XP  (fantasy team — football)
--   die_hard           100 XP  (fantasy team — football)
--   unbeaten           250 XP  (fantasy team — football)
--   hot_streak         150 XP  (predictions — any sport)
--   century_predictor  250 XP  (predictions — all sports combined)
--   sharpshooter       300 XP  (predictions — any sport)
--   multi_sport_fan    200 XP  (predictions — 2+ sports)
--   triple_threat      400 XP  (predictions — all 3 sports)
--   group_founder      100 XP  (groups — any sport)
--   poll_master        150 XP  (groups — any sport)
--
-- The last 6 need no fantasy squad at all — a predictions-only or
-- polls-only user can earn a full set of badges without ever touching
-- Fantasy Teams.
--
-- Level system: level N requires N*1000 XP to advance.
-- XP is tracked within the current level (resets on level-up).
-- =============================================


-- ─── Helper: grant XP and level up if threshold crossed ─────────────────────
--
-- Reachable directly via PostgREST by any authenticated user, not only
-- through the app's admin-gated server actions — without the role check
-- below, a plain "user" account could call this directly to self-boost
-- their own XP/level on demand.

CREATE OR REPLACE FUNCTION grant_xp(p_user_id UUID, p_xp INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_xp    INTEGER;
  v_level INTEGER;
  v_threshold INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT xp, level INTO v_xp, v_level FROM profiles WHERE id = p_user_id;
  v_xp    := COALESCE(v_xp, 0) + p_xp;
  v_level := COALESCE(v_level, 1);

  -- Level up as many times as needed
  LOOP
    v_threshold := v_level * 1000;
    EXIT WHEN v_xp < v_threshold OR v_level >= 10;
    v_xp    := v_xp - v_threshold;
    v_level := v_level + 1;

    -- Notify on level-up
    INSERT INTO notifications (user_id, title, body, type)
    VALUES (
      p_user_id,
      'Level Up! ' || v_level || ' 🎉',
      'You reached Level ' || v_level || ' — ' ||
        CASE v_level
          WHEN 2  THEN 'Junior Fan'
          WHEN 3  THEN 'Dedicated Fan'
          WHEN 4  THEN 'Faithful Supporter'
          WHEN 5  THEN 'Die-Hard Supporter'
          WHEN 6  THEN 'Legend'
          WHEN 7  THEN 'Club Icon'
          WHEN 8  THEN 'Fantasy Master'
          WHEN 9  THEN 'Zim Football Immortal'
          WHEN 10 THEN 'The Chosen One'
          ELSE         'Manager'
        END || '!',
      'reward'
    );
  END LOOP;

  UPDATE profiles SET xp = v_xp, level = v_level WHERE id = p_user_id;
END;
$$;


-- ─── Core: evaluate and award all badges for one user ───────────────────────

CREATE OR REPLACE FUNCTION award_achievements(p_user_id UUID)
RETURNS INTEGER   -- number of NEW badges awarded this call
LANGUAGE plpgsql
SECURITY DEFINER  -- the achievements table has no INSERT policy at all (by
                   -- design — the only legitimate writer is this function),
                   -- so without DEFINER every INSERT here would fail RLS
                   -- for every caller, admin included. This was a live,
                   -- pre-existing bug — no achievement had ever successfully
                   -- been inserted through this function before this fix,
                   -- for any user, regardless of how it was triggered.
AS $$
DECLARE
  v_new         INTEGER := 0;
  v_total_pts   INTEGER;
  v_weekly_pts  INTEGER;
  v_global_rank INTEGER;
  v_max_weekly  INTEGER;
  v_msg_count   BIGINT;
  v_squad_size  BIGINT;
  v_days_member INTEGER;

  -- Cross-sport / cross-mode stats — these are what let a predictions-only
  -- or polls-only user unlock anything at all. Before this, every badge
  -- above required a fantasy squad, so someone who never touched Fantasy
  -- Teams could never earn a single achievement, no matter how engaged.
  v_pred_points   INTEGER;
  v_sports_played INTEGER;
  v_exact_count   INTEGER;
  v_best_streak   INTEGER;
  v_poll_count    INTEGER;
  v_league_owned  INTEGER;

  -- Reusable flag: did the last INSERT create a new row?
  v_inserted BOOLEAN;
BEGIN
  -- Now reachable as a side effect of ordinary user actions (predictions
  -- scoring, creating a group poll) rather than only admin-triggered ones,
  -- so this can no longer rely on grant_xp's own admin/manager check to
  -- keep it from being called directly on an arbitrary target user —
  -- restrict it to checking your own achievements, or an admin/manager
  -- checking anyone's (the award_all_achievements bulk path).
  IF auth.uid() IS DISTINCT FROM p_user_id
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RETURN 0;
  END IF;

  -- ── Gather stats ──────────────────────────────────────────────────────────
  SELECT COALESCE(fantasy_points, 0),
         EXTRACT(DAY FROM NOW() - created_at)::INTEGER
  INTO   v_total_pts, v_days_member
  FROM   profiles WHERE id = p_user_id;

  SELECT COALESCE(weekly_points, 0) INTO v_weekly_pts
  FROM   fantasy_teams WHERE user_id = p_user_id;

  -- Global rank = number of users with MORE points + 1
  SELECT COUNT(*) + 1 INTO v_global_rank
  FROM   profiles WHERE fantasy_points > v_total_pts;

  -- Highest weekly score across all teams (used for Matchday Winner)
  SELECT COALESCE(MAX(weekly_points), 0) INTO v_max_weekly FROM fantasy_teams;

  SELECT COUNT(*) INTO v_msg_count FROM chat_messages WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_squad_size
  FROM   fantasy_team_players ftp
  JOIN   fantasy_teams ft ON ft.id = ftp.fantasy_team_id
  WHERE  ft.user_id = p_user_id;

  SELECT COALESCE(SUM(sp.points_earned), 0) INTO v_pred_points
  FROM   score_predictions sp WHERE sp.user_id = p_user_id AND sp.points_earned IS NOT NULL;

  SELECT COUNT(DISTINCT m.sport) INTO v_sports_played
  FROM   score_predictions sp JOIN matches m ON m.id = sp.match_id
  WHERE  sp.user_id = p_user_id AND sp.points_earned IS NOT NULL;

  SELECT COUNT(*) INTO v_exact_count
  FROM   score_predictions sp WHERE sp.user_id = p_user_id AND sp.points_earned = 3;

  SELECT GREATEST(
    get_prediction_streak(p_user_id, 'football'),
    get_prediction_streak(p_user_id, 'cricket'),
    get_prediction_streak(p_user_id, 'rugby')
  ) INTO v_best_streak;

  SELECT COUNT(*) INTO v_poll_count   FROM polls   WHERE created_by = p_user_id;
  SELECT COUNT(*) INTO v_league_owned FROM leagues WHERE owner_id   = p_user_id;

  -- ── Revoke badges whose conditions are no longer met ─────────────────────
  -- Top Scorer: must still be in top 100 AND have played (pts > 0)
  DELETE FROM achievements
  WHERE user_id = p_user_id AND badge_key = 'top_scorer'
    AND (v_global_rank > 100 OR v_total_pts = 0);

  -- Top Manager: must still be in top 10 AND have played (pts > 0)
  DELETE FROM achievements
  WHERE user_id = p_user_id AND badge_key = 'top_manager'
    AND (v_global_rank > 10 OR v_total_pts = 0);

  -- Fan Favourite: still needs 50+ messages
  DELETE FROM achievements
  WHERE user_id = p_user_id AND badge_key = 'trophy_fan_favourite'
    AND v_msg_count < 50;

  -- Transfer Master: still needs 15+ squad players
  DELETE FROM achievements
  WHERE user_id = p_user_id AND badge_key = 'transfer_master'
    AND v_squad_size < 15;

  -- Unbeaten: still needs 300+ pts
  DELETE FROM achievements
  WHERE user_id = p_user_id AND badge_key = 'unbeaten'
    AND v_total_pts < 300;

  -- ── Badge checks ──────────────────────────────────────────────────────────

  -- 1. Top Scorer — ranked in global top 100, must have actually played
  IF v_global_rank <= 100 AND v_total_pts > 0 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'top_scorer', 'Top Scorer',
       'Reached the global top 100', U&'\+01F3C6')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id,200);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Top Scorer 🏆',
              'You reached the global top 100!', 'reward');
    END IF;
  END IF;

  -- 2. Top Manager — ranked in global top 10, must have actually played
  IF v_global_rank <= 10 AND v_total_pts > 0 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'top_manager', 'Top Manager',
       'Reached the global top 10', U&'\2B50')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id,500);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Top Manager ⭐',
              'You cracked the global top 10!', 'reward');
    END IF;
  END IF;

  -- 3. Matchday Winner — highest weekly_points this matchday
  IF v_weekly_pts > 0 AND v_weekly_pts = v_max_weekly THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'trophy_md_winner', 'Matchday Winner',
       'Finished #1 in a single matchday', U&'\+01F947')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id,300);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Matchday Winner 🥇',
              'You topped the leaderboard this matchday!', 'reward');
    END IF;
    -- Deliberately no repeat-fire "Again!" bonus here anymore — this
    -- function now runs as a side effect of many more triggers (every
    -- prediction scored, every group poll created), not just once per
    -- matchday, so a per-call bonus would pay out repeatedly for
    -- unrelated actions any time this user happened to be the current
    -- weekly leader.
  END IF;

  -- 4. Fan Favourite — sent 50+ community messages
  IF v_msg_count >= 50 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'trophy_fan_favourite', 'Fan Favourite',
       'Sent 50+ messages in the community', U&'\2764')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id,150);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Fan Favourite ❤',
              'The community loves you — 50+ messages!', 'reward');
    END IF;
  END IF;

  -- 5. Transfer Master — squad contains 15+ different players ever
  IF v_squad_size >= 15 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'transfer_master', 'Transfer Master',
       'Built a squad of 15+ different players', U&'\+01F504')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id,200);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Transfer Master 🔄',
              'You have tried 15+ different players!', 'reward');
    END IF;
  END IF;

  -- 6. Die-Hard Fan — member for 30+ days with an active squad
  IF v_days_member >= 30 AND v_squad_size >= 1 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'die_hard', 'Die-Hard Fan',
       'Active Africa Fantasy member for 30+ days', U&'\+01F525')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id,100);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Die-Hard Fan 🔥',
              'One month strong — you are a true fan!', 'reward');
    END IF;
  END IF;

  -- 7. Unbeaten Champion — total_points >= 300 (consistent scorer across matchdays)
  IF v_total_pts >= 300 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'unbeaten', 'Unbeaten Champion',
       'Scored 300+ total fantasy points', U&'\+01F6E1')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id,250);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Unbeaten Champion 🛡',
              'You have scored 300+ fantasy points this season!', 'reward');
    END IF;
  END IF;

  -- ── Cross-sport / cross-mode badges ───────────────────────────────────────
  -- Everything above requires a fantasy squad. These don't — a
  -- predictions-only or polls-only user can earn every badge in this
  -- section without ever touching Fantasy Teams.

  -- 8. Hot Streak — 5+ correct predictions in a row, on any one sport
  IF v_best_streak >= 5 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'hot_streak', 'Hot Streak',
       'Got 5 predictions in a row right', '🔥')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id, 150);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Hot Streak 🔥',
              'Five correct predictions in a row!', 'reward');
    END IF;
  END IF;

  -- 9. Century Predictor — 100+ total prediction points, any sport combined
  IF v_pred_points >= 100 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'century_predictor', 'Century Predictor',
       'Earned 100+ prediction points', '💯')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id, 250);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Century Predictor 💯',
              'You have banked 100+ prediction points!', 'reward');
    END IF;
  END IF;

  -- 10. Sharpshooter — 10+ exact-score predictions
  IF v_exact_count >= 10 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'sharpshooter', 'Sharpshooter',
       'Called the exact score 10+ times', '🎯')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id, 300);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Sharpshooter 🎯',
              '10 exact-score predictions — incredible accuracy!', 'reward');
    END IF;
  END IF;

  -- 11. Multi-Sport Fan — scored predictions on 2+ different sports
  IF v_sports_played >= 2 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'multi_sport_fan', 'Multi-Sport Fan',
       'Predicted matches across 2+ sports', '🙌')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id, 200);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Multi-Sport Fan 🙌',
              'You''re predicting across more than one sport now!', 'reward');
    END IF;
  END IF;

  -- 12. Triple Threat — scored predictions on all 3 sports
  IF v_sports_played >= 3 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'triple_threat', 'Triple Threat',
       'Predicted football, cricket, and rugby', '🏆')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id, 400);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Triple Threat 🏆',
              'Football, cricket, and rugby — you play them all!', 'reward');
    END IF;
  END IF;

  -- 13. Group Founder — created a private group
  IF v_league_owned >= 1 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'group_founder', 'Group Founder',
       'Started a private group', '👥')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id, 100);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Group Founder 👥',
              'You started your own private group!', 'reward');
    END IF;
  END IF;

  -- 14. Poll Master — created 5+ group polls
  IF v_poll_count >= 5 THEN
    INSERT INTO achievements
      (user_id, badge_key, badge_name, badge_description, badge_icon)
    VALUES
      (p_user_id, 'poll_master', 'Poll Master',
       'Created 5+ polls for your groups', '📊')
    ON CONFLICT (user_id, badge_key) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    IF v_inserted THEN
      v_new := v_new + 1;
      PERFORM _grant_xp_unchecked(p_user_id, 150);
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (p_user_id, 'Badge Unlocked: Poll Master 📊',
              'Five polls and counting — the group loves your questions!', 'reward');
    END IF;
  END IF;

  RETURN v_new;
END;
$$;


-- ─── Trigger: check achievements when a user creates a group ────────────────
-- Group Founder is the one new badge with no natural RPC call site of its
-- own (leagues are created via a direct RLS-scoped INSERT, not an RPC), so
-- it's checked via trigger instead, same pattern as the existing
-- on_stat_upsert/on_stat_saved triggers elsewhere in this schema.

CREATE OR REPLACE FUNCTION trg_check_achievements_on_league()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM award_achievements(NEW.owner_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_league_created ON leagues;
CREATE TRIGGER on_league_created
  AFTER INSERT ON leagues
  FOR EACH ROW EXECUTE FUNCTION trg_check_achievements_on_league();


-- ─── Run for all users (called after each matchday) ──────────────────────────

CREATE OR REPLACE FUNCTION award_all_achievements()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rec     RECORD;
  v_total INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  FOR rec IN SELECT id FROM profiles LOOP
    v_total := v_total + award_achievements(rec.id);
  END LOOP;
  RETURN v_total;
END;
$$;


-- ─── Wire into the scoring engine ────────────────────────────────────────────
-- Re-create recalculate_matchday_team_points with achievement call at the end.
--
-- SECURITY DEFINER: was INVOKER, relying on the calling admin/manager's own
-- table grants for its internal UPDATEs to fantasy_teams, profiles, and
-- league_members — grants that were far broader than they should have
-- been (see the corresponding REVOKE comments in schema.sql) and have
-- since been narrowed to close a live privilege-escalation/data-tampering
-- path. auth.uid() is unaffected by SECURITY DEFINER (it always reflects
-- the real session, never the function owner), so the role check below
-- remains the actual authorization gate — this only changes which role's
-- grants satisfy the internal writes. award_all_achievements() at the end
-- still sees the real caller's auth.uid() the same way it always did.
CREATE OR REPLACE FUNCTION recalculate_matchday_team_points(
  p_matchday INTEGER,
  p_season   TEXT DEFAULT '2026'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
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

    -- Base XP for playing this matchday — lives here (not in
    -- award_achievements) specifically because this loop only runs once per
    -- admin-triggered matchday recalculation, so it can't repeat-fire the
    -- way it would if it lived inside a function now also called from
    -- ordinary user actions like voting or creating a poll.
    IF v_team_matchday_pts > 0 THEN
      PERFORM _grant_xp_unchecked(rec.user_id, 25);
    END IF;

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

  -- Award achievements and XP for this matchday
  PERFORM award_all_achievements();

END;
$$;


-- ─── Permissions ─────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION grant_xp              TO authenticated;
GRANT EXECUTE ON FUNCTION award_achievements    TO authenticated;
GRANT EXECUTE ON FUNCTION award_all_achievements TO authenticated;
GRANT EXECUTE ON FUNCTION recalculate_matchday_team_points TO authenticated;
REVOKE EXECUTE ON FUNCTION grant_xp FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION award_achievements FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION award_all_achievements FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION recalculate_matchday_team_points FROM PUBLIC, anon;
-- award_achievements stays granted to `authenticated` (award_all_achievements
-- is SECURITY INVOKER, so its nested call to award_achievements runs as the
-- real calling role, not an elevated definer — revoking here would break
-- that legitimate admin-triggered chain). Direct-call abuse is closed by
-- the own-id-or-admin guard inside the function body instead.
