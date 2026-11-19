// Login with a 6-digit email code (see CLAUDE.md: never magic links).
import { supabase } from './supabase.js';
import { CONTACT_EMAIL } from './contact.js';
import { getLang, labelPairs, t } from './i18n.js';

export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 60;
// Must match Authentication > Sign In / Providers > Email > "Email OTP
// Expiration" in the Supabase dashboard (Supabase's default is one hour).
// Only used to tell "expired" apart from "wrong" in error messages.
export const CODE_EXPIRY_MINUTES = 60;

// The values allowed by profiles.degree_level in the database, as
// [value, label] pairs (labels in the current language: profile.level.*).
export const DEGREE_LEVELS = labelPairs('profile.level', ['bachelor', 'master', 'single_cycle', 'phd', 'exchange', 'other']);

// Where to go after login (?next=/jobs/123): only paths on this site.
export { safeNext } from './links.js';

export function normalizeEmail(raw) {
  return String(raw || '').trim().toLowerCase();
}

// Everything after the last @, as the database's university_for_email() does.
export function emailDomain(email) {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1);
}

export function looksLikeEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Every university on GigoMe, by name, with its student email domains
// (lowercased). Universities without a domain are left out: nobody can log in
// with them. The universities table is readable without logging in.
export async function fetchUniversities() {
  const { data, error } = await supabase.from('universities').select('id, name, email_domains').order('name');
  if (error) throw error;
  return (data || [])
    .map((u) => ({
      id: u.id,
      name: u.name,
      domains: (u.email_domains || []).map((d) => String(d).trim().toLowerCase()).filter(Boolean)
    }))
    .filter((u) => u.domains.length > 0);
}

// The university this email belongs to, or null. Same rule as the database:
// the lowercased domain must exactly match one of the university's domains.
export function universityFor(email, universities) {
  const domain = emailDomain(email);
  return universities.find((u) => u.domains.includes(domain)) || null;
}


// captchaToken: from Turnstile, when it's configured (see src/lib/captcha.js).
// Supabase ignores it until CAPTCHA protection is turned on in its dashboard.
// asStudent: the student login. Supabase stores { signup_as: 'student' } in a
// NEW user's metadata only (an existing account's is left alone), and the
// database reads it once, when it creates the profile: any email then becomes
// a student account, verified ('university_email') if its domain is a listed
// university's, 'self_declared' otherwise. Without it (the employer login) a
// new account is a company account, unless its domain is a university's.
// language: the site's language ('en' or 'it'), for the login email only
// (the email template reads it, docs/email/login-code.md). Like signup_as,
// Supabase saves it only when it creates the account; an existing account's
// is kept up to date by EmailLanguageSync.jsx. Nothing else may read it:
// users can change their own metadata.
export async function sendCode(email, captchaToken, { asStudent = false } = {}) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: { ...(asStudent ? { signup_as: 'student' } : {}), language: getLang() },
      ...(captchaToken ? { captchaToken } : {})
    }
  });
  return error ? sendErrorMessage(error) : null;
}

export async function verifyCode(email, code, sentAt, captchaToken) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: 'email',
    ...(captchaToken ? { options: { captchaToken } } : {})
  });
  return error ? { error: verifyErrorMessage(error, sentAt) } : { user: data.user };
}

// Supabase refused the Turnstile token (missing, used twice or expired).
function isCaptchaError(error) {
  return error.code === 'captcha_failed' || /captcha/i.test(error.message || '');
}
const captchaMessage = () => t('auth.captcha');

function isRateLimited(error) {
  return error.status === 429 || /rate limit|too many/i.test(error.message || '');
}

export function sendErrorMessage(error) {
  const code = error.code || '';
  if (isCaptchaError(error)) return captchaMessage();
  if (code === 'over_email_send_rate_limit') {
    return t('auth.overSendLimit');
  }
  if (code === 'signup_disabled' || code === 'otp_disabled' || code === 'email_provider_disabled') {
    return t('auth.paused', { email: CONTACT_EMAIL });
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') {
    return t('auth.badEmail');
  }
  if (isRateLimited(error) || /for security purposes/i.test(error.message || '')) {
    return t('auth.waitMinute');
  }
  return t('auth.sendFailed');
}

export function verifyErrorMessage(error, sentAt) {
  if (isCaptchaError(error)) return captchaMessage();
  if (isRateLimited(error)) {
    return t('auth.tooMany');
  }
  // Supabase answers a wrong code and an expired code with the same error,
  // so tell them apart by the age of the code.
  if (error.code === 'otp_expired' || error.status === 403 || /expired|invalid/i.test(error.message || '')) {
    const minutes = (Date.now() - sentAt) / 60000;
    if (sentAt && minutes >= CODE_EXPIRY_MINUTES) {
      return t('auth.expired');
    }
    return t('auth.wrongCode');
  }
  return t('auth.verifyFailed');
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, degree_level, graduation_year, account_type, student_verification, student_declared_at, terms_version, terms_accepted_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// A student who signed up with an email that isn't a listed university's and
// hasn't yet answered /welcome's "Which university?" (declare_student).
export function needsStudentAnswers(profile) {
  return Boolean(profile) && profile.account_type === 'student' && profile.student_verification === 'self_declared' && !profile.student_declared_at;
}

// /welcome's answer, recorded once by the database (declare_student): a listed
// university's id, or "Other" with its name.
export async function declareStudent({ universityId = null, otherName = null }) {
  const { error } = await supabase.rpc('declare_student', { p_university_id: universityId, p_other_university: otherName });
  if (error) throw error;
}

export async function saveProfile(userId, fields) {
  const { error } = await supabase.from('profiles').update(fields).eq('id', userId);
  if (error) throw error;
}

// "Log out" signs out this device only, not the student's other devices.
export async function logOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  return error ? t('auth.logOutFailed') : null;
}
