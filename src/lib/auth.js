// Student login with a 6-digit email code (see CLAUDE.md: never magic links).
import { supabase } from './supabase.js';
import { CONTACT_EMAIL } from './contact.js';

export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 60;
// Must match Authentication > Sign In / Providers > Email > "Email OTP
// Expiration" in the Supabase dashboard (Supabase's default is one hour).
// Only used to tell "expired" apart from "wrong" in error messages.
export const CODE_EXPIRY_MINUTES = 60;

// The values allowed by profiles.degree_level in the database.
export const DEGREE_LEVELS = [
  ['bachelor', "Bachelor's degree"],
  ['master', "Master's degree"],
  ['single_cycle', 'Single-cycle degree (ciclo unico)'],
  ['phd', 'PhD'],
  ['exchange', 'Exchange student'],
  ['other', 'Other']
];

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

// The university this email belongs to, or null. Same rule as the database:
// the lowercased domain must exactly match one of the university's domains.
// The universities table is readable without logging in.
export async function findUniversity(email) {
  const domain = emailDomain(email);
  const { data, error } = await supabase.from('universities').select('id, name, email_domains');
  if (error) throw error;
  return (
    (data || []).find((u) =>
      (u.email_domains || []).some((d) => String(d).trim().toLowerCase() === domain)
    ) || null
  );
}

export async function sendCode(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true }
  });
  return error ? sendErrorMessage(error) : null;
}

export async function verifyCode(email, code, sentAt) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  return error ? { error: verifyErrorMessage(error, sentAt) } : { user: data.user };
}

function isRateLimited(error) {
  return error.status === 429 || /rate limit|too many/i.test(error.message || '');
}

export function sendErrorMessage(error) {
  const code = error.code || '';
  if (code === 'over_email_send_rate_limit') {
    return "We're sending a lot of login emails right now. Please try again in a few minutes.";
  }
  if (code === 'signup_disabled' || code === 'otp_disabled' || code === 'email_provider_disabled') {
    return `Logging in is paused right now. Please write to ${CONTACT_EMAIL}.`;
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') {
    return "That email address doesn't look right. Check it and try again.";
  }
  if (isRateLimited(error) || /for security purposes/i.test(error.message || '')) {
    return 'Please wait a minute before asking for another code.';
  }
  return "We couldn't send your code. Check your connection and try again.";
}

export function verifyErrorMessage(error, sentAt) {
  if (isRateLimited(error)) {
    return 'Too many attempts. Please wait a few minutes, then try again or ask for a new code.';
  }
  // Supabase answers a wrong code and an expired code with the same error,
  // so tell them apart by the age of the code.
  if (error.code === 'otp_expired' || error.status === 403 || /expired|invalid/i.test(error.message || '')) {
    const minutes = (Date.now() - sentAt) / 60000;
    if (sentAt && minutes >= CODE_EXPIRY_MINUTES) {
      return 'This code has expired. Ask for a new one below.';
    }
    return "That code isn't right. Check the 6 digits in the latest email we sent you.";
  }
  return "We couldn't check your code. Check your connection and try again.";
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, degree_level, graduation_year, account_type')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveProfile(userId, fields) {
  const { error } = await supabase.from('profiles').update(fields).eq('id', userId);
  if (error) throw error;
}

// "Log out" signs out this device only, not the student's other devices.
export async function logOut() {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  return error ? "We couldn't log you out. Check your connection and try again." : null;
}
