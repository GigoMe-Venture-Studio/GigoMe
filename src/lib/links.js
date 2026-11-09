// Links, email addresses and redirect targets that come from users or from
// the address bar. No imports, so the tests can load it on its own.

// The same rules as the database (migration 20261109100000_safe_links.sql):
// http(s) with a host name that has a dot; no spaces, quotes or angle
// brackets. javascript:, data:, mailto: and every other scheme are refused.
const HTTP_URL = /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]{1,5})?([/?#][^\s<>"'`]*)?$/i;
const PLAIN_EMAIL = /^[a-z0-9._%+'-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

// The link itself when it's a safe http(s) address, else null. Used right
// before a link from the database is opened or put in an href.
export function safeHttpUrl(value) {
  const s = String(value || '').trim();
  return HTTP_URL.test(s) ? s : null;
}

// A plain email address (nothing that could add ?bcc= or other headers to a
// mailto: link).
export function isPlainEmail(value) {
  return PLAIN_EMAIL.test(String(value || ''));
}

// A mailto: link with a subject, or null when the address isn't plain.
export function mailtoHref(email, subject) {
  if (!isPlainEmail(email)) return null;
  return `mailto:${email}` + (subject ? `?subject=${encodeURIComponent(subject)}` : '');
}

// A website or apply link as an employer typed it: adds https:// when there
// is no scheme, turns an international domain into its ASCII form. Returns
// '' for empty input and null when it isn't a safe http(s) address.
export function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/\s/.test(s)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s.replace(/^\/+/, '');
  if (safeHttpUrl(withScheme)) return withScheme;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:' || u.username || u.password) return null;
    return safeHttpUrl(u.href);
  } catch {
    return null;
  }
}

// Where to go after login (?next=/jobs/123). Only a path on this site is
// accepted: "//evil.example", "/\evil.example", "https://…", control
// characters and anything that would resolve to another origin give ''.
export function safeNext(value) {
  const v = String(value || '');
  if (!v.startsWith('/') || v.startsWith('//') || v.length > 1000) return '';
  // Backslashes and control characters: browsers read "/\" as "//".
  if (/[\\\u0000-\u001f\u007f]/.test(v)) return '';
  const base = 'https://gigome.invalid';
  try {
    const u = new URL(v, base);
    if (u.origin !== base) return '';
    return u.pathname + u.search + u.hash;
  } catch {
    return '';
  }
}
