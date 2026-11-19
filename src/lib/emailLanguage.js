// The language of the login email, saved with the account as user metadata
// ({ language: 'en' | 'it' }) and read only by the email template
// (docs/email/login-code.md). Never use it for anything else, and never for
// anything security-related: users can change their own metadata.
//
// Supabase saves sendCode()'s { language } only when it creates an account,
// so for an existing account it is updated here: right after logging in,
// and whenever a logged-in user switches language, if the saved one differs.
import { supabase } from './supabase.js';

// The language to save for this user, or null when it is already saved.
export function languageToSave(user, lang) {
  if (!user || !lang) return null;
  const saved = user.user_metadata && user.user_metadata.language;
  return saved === lang ? null : lang;
}

// Best effort: a failure only means the next email uses the language saved
// before (or both languages). updateUser merges into the metadata, so
// signup_as stays as it was.
export async function saveEmailLanguage(lang) {
  if (!supabase) return false;
  const { error } = await supabase.auth.updateUser({ data: { language: lang } });
  return !error;
}
