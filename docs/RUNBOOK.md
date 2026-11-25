# Runbook

Operational procedures for KCED. Keep this file up to date when something changes.

## Accounts and ownership

| Service | Used for | Owner (must be a KNUST institutional account) |
| --- | --- | --- |
| Supabase | Database, auth, storage, functions | _fill in_ |
| Vercel | Hosting the web app | _fill in_ |
| Mapbox | Map tiles | _fill in_ |
| GitHub org `KNUST-Central-Energy-Database` | Code | _fill in_ |
| Domain / DNS | e.g. kced.knust.edu.gh | _fill in_ |

At least two staff members should have admin access to each. Students get member access for the duration of their phase.

## Environments

| | Supabase project | Web URL | Purpose |
| --- | --- | --- | --- |
| Local | Docker (`npm run db:start`) | http://localhost:5173 | Development |
| Dev | `kced-dev` | Vercel preview URLs | Team testing, pull-request previews |
| Production | live project | https://… | Real users |

Never test against production data. Never copy the production `service_role` key anywhere except Supabase/Vercel secret settings.

## Deploying

**Web app (Vercel).** Import the GitHub repo in Vercel → Framework *Vite* → set environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MAPBOX_TOKEN`, `VITE_CONTACT_EMAIL`, `VITE_SECURITY_PHONE` → every push to `main` deploys; every pull request gets a preview URL. `vercel.json` handles SPA routing and security headers.

**Database.** Migrations are applied with the Supabase CLI:

```bash
npx supabase link --project-ref <ref>
npx supabase db push --remote # applies new files (CLI v3 targets local unless --remote) in supabase/migrations
```

Run `npm run test:db` (or let CI run it) before pushing a migration to production.

**Edge Functions.**

```bash
npx supabase functions deploy invite-user
npx supabase functions deploy track-request --no-verify-jwt
npx supabase secrets set SITE_URL=https://<site> ALLOWED_ORIGINS=https://<site>
```

After deploying to production, also set Auth → URL Configuration → Site URL and Redirect URLs to the production address.

## Backups and restore

- Enable **Point-in-Time Recovery** on the production project (paid plans) or, at minimum, keep the daily backups Supabase provides.
- Weekly logical backup kept outside Supabase:

  ```bash
  npx supabase db dump --linked -f backups/kced-$(date +%F).sql          # schema
  npx supabase db dump --linked --data-only -f backups/kced-data-$(date +%F).sql
  ```

- **Restore drill once per semester:** create a scratch project, `psql` the dump into it, point a local app at it, sign in, check counts on the dashboard. Record the date and result here.

| Date | Who | Result |
| --- | --- | --- |
| | | |

## Rotating keys

If a key leaks (committed to Git, shared in chat):

1. Supabase → Project Settings → API → **Rotate** the affected key (JWT secret rotation invalidates both anon and service_role keys).
2. Update the value in Vercel and in `supabase secrets` and redeploy.
3. Remove it from Git history if it was committed (`git filter-repo`), then force-push with the team's agreement.

## Moving from the Phase I database

The Phase I backend was configured by hand in the dashboard. Before upgrading it:

1. **Capture what exists:** `npx supabase link --project-ref <phase1-ref>` then `npx supabase db pull` — this writes the live schema into a migration file. Save it as `supabase/phase1_snapshot.sql` (outside `migrations/`).
2. **Compare** it with `supabase/migrations/*0100_core_schema.sql`. Differences to look for: enum values, column types of `request_number` / `work_order_number`, the `jurisdictions` list, existing RLS policies, existing triggers (e.g. an older activity-log trigger), and the old storage bucket name "Service Request Images".
3. **Write a bridging migration** (e.g. `20261120000000_upgrade_phase1.sql`) that only *adds* what is missing: new columns (`urgency`, `latitude`/`longitude`, `retired_at`, `actor_id`, …), new tables (energy), helper functions, triggers and policies. Drop old policies by name before creating the new ones.
4. Test the bridge on a **copy** of production (restore a backup into a scratch project) together with the mobile app.
5. Schedule a short maintenance window, back up, apply, smoke-test (login as each role, submit and track a request, create a work order).

The web app still displays Phase I image URLs from the old public bucket. New uploads go to the private `service-request-images` bucket.

## Personal data (Ghana Data Protection Act, 2012 — Act 843)

Reporter names and phone numbers are personal data.

- Only staff can read them (RLS). The public tracker never returns them.
- Proposed retention: anonymise `reporter` and `reporter_contact` on requests resolved more than 24 months ago. Agree this with the KNUST data protection officer, then schedule:

  ```sql
  update public.service_requests
     set reporter = 'Removed', reporter_contact = '+233000000000'
   where status in ('resolved', 'cancelled') and updated_at < now() - interval '24 months';
  ```

- Add a short privacy notice to the public form once the wording is approved.

## Incident checklist

1. Is it everyone or one user? Check https://status.supabase.com and the Vercel dashboard.
2. Browser console errors → note the failing request (Network tab) and its response.
3. Supabase → Logs → API / Postgres / Auth for the time of the error.
4. If data was changed wrongly: `activity_log` shows who changed what, and when.
5. Write a short note in GitHub Issues with the cause and fix.
