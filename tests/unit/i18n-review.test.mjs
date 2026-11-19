// The review files for the translator and the legal person
// (docs/i18n/*.csv, written by scripts/i18n-review.mjs) must match the
// translation files, so what they review is what the site shows.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { legalCsv, pageOf, siteCsv } from '../../scripts/i18n-review.mjs';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const en = JSON.parse(read('src/i18n/en.json'));

test('docs/i18n/review-it.csv is up to date (node scripts/i18n-review.mjs)', () => {
  assert.equal(read('docs/i18n/review-it.csv'), siteCsv());
});

test('docs/i18n/review-legal-it.csv is up to date (node scripts/i18n-review.mjs)', () => {
  assert.equal(read('docs/i18n/review-legal-it.csv'), legalCsv());
});

test('every key belongs to a page in the review file', () => {
  assert.deepEqual(Object.keys(en).filter((k) => pageOf(k) === 'Other'), []);
});
