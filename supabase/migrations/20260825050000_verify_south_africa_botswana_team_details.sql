-- =============================================
-- SOUTH AFRICA & BOTSWANA — SOCIAL-MEDIA VERIFICATION PASS (2026-08-25)
--
-- Follow-up to 20260825040000_add_south_africa_botswana_teams.sql. Many
-- teams there were seeded with NULL colour/nickname because the first
-- research pass couldn't confirm them. A second pass specifically checked
-- official club/union social media (Facebook, X/Twitter, Instagram) and
-- official sites, in addition to Wikipedia infoboxes and sports press,
-- and filled in what could genuinely be corroborated.
--
-- Deliberately still left NULL (do not seed a guess for these — either
-- unresolved/conflicting sources, or nothing found at all):
--   * North West / North-West Dragons (cricket) — no colour in any source.
--   * Boland (cricket) — a #BackToBlackAndGold hashtag surfaced but tied to
--     an oddly-labelled account; flagged for manual spot-check, not seeded.
--   * Border Bulldogs (rugby) — sources actively conflict (chocolate
--     brown/red/green vs maroon/white).
--   * Valke (rugby) — no colour found anywhere.
--   * TAFIC FC, Matebele FC, Enesia FC, Tonota FC, Prisons XI Gaborone
--     (Botswana football) — no kit-colour data found; Prisons XI had one
--     uncorroborated "blue and white" claim that conflicts with the
--     official Wikipedia infobox having the field empty, so left NULL.
--   * All Botswana rugby clubs except BIUST Buffalos — either the club's
--     own social presence exists but wasn't fetchable, or (Botho
--     University Ryders, University of Botswana Rhinos) only the parent
--     institution's colours are documented, not the rugby kit itself —
--     explicitly not the same thing, so not seeded as the team's colour.
-- =============================================

-- South Africa — football
UPDATE teams SET primary_color = '#046A38', nickname = 'Usuthu' WHERE name = 'AmaZulu FC' AND sport = 'football' AND country = 'South Africa';
UPDATE teams SET primary_color = '#D4AF37' WHERE name = 'Lamontville Golden Arrows FC' AND sport = 'football' AND country = 'South Africa';
UPDATE teams SET primary_color = '#0057B8', nickname = 'Citizens' WHERE name = 'Durban City FC' AND sport = 'football' AND country = 'South Africa';
UPDATE teams SET primary_color = '#32CD32', nickname = 'Bahlabane Ba Ntwa' WHERE name = 'Marumo Gallants FC' AND sport = 'football' AND country = 'South Africa';
UPDATE teams SET primary_color = '#F26522', nickname = 'Rise and Shine' WHERE name = 'Polokwane City FC' AND sport = 'football' AND country = 'South Africa';
UPDATE teams SET primary_color = '#001F5B', nickname = 'Natal Rich Boys' WHERE name = 'Richards Bay FC' AND sport = 'football' AND country = 'South Africa';
UPDATE teams SET primary_color = '#1E7A34' WHERE name = 'Siwelele FC' AND sport = 'football' AND country = 'South Africa';
UPDATE teams SET primary_color = '#800000', nickname = 'Stellies' WHERE name = 'Stellenbosch FC' AND sport = 'football' AND country = 'South Africa';
UPDATE teams SET primary_color = '#D32F2F', nickname = 'Stallions' WHERE name = 'Milford FC' AND sport = 'football' AND country = 'South Africa';
UPDATE teams SET primary_color = '#006CBF', nickname = 'The Village Boys' WHERE name = 'Kruger United FC' AND sport = 'football' AND country = 'South Africa';

-- South Africa — cricket
UPDATE teams SET primary_color = '#1B263B' WHERE name = 'KwaZulu-Natal Inland' AND sport = 'cricket' AND country = 'South Africa';

-- South Africa — rugby
UPDATE teams SET primary_color = '#6A0DAD' WHERE name = 'Griffons' AND sport = 'rugby' AND country = 'South Africa';
UPDATE teams SET primary_color = '#B22222' WHERE name = 'Eastern Province' AND sport = 'rugby' AND country = 'South Africa';
UPDATE teams SET primary_color = '#003DA5' WHERE name = 'SWD Eagles' AND sport = 'rugby' AND country = 'South Africa';
UPDATE teams SET primary_color = '#2E7D32' WHERE name = 'Leopards' AND sport = 'rugby' AND country = 'South Africa';

-- Botswana — football
UPDATE teams SET primary_color = '#EE0000' WHERE name = 'Gaborone United SC' AND sport = 'football' AND country = 'Botswana';
UPDATE teams SET primary_color = '#3CB043' WHERE name = 'Nico United' AND sport = 'football' AND country = 'Botswana';
UPDATE teams SET primary_color = '#FF0022' WHERE name = 'Botswana Police XI SC' AND sport = 'football' AND country = 'Botswana';
UPDATE teams SET primary_color = '#2E7D32' WHERE name = 'BDF XI' AND sport = 'football' AND country = 'Botswana';
UPDATE teams SET nickname = 'Mapantsula' WHERE name = 'Extension Gunners FC' AND sport = 'football' AND country = 'Botswana';
UPDATE teams SET primary_color = '#EE0000' WHERE name = 'Jwaneng Galaxy FC' AND sport = 'football' AND country = 'Botswana';
UPDATE teams SET nickname = 'Kuka Ntsu' WHERE name = 'Matebele FC' AND sport = 'football' AND country = 'Botswana';
UPDATE teams SET nickname = 'Sepondo se a Debola' WHERE name = 'Tonota FC' AND sport = 'football' AND country = 'Botswana';

-- Botswana — rugby
UPDATE teams SET primary_color = '#F26522' WHERE name = 'BIUST Buffalos' AND sport = 'rugby' AND country = 'Botswana';
