# 0002 — Enforce roles in the database, not the UI

**Date:** 2026-11-12 · **Status:** accepted

## Context
Phase I checked roles only in React components. Anyone with the public anon key could bypass them with a script. The RLS policies, if any, were not in the repository.

## Decision
Every table has Row Level Security. Column-level rules (who may change a role, a jurisdiction, a work order title) live in `BEFORE UPDATE` guard triggers. Helper functions are `SECURITY DEFINER` with `search_path` pinned. Every rule has a test in `supabase/tests/10_security_test.sql`, run in CI against a real Postgres.

## Consequences
- UI permission helpers (`features/*/permissions.ts`) only hide buttons; they must mirror the SQL rules.
- New tables must ship with policies and tests in the same pull request.
