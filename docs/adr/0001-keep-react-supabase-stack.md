# 0001 — Build Phase II on the Phase I stack

**Date:** 2026-11-12 · **Status:** accepted

## Context
Phase I delivered a working React + Supabase portal (about 9,700 lines, well organised, type-checks and builds). Phase II must add an energy layer and harden security within one academic phase.

## Decision
Keep React 19, TanStack Router, Tailwind/shadcn and Supabase. Fix defects and add features incrementally rather than rewriting.

## Consequences
- The mobile app keeps working against the same backend.
- Security must live in Postgres (RLS + triggers), because the browser talks to the database directly. We accept that and test it (`supabase/tests`).
- Data fetching stays with simple hooks (`useScopedData`); moving to TanStack Query is a candidate improvement when caching becomes a need.
