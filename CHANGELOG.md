# Changelog

## 2.0.0 — Phase II baseline (November 2026)

Rebuilt from the Phase I repository (`KNUST-Central-Energy-Database/KCED-Web`, last commit 8 Nov 2026).

### Backend (new: previously not in the repo)
- Full database schema as migrations, compatible with the Phase I web and mobile apps.
- Row Level Security on every table, guard triggers for column-level rules, and a security test suite run in CI.
- Edge Functions `invite-user` (server-side role checks) and `track-request` (returns no personal data).
- Private storage buckets with size and file-type limits; photos viewed through signed URLs.
- Request numbers `SR-YYYY-NNNNN`, work order numbers `WO-YYYY-NNNNN`.
- Rate limit: 5 public requests per phone number per hour.
- Request status now follows its work order automatically (assigned → in progress → resolved).
- "Overdue" is set automatically from the deadline (trigger + pg_cron every 15 minutes).
- Activity log records who made each change.

### Fixed
- Role and jurisdiction were not loaded after an in-app login (admin buttons hidden, lists unscoped until refresh).
- Lists silently stopped at 1,000 rows; all lists now page through every row.
- `.env.example` named a different variable than the code read.
- The request trend chart dropped requests made on the last day of each month.
- Technicians could see Create/Delete work order and Edit user buttons.
- Maintenance Yard was hard-coded as jurisdiction 48; now a flag on the jurisdiction.
- Password reset accepted 6 characters while setup required 8; both are 8.
- Reporters never saw their request number; the success screen now shows it with a Track button.
- Side panels (asset detail/edit) were stuck at a narrow width.
- Placeholder email and a sentence repeated three times on the public page.
- Suspended users could still sign in.

### Added
- Energy module: buildings, meters, readings (with CSV import), bills, outages, 12-month overview with kWh/m² and unusual-use alerts.
- Urgency on service requests.
- CSV export on every list; CSV import for assets.
- Retire/reinstate assets; asset coordinates as numbers.
- Mobile navigation menu; error and missing-configuration screens.
- ESLint, Prettier, Vitest (unit/component), Playwright (browser), GitHub Actions CI, VS Code settings, debug configs and tasks.
- Documentation: setup guide, architecture, data dictionary, runbook, decision records.

### Removed
- three.js login background (cut the login page JavaScript from 1.1 MB to 2 kB) and unused packages.
