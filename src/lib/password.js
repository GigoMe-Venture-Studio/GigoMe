// Logging in with a password, and setting one (CLAUDE.md, "Passwords").
//
// The email code is needed once, at sign-up. Afterwards people log in with
// their email and password; "Email me a code instead" stays as a fallback,
// and "Forgot your password?" is a code login followed by a new password.
// GigoMe never sends a reset link and never asks Supabase for any email but
// the login code:
//   * setPassword() is only offered right after a code login (or on /account
//     while that login is recent). With "Secure password change" on in the
//     dashboard, Supabase lets a session younger than 24 hours set a password
//     without asking again; an older one gets `reauthentication_needed`.
//     The site then asks the person to log in with a code: it never calls
//     supabase.auth.reauthenticate(), which would email a second code.
//   * The "Password changed" notification email must stay off in the
//     dashboard (HANDOVER.md): it would send an email every time.
import { supabase } from './supabase.js';
import { t } from './i18n.js';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN, passwordProblem } from './passwordRules.js';

export { PASSWORD_MIN, PASSWORD_MAX_BYTES, passwordProblem };

// The message for passwordProblem()'s answer, in the current language.
export function passwordProblemMessage(problem) {
  return problem ? t('password.err.' + problem, { n: PASSWORD_MIN }) : '';
}

// Whether the logged-in account has a password yet (my_has_password(): the
// database looks at its own row only). Accounts from before passwords have
// none. If it can't be asked, the answer is true: nobody is stopped or asked
// to set a password because of a network error.
export async function hasPassword() {
  try {
    const { data, error } = await supabase.rpc('my_has_password');
    if (error) return true;
    return data !== false;
  } catch {
    return true;
  }
}

const codeOf = (error) => String((error && (error.code || error.error_code)) || '');
const isCaptcha = (error) => codeOf(error) === 'captcha_failed' || /captcha/i.test((error && error.message) || '');
const isRateLimited = (error) => error.status === 429 || /rate limit|too many/i.test(error.message || '');

// Email and password. captchaToken: from Turnstile, as for the code (Supabase
// checks it on password logins too when CAPTCHA protection is on).
// Returns { user } or { error: message }.
export async function logInWithPassword(email, password, captchaToken) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    ...(captchaToken ? { options: { captchaToken } } : {})
  });
  if (!error) return { user: data.user };
  if (isCaptcha(error)) return { error: t('auth.captcha') };
  if (isRateLimited(error)) return { error: t('password.loginTooMany') };
  // A wrong password, an email without an account and an account without a
  // password all get the same answer from Supabase, on purpose.
  if (codeOf(error) === 'invalid_credentials' || error.status === 400) return { error: t('password.loginWrong'), wrong: true };
  return { error: t('password.loginFailed') };
}

// Sets the logged-in account's password. Returns null when it's set, or
// { error: message, reauth } (reauth: Supabase wants a recent login first;
// the person logs in with a code and sets it then). Asking for a password
// the account already has counts as done.
export async function setPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (!error) return null;
  const code = codeOf(error);
  const message = (error && error.message) || '';
  if (code === 'same_password') return null;
  if (code === 'weak_password') {
    const reasons = (error.reasons || []).map(String);
    return { error: reasons.includes('pwned') ? t('password.err.pwned') : t('password.err.weak', { n: PASSWORD_MIN }) };
  }
  if (code === 'reauthentication_needed' || code === 'current_password_required' || /reauthentication|current password/i.test(message)) {
    return { error: t('password.err.reauth'), reauth: true };
  }
  if (isRateLimited(error)) return { error: t('password.err.tooMany') };
  return { error: t('password.err.failed') };
}
