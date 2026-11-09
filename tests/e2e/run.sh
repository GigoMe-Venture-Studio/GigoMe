#!/usr/bin/env bash
# Runs every browser test suite against fresh builds of the site, served with
# the real security headers (public/_headers). No real Supabase, map tiles,
# Turnstile or Nominatim: every suite mocks them. No secrets needed.
#
#   tests/e2e/run.sh            all suites
#   tests/e2e/run.sh jobs map   only these (file names without .test.js)
#
# Needs Playwright's Chromium (CI installs it; see .github/workflows/tests.yml).
set -uo pipefail
cd "$(dirname "$0")/../.."
B=tests/e2e/.builds
rm -rf "$B" && mkdir -p "$B"

build() { # <folder> [VAR=value ...]
  local out=$1; shift
  if ! env "$@" npx vite build --outDir "$B/$out" >"$B/$out.log" 2>&1; then
    echo "Build $out failed:"; cat "$B/$out.log"; exit 1
  fi
}
TEST_ENV=(VITE_SUPABASE_URL=https://testproj.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_test)
build env "${TEST_ENV[@]}" VITE_TURNSTILE_SITE_KEY=
build noenv VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= VITE_TURNSTILE_SITE_KEY=
build turnstile "${TEST_ENV[@]}" VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA

pids=()
serve() { node tests/e2e/serve.mjs "$B/$1" "$2" & pids+=($!); }
serve noenv 4401; serve env 4402; serve turnstile 4403; serve noenv 4301; serve env 4302
trap 'kill "${pids[@]}" 2>/dev/null' EXIT
sleep 1

if [ $# -gt 0 ]; then suites=("$@"); else suites=($(cd tests/e2e && ls *.test.js | sed 's/\.test\.js$//')); fi
failed=()
for s in "${suites[@]}"; do
  echo "== $s"
  out=$(cd tests/e2e && timeout 900 node "$s.test.js" 2>&1); code=$?
  echo "$out" | grep -E "FAIL|passed|PASSED|failed|Error" | tail -20
  if [ $code -ne 0 ] || grep -qE "^FAIL|FAILED|[1-9][0-9]* failed|Error:" <<<"$out"; then failed+=("$s"); fi
done
echo
if [ ${#failed[@]} -gt 0 ]; then echo "Failed: ${failed[*]}"; exit 1; fi
echo "All ${#suites[@]} suites passed."
