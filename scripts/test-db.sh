#!/usr/bin/env bash
# Runs the database migrations and security tests on a plain PostgreSQL
# server (no Docker or Supabase CLI needed). Used by CI.
#
#   DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres ./scripts/test-db.sh
set -euo pipefail

DB_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
TEST_DB="kced_test_$$"
ADMIN_URL="$DB_URL"
# Swap the database name in the URL, keeping any ?query (e.g. ?sslmode=...).
BASE="${DB_URL%%\?*}"
QUERY="${DB_URL#"$BASE"}"
TEST_URL="${BASE%/*}/$TEST_DB$QUERY"

cd "$(dirname "$0")/.."

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -q -c "create database $TEST_DB"
trap 'psql "$ADMIN_URL" -q -c "drop database if exists $TEST_DB" >/dev/null' EXIT

run() { echo "-> $1"; psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }

run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
run supabase/seed.sql
run supabase/tests/10_security_test.sql
