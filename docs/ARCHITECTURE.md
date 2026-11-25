# Architecture

KCED is a browser app with no server of its own. The browser (and the mobile app) talk straight to Supabase; **Postgres Row Level Security is the security boundary.**

```
 Public visitors ──(anon key)──┐
 kced_mobile (Flutter) ────────┼──► Supabase
 KCED-Web staff portal ────────┘     ├─ Auth            invite-only staff accounts, OTP reset/email change
   React SPA on Vercel               ├─ Postgres + RLS  tables, views, triggers, policies (supabase/migrations)
        │                            ├─ Storage         private buckets, signed URLs
        └──► Mapbox (map tiles)      └─ Edge Functions  invite-user, track-request (supabase/functions)
```

## Frontend

| Concern | Choice | Where |
| --- | --- | --- |
| UI | React 19, TypeScript (strict), Tailwind CSS 4, shadcn/ui (Radix) | `src/components/ui` |
| Routing | TanStack Router, file-based, code-split per page; `beforeLoad` guards | `src/routes`, `src/features/auth/guards.ts` |
| Forms | react-hook-form + Zod (one schema validates and types each form) | `features/*/schema.ts` |
| Data | `@supabase/supabase-js` in `features/*/services/*.service.ts`; `fetchAllRows` pages past the 1,000-row limit | `src/lib/supabase.ts` |
| Loading | `useScopedData` waits for the profile, scopes by role/jurisdiction, ignores stale responses | `src/hooks/use-scoped-data.ts` |
| Session | `AuthProvider` reloads the profile whenever the signed-in user changes | `src/lib/auth-context.tsx` |
| Charts / map | Recharts; Mapbox GL (loaded only on the map page) | |

**Module layout.** Each feature folder holds `components/`, `hooks/`, `services/`, `schema.ts` (types, enums, Zod), and `permissions.ts` (UI-side role rules). Services map snake_case rows to camelCase objects in one place.

**Permissions in the UI** only decide which buttons to show. The same rules are enforced by the database, so a crafted request from the browser console is rejected.

## Backend (supabase/)

| File | Contents |
| --- | --- |
| `migrations/…0100_core_schema.sql` | Enums, jurisdictions, users, assets, service requests, work orders, activity log; numbering (SR-/WO-), rate limit, overdue logic, request-status sync, auth triggers |
| `migrations/…0200_energy_schema.sql` | Buildings, meters, readings, tariffs, bills, outages, fuel logs; consumption and cost views |
| `migrations/…0300_security.sql` | Role helper functions, guard triggers, RLS on every table, grants, `submit_service_request` RPC |
| `migrations/…0400_storage.sql` | Buckets with size/type limits and their policies |
| `functions/invite-user` | Server-side role check, sends the Supabase invite, sets role + jurisdiction |
| `functions/track-request` | Public lookup by request number; returns status and dates only |
| `tests/10_security_test.sql` | Acts as each role and asserts what it can and cannot do |

### Key flows

**Public request.** Form → photos uploaded to the private `service-request-images` bucket under `requests/<month>/` → `submit_service_request()` RPC inserts the row (rate limit 5/hour per phone, status forced to `submitted`) and returns `SR-2026-00042` → reporter tracks it via `track-request`.

**Request → work order.** A manager creates a work order from the request → trigger sets the request to `assigned`; the lead technician moves it to `in progress` (request follows) and `completed` (request becomes `resolved`, `completed_at` set). Deleting the work order returns the request to `submitted`.

**Overdue.** A pending order past its deadline becomes `overdue` on save and every 15 minutes via pg_cron (`mark_overdue_work_orders()`); extending the deadline returns it to `pending`.

**Invite.** Admin/manager → `invite-user` → Supabase sends an email → the user opens `/account-setup`, sets name, phone and password → status becomes `active`.

**Energy.** Readings are cumulative register values. `meter_consumption` (view) subtracts consecutive readings × the meter multiplier; `building_monthly_energy` sums by building and month. Bills feed `building_monthly_cost`. The overview page charts both and flags buildings whose latest month is 30%+ above their average.

## Security model

- Every table has RLS. Helper functions (`current_user_role()`, `can_manage(jurisdiction)`, …) are `SECURITY DEFINER` with a fixed `search_path`.
- Column-level rules live in guard triggers: users cannot change their own role or jurisdiction; managers cannot create admins or reach outside their jurisdiction; technicians can only progress orders they lead and cannot re-code or move assets.
- Suspended users lose all access immediately (the helpers only recognise `active` users).
- Staff sign-up is disabled; accounts are created by invitation only.
- Images and documents are in private buckets; staff view them through 1-hour signed URLs.

## What is deliberately not here yet

See the Phase II roadmap in the review document. Notable: generator fuel-log screens (the table exists), notifications (SMS/email), scheduled preventive maintenance, smart-meter ingestion API, offline mobile capture. Server-side pagination of very large tables (`fetchAllRows` loads up to 50,000 rows per list, which is fine for campus scale).
