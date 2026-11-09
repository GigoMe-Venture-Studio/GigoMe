#!/usr/bin/env bash
# Runs supabase/checks/security_check.sql against a fresh local database:
# the Supabase stand-in, every migration in order, then the check script.
# Fails if any row is false, except "Automatic RLS", which only exists on the
# real Supabase project. For tests only: never point it at the real project.
#
#   PGHOST=... PGPORT=... PGUSER=postgres tests/db/run-check.sh [database-name]
#
# PGUSER must be a superuser of a throwaway PostgreSQL 16 server (CI starts
# one in a container).
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="${1:-gigome_check}"
P=(psql -v ON_ERROR_STOP=1 -q -X)
"${P[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
"${P[@]}" -d "$DB" -f tests/db/supabase-stand-in.sql >/dev/null 2>&1
for m in supabase/migrations/*.sql; do
  if ! out=$("${P[@]}" -U supa -d "$DB" -f "$m" 2>&1); then
    echo "Migration failed: $m"; echo "$out"; exit 1
  fi
done
echo "Migrations applied: $(ls supabase/migrations/*.sql | wc -l)"
result=$("${P[@]}" -U supa -d "$DB" -At -F '|' -f supabase/checks/security_check.sql)
total=$(grep -c '|[tf]$' <<<"$result" || true)
failed=$(grep '|f$' <<<"$result" | grep -v '^Automatic RLS' || true)
echo "Checks: $total"
if [ -n "$failed" ]; then
  echo "FAILED:"; echo "$failed"; exit 1
fi
left=$("${P[@]}" -U supa -d "$DB" -At -c "select (select count(*) from auth.users) + (select count(*) from public.jobs) + (select count(*) from public.companies)")
if [ "$left" != "0" ]; then echo "The check left $left rows behind"; exit 1; fi
echo "All checks passed (except Automatic RLS, which only exists on Supabase); nothing left behind."
