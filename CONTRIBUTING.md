# Contributing

## Workflow

1. Create an issue for the change (or pick one from the board).
2. Branch from `main`: `git switch -c feat/fuel-log-page` (prefixes: `feat/`, `fix/`, `docs/`, `chore/`).
3. Commit in small steps with clear messages, e.g. `feat(energy): add fuel log form`, `fix(auth): reload profile after login`.
4. Run `npm run check` (and `npm run test:db` if you changed SQL).
5. Open a pull request; fill in the template; at least **one reviewer** approves; CI is green; then *Squash and merge*.

`main` should be protected: no direct pushes, CI required, one approval required (GitHub → Settings → Branches).

## Putting this codebase into the team repository

```bash
git init
git add .
git commit -m "Phase II baseline"
git branch -M main
git remote add origin https://github.com/KNUST-Central-Energy-Database/KCED-Web.git
git switch -c phase-2
git push -u origin phase-2
```

Then open a pull request from `phase-2` into `main` so the team reviews the baseline before it replaces Phase I.

## Conventions

- TypeScript strict; no `any` without a comment explaining why.
- Database access only in `features/*/services/*.service.ts`.
- New tables: migration + RLS policies + a test in `supabase/tests/10_security_test.sql`, in the same pull request.
- Never edit an applied migration; add a new one (`npx supabase migration new <name>`).
- UI text: short, plain English; say what happened and what to do next.
- Don't commit `.env*` files (except `.env.example`) or real data exports.
