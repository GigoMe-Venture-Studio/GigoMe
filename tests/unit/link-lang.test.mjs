// ?hl=it / ?hl=en: a link that opens the site in a given language
// (linkLang(), withoutLinkLang(), initLang() in src/lib/i18n.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLang, initLang, linkLang, withoutLinkLang } from '../../src/lib/i18n.js';

test('hl=en and hl=it count, in any case; nothing else does', () => {
  assert.equal(linkLang('?hl=it'), 'it');
  assert.equal(linkLang('?hl=en'), 'en');
  assert.equal(linkLang('hl=it'), 'it');
  assert.equal(linkLang('?q=bar&hl=it&area=3'), 'it');
  for (const [s, want] of [['?hl=IT', 'it'], ['?hl=It', 'it'], ['?hl=iT', 'it'], ['?hl=EN', 'en'], ['?hl=En', 'en']])
    assert.equal(linkLang(s), want, s);
  for (const s of ['', '?', '?hl=', '?hl=fr', '?hl=it-IT', '?hl=IT-it', '?hl= it', '?lang=it', '?hl', '?xhl=it'])
    assert.equal(linkLang(s), null, s);
});

test('taking hl out keeps every other parameter exactly as written', () => {
  assert.equal(withoutLinkLang('?hl=it'), '');
  assert.equal(withoutLinkLang('?lang=en&hl=it'), '?lang=en');
  assert.equal(withoutLinkLang('?hl=it&lang=en'), '?lang=en');
  assert.equal(withoutLinkLang('?q=caf%C3%A9+bar&hl=it&when=weekends,flexible'), '?q=caf%C3%A9+bar&when=weekends,flexible');
  assert.equal(withoutLinkLang('?next=%2Fjobs%2F1&hl=en'), '?next=%2Fjobs%2F1');
  assert.equal(withoutLinkLang('?hl=it&hl=en'), '');
  assert.equal(withoutLinkLang('?lang=en&hl=IT'), '?lang=en');
});

// A stand-in for the browser: address, history and localStorage.
function browser(href, saved) {
  const u = new URL(href, 'https://gigome.org');
  const store = new Map(saved ? [['gigome-lang', saved]] : []);
  const w = {
    replaced: [],
    location: { pathname: u.pathname, search: u.search, hash: u.hash },
    history: { state: { idx: 0 }, replaceState(state, _t, url) { w.replaced.push({ state, url }); } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
  };
  globalThis.window = w;
  return { w, store };
}

test('?hl=it opens the site in Italian, remembers it and leaves the address without hl', async () => {
  const { w, store } = browser('/employers?hl=it');
  await initLang();
  assert.equal(getLang(), 'it');
  assert.equal(store.get('gigome-lang'), 'it');
  assert.deepEqual(w.replaced, [{ state: { idx: 0 }, url: '/employers' }]);
});

test('hl wins over the remembered choice, both ways', async () => {
  let b = browser('/jobs?hl=en', 'it');
  await initLang();
  assert.equal(getLang(), 'en');
  assert.equal(b.store.get('gigome-lang'), 'en');
  b = browser('/jobs?hl=it', 'en');
  await initLang();
  assert.equal(getLang(), 'it');
  assert.equal(b.store.get('gigome-lang'), 'it');
});

test('?hl=IT and ?hl=It work like ?hl=it, stored as "it"', async () => {
  for (const v of ['IT', 'It']) {
    const { w, store } = browser(`/jobs?lang=en&hl=${v}`, 'en');
    await initLang();
    assert.equal(getLang(), 'it', v);
    assert.equal(store.get('gigome-lang'), 'it', v);
    assert.equal(w.replaced[0].url, '/jobs?lang=en', v);
  }
  const { store } = browser('/?hl=EN', 'it');
  await initLang();
  assert.equal(getLang(), 'en');
  assert.equal(store.get('gigome-lang'), 'en');
});

test('other parameters and the #part stay', async () => {
  const { w } = browser('/jobs?lang=en&hl=it#top');
  await initLang();
  assert.equal(w.replaced[0].url, '/jobs?lang=en#top');
});

test('any other value is ignored: not stored, not taken out of the address', async () => {
  let b = browser('/jobs?hl=fr');
  await initLang();
  assert.equal(getLang(), 'en');
  assert.equal(b.store.size, 0);
  assert.equal(b.w.replaced.length, 0);
  b = browser('/jobs?hl=xx', 'it');
  await initLang();
  assert.equal(getLang(), 'it');
  assert.equal(b.store.get('gigome-lang'), 'it');
  assert.equal(b.w.replaced.length, 0);
});

test('without hl, the remembered choice as before', async () => {
  let b = browser('/', 'it');
  await initLang();
  assert.equal(getLang(), 'it');
  assert.equal(b.w.replaced.length, 0);
  b = browser('/');
  await initLang();
  assert.equal(getLang(), 'en');
  assert.equal(b.store.size, 0);
  delete globalThis.window;
});
