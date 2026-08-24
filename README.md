# Africa Fantasy

An independent, fan-made fantasy football platform covering clubs across Zimbabwe. Users draft a fantasy squad from
players at any participating club, earn points from real match events, and compete in public and private leagues —
free to enter, with any prizes funded by sponsors rather than user stakes.

**Africa Fantasy is not affiliated with, endorsed by, or officially connected to ZIFA, the Premier Soccer
League, or any participating football club.** All third-party names and references are used solely to identify
real-world football teams and players where legally permitted. See [`LEGAL.md`](./LEGAL.md) for the full compliance
checklist, [Terms of Service](./app/terms/page.tsx) (`/terms`), and [Privacy Policy](./app/privacy/page.tsx)
(`/privacy`).

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- Supabase (Postgres, Auth, Storage, Realtime)
- Vercel deployment

## Local setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.local.example` to `.env.local` and fill in a Supabase project's credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
3. In the Supabase SQL editor for that project, run these files **in order**:
   1. `lib/supabase/schema.sql`
   2. `lib/supabase/scoring.sql`
   3. `lib/supabase/achievements.sql`
4. Run the dev server:
   ```
   npm run dev
   ```

## Database

The three SQL files under `lib/supabase/` are the source of truth for the schema, scoring engine, and
achievements/XP system — apply them directly in the Supabase SQL editor rather than hand-editing tables. Every
scoring/XP RPC checks the caller's `profiles.role` itself (not just the app layer), since Supabase RPCs are reachable
directly via PostgREST by any authenticated session.

New database changes after initial setup should be added as timestamped files under `supabase/migrations/`.

## Design notes

- **Multi-club by design.** `players.club` and `matches.home_team`/`away_team` are free text matched against the
  `teams` table — nothing in the schema or scoring engine favours one club. Match events record which **side**
  (home/away) scored, not "us" vs "them".
- **No real branding.** The mark in `components/ui/Logo.tsx` and every club/player name in the seed data
  (`lib/supabase/schema.sql`) are original. Do not add real club crests, kits, or copyrighted media — see
  [`LEGAL.md`](./LEGAL.md).
- **Free to enter.** There is no entry-fee or pooled-stake code path anywhere in the app. Keep it that way unless
  the legal review in `LEGAL.md` has been completed for a different model.

## Deployment

CI (`.github/workflows/ci.yml`) runs lint + build on every push/PR to `main`. Deployment is via Vercel, connected to
this repository's `main` branch. Configure the same three `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
/ `SUPABASE_SERVICE_ROLE_KEY` environment variables (plus `NEXT_PUBLIC_SITE_URL` set to the production domain) in the
Vercel project settings.
