-- Adds a country dimension to global fan polls so the UI can filter them,
-- same pattern as teams/matches. NULL means "not country-specific" — the
-- one opinion poll ("which sport are you most excited to follow") and any
-- future user-created group polls (via create_group_poll(), unchanged)
-- stay NULL rather than being mislabeled with a country they don't have.

ALTER TABLE polls ADD COLUMN IF NOT EXISTS country TEXT;

UPDATE polls SET country = 'Zimbabwe' WHERE question IN (
  'Scottland FC head into the new Castle Lager PSL season as defending champions. Will they retain the title?',
  'Which Castle Lager PSL club are you backing this season?',
  'Southern Rocks are the reigning Logan Cup champions after their 2025-26 title. Which franchise wins it this year?',
  'Which club lifts this year''s National Rugby League title?'
);

UPDATE polls SET country = 'South Africa' WHERE question IN (
  'Which Betway Premiership club are you backing this season?',
  'Which franchise wins the CSA 4-Day Series (Division One) this season?',
  'Which union lifts the Currie Cup this season?'
);

UPDATE polls SET country = 'Botswana' WHERE question IN (
  'Which FNB Botswana Premier League club are you backing this season?',
  'Gaborone Rugby Football Club (the Hogs) enter the season as Botswana Super Rugby League''s defending champions. Can they retain the title?'
);
