// The password rules (no imports, unit-tested in tests/unit/password.test.mjs).
//
// Only length counts, as NIST SP 800-63B recommends: no "one capital, one
// symbol" rules, which make passwords harder to remember, not to guess.
// PASSWORD_MIN should match Authentication > Sign In / Providers > Email >
// "Minimum password length" in the Supabase dashboard (HANDOVER.md), so the
// API refuses shorter ones too. Supabase stores a bcrypt hash, which reads at
// most 72 bytes: it refuses anything longer, so the site does as well.
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX_BYTES = 72;

const bytes = (s) => new TextEncoder().encode(s).length;

// What's wrong with a new password, or null:
//   'missing'  nothing typed
//   'short'    under PASSWORD_MIN characters
//   'long'     over PASSWORD_MAX_BYTES bytes (about 72 letters, fewer with accents or emoji)
//   'email'    the account's own email address
//   'mismatch' the second box doesn't say the same
// Spaces count like any other character (passphrases are welcome) and
// nothing is trimmed: what is typed is the password.
export function passwordProblem(password, confirm, email = '') {
  const p = String(password || '');
  if (!p) return 'missing';
  if ([...p].length < PASSWORD_MIN) return 'short';
  if (bytes(p) > PASSWORD_MAX_BYTES) return 'long';
  if (email && p.trim().toLowerCase() === String(email).trim().toLowerCase()) return 'email';
  if (p !== String(confirm || '')) return 'mismatch';
  return null;
}
