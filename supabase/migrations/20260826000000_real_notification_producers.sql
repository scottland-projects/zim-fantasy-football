-- =============================================
-- REAL NOTIFICATION PRODUCERS (2026-08-26)
--
-- Fixes two audit findings:
--   1. HIGH — lib/actions/admin.ts (cancelMatchLiveAction, reopenMatchAction)
--      assumed a trigger sends "MD{n} is now LIVE!" / "MD{n} points are in!"
--      notifications and even cleans them up on reversal, but no such
--      trigger existed anywhere in version control. Added below as a real
--      AFTER UPDATE trigger on matches, scoped to users who follow that
--      match's sport (profiles.interested_sports).
--   2. MEDIUM-HIGH — 5 of the 7 Settings > Notification Preferences toggles
--      had no code that ever produced that notification type, so they had
--      no effect however they were set:
--        - matchReminders  -> fixed by the trigger above (type 'match')
--        - transferDeadlines -> fixed in lib/actions/admin.ts's
--          saveFlagsAction (type 'transfer', fires when an admin flips
--          transferWindow true -> false)
--        - goalAlerts -> fixed below, a trigger on match_events that
--          notifies a scoring/carded player's fantasy owners (type 'goal')
--        - weeklyDigest -> fixed below, a new pg_cron job mirroring the
--          existing send_prediction_reminders() pattern (type 'digest',
--          a new type — 'digest' didn't exist before this migration)
--        - groupInvites -> NOT fixed here. There is no feature anywhere in
--          the app that invites a specific user to a group — groups are
--          joined via a self-service shared invite code, so there is no
--          real event to notify about. Removed from the Settings UI
--          instead of building a whole new targeted-invite feature that
--          was never asked for; the DB key is left in place (harmless,
--          unused) rather than migrating every existing user_settings row.
--
-- All producers below insert into `notifications` normally — the existing
-- trg_filter_notification_preference trigger (see schema.sql) already
-- suppresses the insert per-user based on user_settings.notifications, so
-- none of this needs to duplicate that check itself.
-- =============================================

-- 'digest' is a new notification type for the weekly digest, mapped to the
-- weeklyDigest preference below.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('match', 'transfer', 'goal', 'league', 'reward', 'system', 'prediction', 'digest'));

CREATE OR REPLACE FUNCTION filter_notification_by_preference()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_prefs JSONB;
  v_key   TEXT;
BEGIN
  v_key := CASE NEW.type
    WHEN 'reward'     THEN 'rewardUnlocks'
    WHEN 'prediction' THEN 'predictionReminders'
    WHEN 'match'      THEN 'matchReminders'
    WHEN 'transfer'   THEN 'transferDeadlines'
    WHEN 'goal'       THEN 'goalAlerts'
    WHEN 'league'     THEN 'groupInvites'
    WHEN 'digest'     THEN 'weeklyDigest'
    ELSE NULL -- 'system' and anything unmapped always sends, same as a
              -- transactional/account-critical message would
  END;

  IF v_key IS NULL THEN RETURN NEW; END IF;

  SELECT notifications INTO v_prefs FROM user_settings WHERE user_id = NEW.user_id;

  IF v_prefs IS NULL OR NOT (v_prefs ? v_key) OR (v_prefs ->> v_key)::boolean IS TRUE THEN
    RETURN NEW;
  END IF;

  RETURN NULL; -- preference explicitly off — suppress the insert
END;
$$;

-- ─── 1. Match went live / finished ──────────────────────────────────────
--
-- Fires on the exact same UPDATE every existing admin action already
-- performs (goLiveMatchAction, goLivePredictionOnlyMatchAction,
-- finishPredictionOnlyMatchAction, the football live-scoring "Finish"
-- flow) — none of those needed to change. Scoped to users who follow that
-- match's sport, matching the "match you follow" framing already used in
-- the Settings copy.
CREATE OR REPLACE FUNCTION notify_match_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'live' AND OLD.status IS DISTINCT FROM 'live' THEN
    INSERT INTO notifications (user_id, title, body, type)
    SELECT p.id,
      'MD' || NEW.matchday || ' is now LIVE!',
      NEW.home_team || ' vs ' || NEW.away_team || ' has kicked off.',
      'match'
    FROM profiles p
    WHERE NEW.sport = ANY(p.interested_sports);

  ELSIF NEW.status = 'finished' AND OLD.status IS DISTINCT FROM 'finished' THEN
    INSERT INTO notifications (user_id, title, body, type)
    SELECT p.id,
      'MD' || NEW.matchday || ' points are in!',
      NEW.home_team || ' ' || COALESCE(NEW.home_score, 0) || ' - ' || COALESCE(NEW.away_score, 0) || ' ' || NEW.away_team || ' — check your points.',
      'match'
    FROM profiles p
    WHERE NEW.sport = ANY(p.interested_sports);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_match_status_change ON matches;
CREATE TRIGGER trg_notify_match_status_change
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION notify_match_status_change();

-- ─── 2. Live Fantasy Alerts — a fantasy player's key moment ─────────────
--
-- Fires on the same match_events INSERT logMatchEventAction already does.
-- Only real moments a fantasy owner cares about: goals, assists, red
-- cards, and own goals (against a player they own). Skips yellow cards —
-- too frequent to count as a "key moment" worth an instant alert.
CREATE OR REPLACE FUNCTION notify_fantasy_goal_alert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_verb TEXT;
BEGIN
  IF NEW.player_id IS NULL THEN RETURN NEW; END IF;

  v_verb := CASE NEW.event_type
    WHEN 'goal'      THEN 'scored a goal ⚽'
    WHEN 'assist'    THEN 'set up a goal 🎯'
    WHEN 'red_card'  THEN 'was sent off 🟥'
    WHEN 'own_goal'  THEN 'scored an own goal 😬'
    ELSE NULL
  END;
  IF v_verb IS NULL THEN RETURN NEW; END IF;

  INSERT INTO notifications (user_id, title, body, type)
  SELECT DISTINCT ft.user_id,
    NEW.player_name || ' ' || v_verb,
    'Your fantasy player ' || NEW.player_name || ' just ' || v_verb || ' — check the live match.',
    'goal'
  FROM fantasy_team_players ftp
  JOIN fantasy_teams ft ON ft.id = ftp.fantasy_team_id
  WHERE ftp.player_id = NEW.player_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_fantasy_goal_alert ON match_events;
CREATE TRIGGER trg_notify_fantasy_goal_alert
  AFTER INSERT ON match_events
  FOR EACH ROW EXECUTE FUNCTION notify_fantasy_goal_alert();

-- ─── 3. Weekly digest ────────────────────────────────────────────────────
--
-- Same pg_cron pattern as send_prediction_reminders() in scoring.sql.
-- Summarises predictions scored and fantasy points earned in the last 7
-- days; skips users with nothing to report so the digest is never an
-- empty, pointless notification.
CREATE OR REPLACE FUNCTION send_weekly_digest()
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      p.id AS user_id,
      COALESCE(SUM(sp.points_earned) FILTER (WHERE sp.updated_at >= NOW() - INTERVAL '7 days'), 0) AS prediction_points,
      COALESCE(ft.weekly_points, 0) AS fantasy_points
    FROM profiles p
    LEFT JOIN score_predictions sp ON sp.user_id = p.id AND sp.points_earned IS NOT NULL
    LEFT JOIN fantasy_teams ft ON ft.user_id = p.id
    GROUP BY p.id, ft.weekly_points
  LOOP
    IF r.prediction_points = 0 AND r.fantasy_points = 0 THEN CONTINUE; END IF;

    INSERT INTO notifications (user_id, title, body, type)
    VALUES (
      r.user_id,
      'Your week in review 📊',
      'This week: ' || r.prediction_points || ' prediction points' ||
        CASE WHEN r.fantasy_points > 0 THEN ' and ' || r.fantasy_points || ' fantasy points' ELSE '' END || '.',
      'digest'
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION send_weekly_digest FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'weekly-digest',
  '0 8 * * 1', -- 08:00 every Monday
  $$SELECT send_weekly_digest();$$
);
