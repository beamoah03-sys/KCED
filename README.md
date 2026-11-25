# KNUST Central Energy Database (KCED) — Web, Phase II

The staff portal and public service-request site for the KNUST Central Energy Database:

- **Public:** report an electrical fault (with photos and urgency) and track it by its request number.
- **Maintenance:** service requests → work orders → technicians, an asset register for 6 equipment types, a campus map.
- **Energy (new in Phase II):** buildings, meters and readings, ECG bills, power outages and generator use, with a 12‑month energy overview, kWh per m², and alerts for unusual consumption.

It is a React single-page app that talks directly to a **Supabase** backend (Postgres, Auth, Storage, Edge Functions). The Flutter mobile app `kced_mobile` uses the same backend.

> **New to the project? Follow [docs/SETUP-VSCODE.md](docs/SETUP-VSCODE.md)** — a step-by-step guide to running everything in VS Code on Windows, macOS or Linux.

---

## Quick start (for people who have done this before)

```bash
nvm use                      # Node 22 (see .nvmrc); Node 20.19+ also works
npm install
cp .env.example .env.local   # then fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```

The database must have the migrations in `supabase/migrations` applied — see [docs/SETUP-VSCODE.md](docs/SETUP-VSCODE.md), Part 3.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app at http://localhost:5173 with hot reload |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Everything CI runs: type-check, lint, unit tests, build |
| `npm test` / `npm run test:watch` | Unit and component tests (Vitest) |
| `npm run test:e2e` | Browser smoke tests (Playwright; run `npx playwright install chromium` once) |
| `npm run test:db` | Apply migrations to a throwaway Postgres DB and run the security tests (needs `psql` and `DATABASE_URL`) |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run db:start` / `db:stop` / `db:reset` | Local Supabase in Docker (`db:reset` re-applies migrations + seed) |
| `npm run db:types` | Generate TypeScript types from the local database |
| `npm run functions:serve` | Run the Edge Functions locally |

## Project structure

```
src/
  routes/                 Pages (file-based routing, TanStack Router)
    dashboard/            Staff pages: requests, work orders, assets, map, users,
                          energy, buildings, meters, bills, outages, profile
    _auth/                Login, forgot password, account setup (invite)
    service-request-form/ Public request form
    track-service-request/Public tracker
  features/<module>/      One folder per module: components/, hooks/, services/, schema.ts, permissions.ts
  components/             Shared UI (page.tsx table/list helpers, CSV import/export, shadcn ui/)
  hooks/                  useScopedData (role-aware loading), useJurisdictions
  lib/                    Supabase client + paging helper, auth context, env, CSV utils
supabase/
  migrations/             Database schema, security (RLS) and storage, in order
  functions/              Edge Functions: invite-user, track-request
  tests/                  Database security tests (plain Postgres)
  seed.sql                Development data (jurisdictions, sample buildings)
e2e/                      Playwright browser tests
docs/                     Setup guide, architecture, data dictionary, runbook, decisions
```

## Roles

| Role | Can do |
| --- | --- |
| Admin | Everything, in every jurisdiction; manage users, jurisdictions and tariffs |
| Manager | Everything inside their own jurisdiction; invite technicians |
| Technician | See their jurisdiction; progress work orders they lead; edit assets on those orders; record meter readings, outages and fuel |
| Public (no login) | Submit a service request; track it by number |

These rules are enforced **in the database** (Row Level Security + guard triggers in `supabase/migrations/*_security.sql`) and tested in `supabase/tests/10_security_test.sql`. The UI only hides buttons.

## Documentation

- [docs/SETUP-VSCODE.md](docs/SETUP-VSCODE.md) — run it in VS Code, step by step
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together
- [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) — every table and what its columns mean
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — deploy, back up, restore, rotate keys, migrate from Phase I
- [docs/adr/](docs/adr/) — decisions and why we made them
- [CHANGELOG.md](CHANGELOG.md) — what changed from Phase I
- [CONTRIBUTING.md](CONTRIBUTING.md) — branches, commits, pull requests

## Licence and ownership

Owned by KNUST. Service accounts (Supabase, Vercel, Mapbox, domain) must be registered to a KNUST institutional email, not a student's personal account — see [docs/RUNBOOK.md](docs/RUNBOOK.md).
"# KCED" 
