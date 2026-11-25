// node --test tests/unit
// The password rules (src/lib/passwordRules.js): length only, at most what
// Supabase's bcrypt reads, never the email, typed twice the same.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PASSWORD_MIN, PASSWORD_MAX_BYTES, passwordProblem } from '../../src/lib/passwordRules.js';

test('the limits', () => {
  assert.equal(PASSWORD_MIN, 10);
  assert.equal(PASSWORD_MAX_BYTES, 72);
});

test('length counts characters, not bytes, at the lower end', () => {
  assert.equal(passwordProblem('', ''), 'missing');
  assert.equal(passwordProblem('123456789', '123456789'), 'short');
  assert.equal(passwordProblem('1234567890', '1234567890'), null);
  assert.equal(passwordProblem('èèèèèèèèèè', 'èèèèèèèèèè'), null, '10 accented letters are 10 characters');
  assert.equal(passwordProblem('🙂🙂🙂🙂🙂🙂🙂🙂🙂', '🙂🙂🙂🙂🙂🙂🙂🙂🙂'), 'short', '9 emoji are 9 characters');
});

test('at most 72 bytes, as bcrypt reads', () => {
  const ok = 'a'.repeat(72), long = 'a'.repeat(73);
  assert.equal(passwordProblem(ok, ok), null);
  assert.equal(passwordProblem(long, long), 'long');
  const accents = 'è'.repeat(37); // 74 bytes
  assert.equal(passwordProblem(accents, accents), 'long');
});

test('spaces count and nothing is trimmed', () => {
  assert.equal(passwordProblem('correct horse battery', 'correct horse battery'), null);
  assert.equal(passwordProblem(' abcdefghij', 'abcdefghij'), 'mismatch');
});

test('never the account email, typed twice the same', () => {
  assert.equal(passwordProblem('Ana@StudBocconi.it', 'Ana@StudBocconi.it', 'ana@studbocconi.it'), 'email');
  assert.equal(passwordProblem('a long passphrase', 'a long passphrasE'), 'mismatch');
  assert.equal(passwordProblem('a long passphrase', 'a long passphrase', 'ana@studbocconi.it'), null);
});
