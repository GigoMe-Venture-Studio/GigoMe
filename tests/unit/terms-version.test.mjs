// node --test tests/unit
// Which Terms acceptance counts (src/lib/termsVersion.js), and that the
// version recorded is the version on /terms.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TERMS_VERSION, TERMS_MIN_VERSION, compareVersions, acceptanceCounts } from '../../src/lib/termsVersion.js';

const root = new URL('../../', import.meta.url);

test('versions compare as numbers', () => {
  assert.equal(compareVersions('2.0', '2.1'), -1);
  assert.equal(compareVersions('2.1', '2.1'), 0);
  assert.equal(compareVersions('2.10', '2.9'), 1);
  assert.equal(compareVersions('3.0', '2.99'), 1);
});

test('an acceptance counts from the minimum version on, and needs a time', () => {
  const at = '2026-11-20T10:00:00Z';
  assert.equal(acceptanceCounts('2.1', at, '2.1'), true);
  assert.equal(acceptanceCounts('2.2', at, '2.1'), true);
  assert.equal(acceptanceCounts('2.0', at, '2.1'), false);
  assert.equal(acceptanceCounts('2.0', at, '2.0'), true, 'a change that needs no fresh acceptance keeps 2.0 valid');
  assert.equal(acceptanceCounts('2.1', null, '2.1'), false);
  assert.equal(acceptanceCounts(null, at, '2.1'), false);
  assert.equal(acceptanceCounts('x', at, '2.1'), false);
});

test('TERMS_VERSION is the newest Terms on /terms; the minimum is not newer', () => {
  const files = readdirSync(new URL('docs/legal/published/', root)).map((f) => f.match(/^terms-and-conditions-v(\d+\.\d+)\.html$/)).filter(Boolean).map((m) => m[1]);
  const newest = files.sort(compareVersions).at(-1);
  assert.equal(TERMS_VERSION, newest, 'a new Terms file needs a new TERMS_VERSION (and a decision on TERMS_MIN_VERSION)');
  const shown = JSON.parse(readFileSync(new URL('src/legal/terms.json', root), 'utf8')).source;
  assert.equal(shown, `docs/legal/published/terms-and-conditions-v${TERMS_VERSION}.html`, '/terms shows the version that is recorded');
  assert.ok(compareVersions(TERMS_MIN_VERSION, TERMS_VERSION) <= 0);
});
