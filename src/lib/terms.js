// Accepting the Terms ("I'm 18 or older and I accept the Terms").
// TERMS_VERSION is the version of the Terms on /terms
// (docs/legal/published/terms-and-conditions-v2.0.html). It is the only
// place the version is set: change it when a new version is published and
// everyone is asked again on their next visit (TermsGate.jsx). The database
// stores the version each account accepted and its own time
// (accept_terms() in supabase/migrations/20261111120000_data_protection.sql).
import { supabase } from './supabase.js';
import { subscribeLang, t } from './i18n.js';

export const TERMS_VERSION = '2.0';

export function hasAcceptedTerms(profile) {
  return Boolean(profile && profile.terms_version === TERMS_VERSION && profile.terms_accepted_at);
}

// Accounts that accepted in this tab, so TermsGate lets them through at once
// (before it has loaded the profile again).
const acceptedHere = new Set();
export const acceptedInThisTab = (userId) => acceptedHere.has(userId);

export async function acceptTerms(userId) {
  const { error } = await supabase.rpc('accept_terms', { p_version: TERMS_VERSION });
  if (error) throw error;
  acceptedHere.add(userId);
}

// The message under an unticked Terms box, in the current language.
export const termsRequired = () => t('termsBox.required');
// The same as a value, kept up to date when the language changes (an ES
// module export is a live binding), for code that reads TERMS_REQUIRED.
export let TERMS_REQUIRED = termsRequired();
subscribeLang(() => {
  TERMS_REQUIRED = termsRequired();
});
