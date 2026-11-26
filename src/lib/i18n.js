// English and Italian. Every text the site shows comes from one translation
// file per language (src/i18n/en.json, src/i18n/it.json: flat keys, the
// same keys in both, checked by tests/unit/i18n.test.mjs) through t().
// English is the default and is always loaded; Italian is downloaded only
// when chosen (the switch in the header, or a ?hl=it link: initLang()) or
// remembered from an earlier visit. The choice stays in this browser only
// (localStorage), and <html lang> follows it.
//
//   t('jobs.title')                          plain text
//   t('jobs.found', { count: 3 })            {count} filled in, and the
//                                            plural form chosen: the keys
//                                            jobs.found_one / jobs.found_other
//   t('feedback.loggedOut', { link: (s) => <Link to="/login">{s}</Link> })
//                                            <link>…</link> in the text
//                                            becomes that element; any value
//                                            that is a React element makes
//                                            t() return an array for JSX
//
// No React here (src/lib/useLang.js has the hook), so the plain modules
// that use it (schedules.js, jobs.js) stay testable with node --test.
import en from '../i18n/en.json' with { type: 'json' };

export const LANGS = ['en', 'it'];
export const DEFAULT_LANG = 'en';
const STORE_KEY = 'gigome-lang';
const dicts = { en };
let lang = DEFAULT_LANG;
const listeners = new Set();

export const getLang = () => lang;
// For dates and numbers: "3 December 2026" / "3 dicembre 2026", "€9.50" / "€9,50".
export const locale = () => (lang === 'it' ? 'it-IT' : 'en-GB');

function stored() {
  try {
    const v = window.localStorage.getItem(STORE_KEY);
    return LANGS.includes(v) ? v : null;
  } catch {
    return null;
  }
}
function store(v) {
  try {
    window.localStorage.setItem(STORE_KEY, v);
  } catch {
    // Private windows and blocked storage: the choice lasts until the tab closes.
  }
}

async function load(l) {
  if (!dicts[l]) dicts[l] = (await import('../i18n/it.json', { with: { type: 'json' } })).default;
}

function apply(l) {
  lang = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

// A link that opens the site in a given language: ?hl=it or ?hl=en, on any
// page (not "lang": /jobs uses that for its job-language filter). Read once,
// when the site loads; it wins over the remembered choice, is remembered
// like a press on EN | IT, and is taken out of the address bar (no reload,
// every other parameter and the #part left exactly as they were). The value
// in any case (it, IT, It); any other value is ignored and left alone.
// Nothing reads the browser's language.
const LINK_PARAM = 'hl';
const pairs = (search) => search.replace(/^\?/, '').split('&').filter(Boolean);
const isLinkParam = (pair) => new URLSearchParams(pair).has(LINK_PARAM);

// The language a ?hl= link asks for ("en" or "it", from any case), or null.
export function linkLang(search) {
  const v = (new URLSearchParams(search).get(LINK_PARAM) || '').toLowerCase();
  return LANGS.includes(v) ? v : null;
}
// The query string without hl ("?a=1&b=2", or "" when nothing is left).
// Works on the raw text so the other parameters keep their exact spelling.
export function withoutLinkLang(search) {
  const rest = pairs(search).filter((p) => !isLinkParam(p));
  return rest.length ? '?' + rest.join('&') : '';
}

function takeLinkLang() {
  const { location, history } = window;
  const l = linkLang(location.search);
  if (!l) return null;
  try {
    history.replaceState(history.state, '', location.pathname + withoutLinkLang(location.search) + location.hash);
  } catch {
    // The language still applies; only the address keeps ?hl=.
  }
  return l;
}

// Before the first render: the language of a ?hl= link, else the remembered
// one, if Italian could be loaded (offline, the site stays in English and a
// link's "it" isn't remembered).
export async function initLang() {
  const browser = typeof window !== 'undefined';
  const fromLink = browser ? takeLinkLang() : null;
  const l = fromLink || (browser ? stored() : null);
  if (l && l !== DEFAULT_LANG) {
    try {
      await load(l);
      if (fromLink) store(l);
      apply(l);
    } catch {
      apply(DEFAULT_LANG);
    }
  } else {
    if (fromLink) store(fromLink);
    apply(DEFAULT_LANG);
  }
}

export async function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  await load(l);
  store(l);
  apply(l);
}

export function subscribeLang(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}

function lookup(key, vars) {
  const d = dicts[lang] || en;
  if (vars && typeof vars.count === 'number') {
    const form = new Intl.PluralRules(locale()).select(vars.count);
    for (const k of [`${key}_${form}`, `${key}_other`]) {
      if (k in d) return d[k];
      if (k in en) return en[k];
    }
  }
  if (key in d) return d[key];
  if (key in en) return en[key];
  return key;
}

// Italian dates after an article: "il 1º dicembre", "l'8 dicembre",
// "all'11 dicembre" (not "il 1", "il 8", "al 11").
const MONTHS = '(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)';
const ELIDED = { il: "l'", al: "all'", dal: "dall'", del: "dell'", nel: "nell'" };
function italianDates(s) {
  if (lang !== 'it') return s;
  return s
    .replace(new RegExp(`\\b(il|al|dal|del|nel) 1 (?=${MONTHS})`, 'g'), '$1 1º ')
    .replace(new RegExp(`\\b(il|al|dal|del|nel) (8|11) (?=${MONTHS})`, 'gi'), (m, a, d) => `${ELIDED[a.toLowerCase()]}${d} `);
}

const isElement = (v) => v != null && typeof v === 'object' && '$$typeof' in v;
// Elements in an array need keys: useLang.js registers React's cloneElement.
let withKey = (el) => el;
export const setKeyer = (f) => {
  withKey = f;
};

export function t(key, vars) {
  const text = lookup(key, vars);
  if (!vars) return text;
  // Values go in as they are (years and ids must not become "2,028"): format
  // amounts and dates before passing them (locale(), longDate() in jobs.js).
  const fmt = (v) => v;
  const rich = Object.values(vars).some((v) => isElement(v) || typeof v === 'function');
  if (!rich) return italianDates(text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(fmt(vars[k])) : m)));
  // <tag>words</tag> and {name}, each replaced by what vars gives; strings stay strings.
  const out = [];
  const re = /<(\w+)>(.*?)<\/\1>|\{(\w+)\}/g;
  let last = 0;
  let m;
  let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const name = m[1] || m[3];
    const v = vars[name];
    let part;
    if (m[1]) part = typeof v === 'function' ? v(m[2]) : m[2];
    else part = name in vars ? fmt(v) : m[0];
    // Elements in an array need keys.
    if (isElement(part) && part.key == null) part = withKey(part, `t${n}`);
    out.push(part);
    n++;
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// [value, label] pairs whose label is read in the current language each time
// (option lists: job types, categories ...), and the matching { value: label }
// object. Code can keep using `list.map(([v, l]) => ...)` and `LABEL[v]`.
export function labelPairs(prefix, values) {
  return values.map((v) => {
    const pair = [v];
    Object.defineProperty(pair, 1, { get: () => t(`${prefix}.${v}`), enumerable: true });
    return pair;
  });
}
export function labelMap(prefix, values) {
  const o = {};
  for (const v of values) Object.defineProperty(o, v, { get: () => t(`${prefix}.${v}`), enumerable: true });
  return o;
}
