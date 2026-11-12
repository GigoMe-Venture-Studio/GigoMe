#!/usr/bin/env bash
# Runs supabase/checks/security_check.sql against a fresh local database:
# the Supabase stand-in, every migration in order, then the check script.
# Fails if any row is false, except "Automatic RLS", which only exists on the
# real Supabase project. For tests only: never point it at the real project.
#
# Then the example listings: supabase/seed/examples.sql, the security check
# again with them loaded (as on the live project while testers use them),
# what testers do with them (examples-activity.sql),
# supabase/seed/remove_examples.sql, and examples-removed.sql, which checks
# that only the example side went.
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

# Runs a file as "supa" (Supabase's postgres) and fails on any false row
# (check_name|...|f), except Automatic RLS.
checks() { # <label> <file>
  local result total failed
  if ! result=$("${P[@]}" -U supa -d "$DB" -At -F '|' -f "$2" 2>&1); then
    echo "$1: the script failed:"; echo "$result"; exit 1
  fi
  total=$(grep -c '|[tf]$' <<<"$result" || true)
  failed=$(grep '|f$' <<<"$result" | grep -v '^Automatic RLS' || true)
  echo "$1: $total checks"
  if [ -n "$failed" ]; then echo "FAILED:"; echo "$failed"; exit 1; fi
}
left_behind() { # <when>
  local left
  left=$("${P[@]}" -U supa -d "$DB" -At -c "select (select count(*) from auth.users) + (select count(*) from public.jobs) + (select count(*) from public.companies)")
  if [ "$left" != "0" ]; then echo "$1 left $left rows behind"; exit 1; fi
}

checks "Security check" supabase/checks/security_check.sql
left_behind "The check"

# Example listings ------------------------------------------------------------
if ! out=$("${P[@]}" -U supa -d "$DB" -At -F '|' -f supabase/seed/examples.sql 2>&1); then
  echo "examples.sql failed:"; echo "$out"; exit 1
fi
for want in '1|Example companies|6' '2|Live example jobs|20' '3|Job types|gig, internship, other, part_time' \
             '4|Categories|8 of 8: ' '5|Areas|16 of 16' '6|Remote / on site|3 remote, 17 on site' '7|Italian|basic, fluent, none' \
             '9|Schedules|flexible, weekday_afternoons, weekday_evenings, weekday_mornings, weekends' \
             '10|Languages|ar, de, en, es, fr, it, other, zh' '11|Pay|hour, month, none, project, unpaid_curricular' \
             '12|Metro badge (exact pin within 1 km)|14 jobs; 1 pinned without one' '14|New (published in the last 3 days)|5' \
             '15|Expiring within 3 days|1' '16|Longest title|117 characters'; do
  if ! grep -qF "$want" <<<"$out"; then echo "examples.sql: expected a row starting \"$want\", got:"; echo "$out"; exit 1; fi
done
echo "examples.sql: loaded, every filter covered"
if out=$("${P[@]}" -U supa -d "$DB" -f supabase/seed/examples.sql 2>&1); then
  echo "examples.sql ran twice: it should refuse while examples are loaded"; exit 1
fi
grep -q 'already loaded' <<<"$out" || { echo "examples.sql refused for another reason:"; echo "$out"; exit 1; }
n=$("${P[@]}" -U supa -d "$DB" -At -c "select count(*) from public.jobs where is_example")
[ "$n" = "20" ] || { echo "examples.sql run twice changed the example jobs: $n"; exit 1; }
echo "examples.sql: refuses to run twice"

checks "Security check with the examples loaded" supabase/checks/security_check.sql

if ! out=$("${P[@]}" -U supa -d "$DB" -f tests/db/examples-activity.sql 2>&1); then
  echo "examples-activity.sql failed:"; echo "$out"; exit 1
fi
for run in 1 2; do  # the second run finds nothing to remove
  if ! out=$("${P[@]}" -U supa -d "$DB" -At -F '|' -f supabase/seed/remove_examples.sql 2>&1); then
    echo "remove_examples.sql failed:"; echo "$out"; exit 1
  fi
  if grep -E '\|[1-9][0-9]*$' <<<"$out"; then echo "remove_examples.sql (run $run) left these behind"; exit 1; fi
done
echo "remove_examples.sql: everything removed, and running it again does nothing"
checks "After removing the examples" tests/db/examples-removed.sql
left_behind "The example listings test"
echo "All checks passed (except Automatic RLS, which only exists on Supabase); nothing left behind."
