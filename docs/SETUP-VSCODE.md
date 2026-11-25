# Running KCED in VS Code — step by step

This guide takes you from the zip file to the app running on your computer, signed in as an admin. It takes about 30–45 minutes the first time. It works on Windows, macOS and Linux.

There are two ways to provide the database:

- **Option A — a Supabase project in the cloud (recommended).** No Docker needed. Free tier is enough for development.
- **Option B — Supabase running on your own computer in Docker.** Fully offline, but needs Docker Desktop and about 4 GB of free RAM.

> **Do not point this at the live Phase I database yet.** These migrations build a fresh database. Use a new Supabase project for Phase II development, and follow [RUNBOOK.md → Moving from Phase I](RUNBOOK.md#moving-from-the-phase-i-database) when you are ready to upgrade the live one.

---

## Part 1 — Install the tools (once per computer)

1. **Node.js 22 LTS** — <https://nodejs.org> → download the LTS installer and run it with the default options.
   Check it in a new terminal: `node -v` should print `v22.x` (v20.19 or newer also works).
2. **Git** — <https://git-scm.com/downloads>. On Windows keep the default options; they include *Git Bash*.
3. **VS Code** — <https://code.visualstudio.com>.
4. **Google Chrome** (or Edge) for running and debugging the app.
5. *Option B only:* **Docker Desktop** — <https://www.docker.com/products/docker-desktop>. Start it once and wait until it says "Engine running".

## Part 2 — Open the project in VS Code

1. Unzip `kced-web-phase2.zip` somewhere simple, e.g. `Documents/kced-web`. Avoid folders synced by OneDrive or Google Drive (they slow `npm install` down and can lock files).
2. Open VS Code → **File → Open Folder…** → choose the `kced-web` folder (the one that contains `package.json`) → click **Yes, I trust the authors**.
3. VS Code shows *"This workspace has extension recommendations"* → click **Install**. (Or open the Extensions panel, type `@recommended`, and install them.) The important ones are ESLint, Prettier, Tailwind CSS IntelliSense, Vitest and Playwright.
4. Open the terminal: **View → Terminal** (or <kbd>Ctrl</kbd>+<kbd>`</kbd>).
   On Windows, if `npm` commands fail with "running scripts is disabled", click the **⌄** next to the **+** in the terminal and choose **Git Bash** or **Command Prompt**.
5. Install the dependencies:

   ```bash
   npm install
   ```

   This takes 1–3 minutes and creates the `node_modules` folder. Warnings are fine; errors are not (see Troubleshooting).
6. Optional: put the project under Git so you can track changes:

   ```bash
   git init
   git add .
   git commit -m "Phase II baseline"
   ```

   To push it to the team repository, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## Part 3 — Set up the database

### Option A: Supabase in the cloud

**3A.1 Create the project**

1. Go to <https://supabase.com> → sign in (use your KNUST email; see RUNBOOK on account ownership) → **New project**.
2. Name: `kced-dev`. Database password: click **Generate** and **save it in a password manager**. Region: the closest available to Ghana (e.g. *West EU (London)*).
3. Wait about 2 minutes until the project is ready.

**3A.2 Create the tables, security rules and storage**

In the VS Code terminal:

```bash
npx supabase login                       # opens the browser; approve
npx supabase link --project-ref YOUR_REF # YOUR_REF is in the project URL: supabase.com/dashboard/project/YOUR_REF
npx supabase db push --remote            # applies everything in supabase/migrations, in order
```

It asks for the database password from step 3A.1. You should see four migrations applied.

Then load the starter data: Supabase dashboard → **SQL Editor** → **New query** → paste the whole of `supabase/seed.sql` → **Run**. (Edit the jurisdiction list in that file first if you already know the real one.)

> **No CLI?** You can instead paste each file from `supabase/migrations/` into the SQL Editor and run them **one at a time, in filename order** (0100, 0200, 0300, 0400), then `seed.sql`.

**3A.3 Configure sign-in**

In the Supabase dashboard:

1. **Authentication → Sign In / Providers → Email**: turn **off** *Allow new users to sign up* (staff are invite-only), and turn **off** *Secure email change* (the app sends one code to the new address).
2. **Authentication → URL Configuration**:
   - *Site URL*: `http://localhost:5173`
   - *Redirect URLs*: add `http://localhost:5173/account-setup` and `http://localhost:5173/**`
3. **Authentication → Emails → Templates**: the app asks users to type a **6‑digit code** for password reset and email change. In the *Reset Password* and *Change Email Address* templates, make sure the body includes `{{ .Token }}` (for example: `Your code is {{ .Token }}`).
4. **Authentication → Policies → Password**: set the minimum length to **8**.

**3A.4 Deploy the Edge Functions**

```bash
npx supabase functions deploy invite-user
npx supabase functions deploy track-request --no-verify-jwt
npx supabase secrets set SITE_URL=http://localhost:5173 ALLOWED_ORIGINS=http://localhost:5173
```

(When the site goes live, set both values to the real address, e.g. `https://kced.knust.edu.gh`.)

**3A.5 Schedule the overdue check**

Dashboard → **Database → Extensions** → enable **pg_cron**. Then in the SQL Editor run:

```sql
select cron.schedule('mark-overdue-work-orders', '*/15 * * * *', 'select public.mark_overdue_work_orders();');
```

(If `db push` already managed to enable pg_cron, this reports that the job exists — that is fine.)

**3A.6 Connect the app**

1. Dashboard → **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
2. In VS Code, copy `.env.example` to a new file `.env.local` (right-click → Copy, then Paste and rename; or `cp .env.example .env.local`).
3. Fill it in:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...   # the anon public key
   VITE_MAPBOX_TOKEN=                      # optional, for the Map page (free at mapbox.com)
   ```

   Never put the **service_role** key in this file. `.env.local` is ignored by Git.

**3A.7 Create the first admin**

1. Dashboard → **Authentication → Users → Add user → Create new user**. Enter your email and a password (8+ characters) and tick **Auto Confirm User**.
2. **SQL Editor** → open `scripts/create-admin.sql` from VS Code, change the email on the `where` line to yours, paste it, and **Run**. The result should show your email with role `admin`.

Now go to Part 4.

### Option B: Supabase on your own computer (Docker)

1. Make sure Docker Desktop is running.
2. In the VS Code terminal:

   ```bash
   npm run db:start
   ```

   The first run downloads the Supabase images (a few GB, 5–15 minutes). When it finishes it prints a table that includes **API URL** (`http://127.0.0.1:54321`) and **anon key**. Migrations and `seed.sql` are applied automatically.
3. Copy `.env.example` to `.env.local` and set:

   ```dotenv
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=the anon key printed by db:start
   ```

4. Serve the Edge Functions (needed for inviting users and the public tracker). In a **second** terminal (click **+** in the terminal panel):

   ```bash
   cp supabase/functions/.env.example supabase/functions/.env
   npm run functions:serve
   ```

5. Create the first admin: open **Supabase Studio** at <http://127.0.0.1:54323> → **Authentication → Add user → Create new user** (email + password, auto-confirm) → **SQL Editor** → run `scripts/create-admin.sql` with your email.
6. All emails (invites, reset codes) are caught locally at <http://127.0.0.1:54324> — nothing is really sent.

Useful commands: `npm run db:stop` (stop the containers), `npm run db:reset` (wipe the local database and re-apply migrations + seed).

## Part 4 — Run the app

```bash
npm run dev
```

Open <http://localhost:5173>. You should see the public landing page.

1. Click **Staff Login**, sign in with the admin account from Part 3.
2. The first time, you are sent to **Account setup** if your profile has no phone number — enter your name and a 10‑digit phone number.
3. You land on the **Dashboard**. Try, in order:
   - **Energy → Buildings → Add building** (seeded examples are there already).
   - **Meters → Add meter**, then click the meter and **Save reading** twice with different dates and values.
   - **Energy → Overview** shows the consumption once a meter has two readings.
   - Open the public **Submit a request** page in a private window, submit a request, note the `SR-…` number, and track it.
   - **Users → Invite** a colleague as a manager or technician (Option B: read the invite at <http://127.0.0.1:54324>).

Stop the dev server with <kbd>Ctrl</kbd>+<kbd>C</kbd> in the terminal.

## Part 5 — Working in VS Code day to day

- **Run and debug:** press <kbd>F5</kbd> and pick **Debug app in Chrome**. It starts the dev server and opens Chrome; breakpoints in `.tsx` files work.
- **Tasks:** <kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → *Tasks: Run Task* → *dev server*, *check everything*, *unit tests (watch)*, *start local Supabase*.
- **Tests:** the flask icon in the left bar lists all Vitest tests; click ▶ next to any test. `npm run test:e2e` runs the browser tests (first run `npx playwright install chromium`).
- **Formatting and lint:** files are formatted when you save; ESLint problems show inline (and in the *Problems* panel).
- **Before every pull request:** `npm run check` must pass — CI runs the same thing.
- **Changing the database:** never edit an applied migration. Create a new one:

  ```bash
  npx supabase migration new add_fuel_log_page
  ```

  write the SQL in the new file under `supabase/migrations/`, apply it (`npm run db:reset` locally, or `npx supabase db push --remote` for the cloud project), and add a check to `supabase/tests/10_security_test.sql` if it touches permissions.
- **Adding a page:** create a file in `src/routes/dashboard/`, e.g. `fuel.tsx` exporting `Route = createFileRoute("/dashboard/fuel")(...)`. The route list (`src/routeTree.gen.ts`) regenerates automatically while `npm run dev` is running. Add it to `NAV_SECTIONS` in `src/features/dashboard/components/AppSidebar.tsx`.

## Part 6 — Troubleshooting

| Symptom | Fix |
| --- | --- |
| Page says **"Almost there: configure the app"** | `.env.local` is missing or misnamed. It must sit next to `package.json`. Restart `npm run dev` after editing it. |
| `npm install` fails with `EACCES`/permission errors | Don't use `sudo`. On macOS/Linux install Node with nvm; on Windows run VS Code normally (not as admin) and keep the project outside OneDrive. |
| `npm` "running scripts is disabled on this system" (Windows) | Use the Git Bash or Command Prompt terminal, or run once in PowerShell: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| `Port 5173 is already in use` | Another dev server is running. Close the other terminal, or find it with `npx kill-port 5173`. |
| Login works but you are sent straight back to login / see no data | Your user has no profile row or is not active. Re-run `scripts/create-admin.sql` with the exact email. |
| "Your account has been suspended" | An admin set your status to suspended in **Users**. Ask an admin, or fix it in the SQL Editor. |
| Invite fails with "Only admins and managers can invite users" | The `invite-user` function can't see your profile — check you are signed in as an active admin/manager. |
| Invite email link says **invalid or expired** | Add `http://localhost:5173/account-setup` to *Redirect URLs* (Part 3A.3) and make sure `SITE_URL` is set for the functions. |
| Public tracker always says "Could not look up the request" | Deploy `track-request` with `--no-verify-jwt` (Part 3A.4), or run `npm run functions:serve` for local. |
| `supabase db push` fails with "permission denied for schema storage" or on `pg_cron` | Run the failing file in the SQL Editor instead; for pg_cron, enable it under Database → Extensions first. |
| Map page says "Mapbox token not configured" | Add `VITE_MAPBOX_TOKEN` to `.env.local` and restart the dev server. |
| `db:start` hangs or fails | Docker Desktop isn't running, or has too little memory (Settings → Resources → 4 GB+). |
| A save shows a red message from the database (e.g. "Managers can only manage users in their own jurisdiction") | That is the security rule working as designed — the action isn't allowed for your role. |
