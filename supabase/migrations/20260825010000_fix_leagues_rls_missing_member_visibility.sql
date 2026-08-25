-- Fixes a real RLS gap found via a user report: "I'm logged in as admin
-- and I can't see the private group I'm in."
--
-- The `leagues` table's SELECT policy only allowed a row to be read if it
-- was public OR the caller was its owner:
--   "Public leagues viewable by everyone": (type = 'public') OR (owner_id = auth.uid())
--
-- There was no clause for "I'm a member via league_members" — so ANY
-- non-owner member of ANY private group could not see that group at all
-- on /leagues (the embedded `leagues(...)` join in refreshMyLeagues()
-- silently came back null and got filtered out client-side). This wasn't
-- admin-specific; every non-owner member of "Harare Bragging Rights"
-- (owned by tinashe_m) had the same problem.
--
-- Adds an additional permissive SELECT policy (Postgres RLS policies for
-- the same command are OR'd together) so membership alone is sufficient
-- to read a league's row, matching how league_members' own SELECT policy
-- already works via is_league_member().

CREATE POLICY "Members can view their leagues" ON leagues FOR SELECT
USING (EXISTS (
  SELECT 1 FROM league_members
  WHERE league_members.league_id = leagues.id
    AND league_members.user_id = auth.uid()
));
