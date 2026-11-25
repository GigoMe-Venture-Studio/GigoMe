// Which version of the Terms an account has to have accepted (no imports,
// unit-tested in tests/unit/terms-version.test.mjs).
//
// TERMS_VERSION      the version on /terms: the one recorded when someone
//                    ticks "I'm 18 or older and I accept the Terms"
//                    (accept_terms() stores it with the database's time).
// TERMS_MIN_VERSION  the oldest acceptance that still counts. An account
//                    that accepted an older version is asked again, once,
//                    on its next visit (TermsGate.jsx).
//
// A new version of the Terms (a new file in docs/legal/published/):
// - the legal person says it needs fresh acceptance: set both to it;
// - they say it doesn't: set only TERMS_VERSION. New acceptances record the
//   version people actually saw, and nobody is asked again.
// These are the only places the versions are set.
export const TERMS_VERSION = '2.2';
export const TERMS_MIN_VERSION = '2.2';

// "2.10" is newer than "2.9": compares the numbers, not the text.
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

const VERSION = /^[0-9]{1,3}\.[0-9]{1,3}$/; // the same check as accept_terms()

export function acceptanceCounts(version, acceptedAt, min = TERMS_MIN_VERSION) {
  return Boolean(acceptedAt && version && VERSION.test(version) && compareVersions(version, min) >= 0);
}
