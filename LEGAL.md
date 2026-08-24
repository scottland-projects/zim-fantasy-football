# Legal Compliance Notes — Africa Fantasy

This file tracks the legal-compliance posture of the platform and what still needs a qualified Zimbabwean lawyer's
sign-off before wider launch. It is not legal advice.

## What the platform already does to reduce legal risk

- **No entry fees, no pooled stakes.** There is no code path anywhere in the app that charges a user to enter a
  league or fantasy competition (`lib/supabase/schema.sql` has no payment/entry-fee table). This is a deliberate
  design choice to keep the platform outside the definition of gambling/betting under Zimbabwean law.
- **Sponsor-funded prizes only.** Where prizes exist (`leagues.prizes` in the schema, set via the admin panel), they
  are described as sponsor-provided, never as a payout of collected stakes.
- **No official branding.** The mark in `components/ui/Logo.tsx`, the six clubs and ~80 players seeded in
  `lib/supabase/schema.sql`, and all in-app copy are original — no real club crests, kits, sponsor logos, or
  copyrighted broadcast media are used anywhere in the codebase.
- **Explicit non-affiliation disclosure.** The disclaimer appears on the landing page footer, at the top of
  `/terms`, and is reinforced in `/privacy` — not buried in a single footnote.
- **Real names used narrowly, if at all.** The seed data uses invented club and player names. If real ZIFA/PSL club
  or player names are introduced later (e.g. for real fixture results or news content), that use should stay
  strictly nominative — identifying a real match result or fixture, never implying sponsorship, endorsement, or
  affiliation — and Section 6 of `/terms` documents the takedown contact for any rights holder who disagrees.

## Before launch — lawyer review needed

Get sign-off from a Zimbabwean lawyer with IP / media / gaming-law experience before:

1. **Any extensive use of real player or club names** beyond narrow, nominative fixture/result references (e.g. a
   "player news" feed, real headshots, or club-branded promotional content).
2. **Introducing cash prizes**, even sponsor-funded ones, especially anything paid directly to a specific
   individual rather than fulfilled as merchandise/vouchers by the sponsor.
3. **Any mechanic that could resemble betting or wagering** — e.g. head-to-head stake matching, paid entry tiers, or
   anything where a user's money is at risk based on an uncertain outcome. The current design avoids this
   entirely; do not add it without review.
4. **Collecting data on minors** — the Terms set a 16+ minimum, but if that changes, Zimbabwe's Cyber and Data
   Protection Act (CDPA) requirements around minors' data need separate review.
5. **Using ZIFA/PSL trademarks, logos, or licensed footage** in any marketing material, even outside the app itself
   (social media, print, sponsorship decks).

## Regulatory contacts referenced in the Terms/Privacy Policy

- **Data protection:** Postal and Telecommunications Regulatory Authority of Zimbabwe (POTRAZ), per the CDPA
  reference in `/privacy` Section 9.
- **Rights-holder takedown requests:** `legal@omniglobal.one`, per `/terms` Section 6.

## Operational checklist before going live

- [ ] Lawyer review of items 1–5 above completed and documented.
- [ ] Business registration / operating entity confirmed (Terms and Privacy currently name OMNI Global as operator).
- [ ] `/terms` and `/privacy` linked from every page that collects data or offers prizes (currently: register flow,
      landing page footer).
- [ ] Sponsor agreements for any advertised prizes are in writing before they are advertised in-app.
- [ ] A real `public/og-image.png` (see `app/layout.tsx` TODO) and a proper crest, if one is commissioned, replace
      the placeholder mark — confirm any commissioned crest is cleared for trademark conflicts before use.
