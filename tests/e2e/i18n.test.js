// English and Italian (src/lib/i18n.js, LangSwitch.jsx):
//   * the "EN | IT" switch in the header (and the phone menu): <html lang>,
//     remembered in this browser, English by default;
//   * Italian formatting of prices and dates;
//   * /privacy and /terms in Italian: the courtesy translation, under the
//     line saying the English version prevails;
//   * every page, in Italian, for visitors, students, companies and admins,
//     at 1280, 375 and 320px: no English left on the screen (texts of the
//     translation files, or sentences with English words) other than what
//     users wrote, and nothing cut off or wider than the screen.
const { chromium } = require('./lib/browser.js');
const { mock, login, ID, JOBS, AREAS, NEBBIA, FINTRA, EXAMPLE_CO, EXAMPLE_JOBS } = require('./lib/mock.js');
const { emock, employerLogin } = require('./lib/emock.js');
const { amock } = require('./lib/amock.js');
const { stubMap } = require('./lib/stub.js');
const en = require('../../src/i18n/en.json');
const it = require('../../src/i18n/it.json');
const E = 'http://127.0.0.1:4402';
const OUT = require('./lib/browser.js').OUT;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const PHONES = [['375', { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }], ['320', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true }]];
const italian = (ctx) => ctx.addInitScript(() => { try { if (!localStorage.getItem('gigome-lang')) localStorage.setItem('gigome-lang', 'it'); } catch {} });

// What users wrote (the mocks' jobs, companies, names, reports ...): it stays
// as written, in any language.
const USER = new Set();
(function collect(v) {
  if (typeof v === 'string') { if (/\p{L}{3,}/u.test(v)) USER.add(v.trim()); }
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
})([JOBS, AREAS, NEBBIA, FINTRA, EXAMPLE_CO, EXAMPLE_JOBS, 'Ana Rossi', 'Bocconi University', 'Marco Bianchi', 'Christmas gift wrapping and shop help',
  'Libreria Pennalunga', 'Closed cafe job', 'Old Cafe', 'Approved Co', 'Specialty coffee.', 'They asked me for a €50 fee.', 'Pay €30 to join.', 'Serve coffee.',
  'Add pay.', 'Promoter', 'Weekend barista (live)', 'Night shift', 'Gone Ltd', 'Pay was half.', 'Live barista', 'Needs changes', 'Rejected one', 'Old draft',
  'Expired one', 'Unpublished one', 'Please state the pay.', 'Asks students for a deposit.', 'Unpublished after a report: asked for a fee.', 'Nebbia',
  'Lodi T.I.B.B.', 'Lanza', 'Duomo']);
const USER_LIST = [...USER].sort((a, b) => b.length - a.length);
// English words that never appear in Italian sentences.
const EN_WORDS = /\b(the|and|your|you|with|this|that|for|are|can|will|what|how|here|from|have|has|not|our|we|it's|don't|isn't|can't|won't|please|only|when|which|who)\b/gi;
const SHOWN_EN = new Map(Object.keys(en).filter((k) => en[k] !== it[k] && /\p{L}{3,}/u.test(en[k]) && !/[{<]/.test(en[k])).map((k) => [en[k].trim(), k]));

// Every visible text (and the words of placeholders, labels and titles) on the page.
const visibleTexts = (p) => p.evaluate(() => {
  const out = [];
  const shown = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && (r.width > 0 || el.closest('.sr-only')); };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || el.closest('[hidden],template,.maplibregl-ctrl-attrib,.map-credit') || !shown(el)) continue;
    // Marked as another language on purpose (the switch's "English").
    if (el.closest('[lang]') && el.closest('[lang]') !== document.documentElement) continue;
    const t = n.textContent.replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  for (const el of document.querySelectorAll('[placeholder],[aria-label],[title],img[alt]')) {
    if (el.closest('.maplibregl-ctrl-attrib,.maplibregl-ctrl')) continue;
    if (el.closest('[lang]') && el.closest('[lang]') !== document.documentElement) continue;
    for (const a of ['placeholder', 'aria-label', 'title', 'alt']) { const v = el.getAttribute(a); if (v && v.trim()) out.push(v.trim()); }
  }
  out.push(document.title);
  return out;
});

function englishLeft(texts) {
  const bad = new Set();
  for (const raw of texts) {
    let s = raw;
    if (USER.has(s.trim()) || USER_LIST.some((u) => u.includes(s.trim()))) continue;
    for (const u of USER_LIST) if (s.includes(u)) s = s.split(u).join(' ');
    if (!/\p{L}{3,}/u.test(s)) continue;
    if (SHOWN_EN.has(s.trim())) { bad.add(`"${raw}" (${SHOWN_EN.get(s.trim())})`); continue; }
    const words = new Set((s.match(EN_WORDS) || []).map((w) => w.toLowerCase()));
    if (words.size >= 2) bad.add(`"${raw}"`);
  }
  return [...bad];
}

// Wider than the screen, or text cut off inside a button, tag, link or heading.
const layoutProblems = (p) => p.evaluate(() => {
  const out = [];
  if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`page is ${document.documentElement.scrollWidth}px wide`);
  const scrolls = (el) => { for (let a = el.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') return true; } return false; };
  for (const el of document.querySelectorAll('button, .btn, .tag, .chip, a, label, h1, h2, h3, select, .badge, th, summary')) {
    if (el.closest('.sr-only, .maplibregl-map, dialog:not([open])') || el.matches('.header-user, .menu-user, .sr-only')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const s = getComputedStyle(el);
    const name = (el.textContent || el.getAttribute('aria-label') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
    if ((s.overflow !== 'visible' || s.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && el.tagName !== 'SELECT') out.push(`cut off: "${name}" (${el.scrollWidth} > ${el.clientWidth})`);
    // Words spilling out of a button or tag that doesn't clip them.
    else if (el.matches('button, .btn, .tag, .chip, .badge') && el.scrollWidth > el.clientWidth + 1) out.push(`spills out: "${name}" (${el.scrollWidth} > ${el.clientWidth})`);
    if (r.right > innerWidth + 1 && !scrolls(el)) out.push(`off screen: "${name}" (right edge ${Math.round(r.right)})`);
  }
  // A select's chosen option wider than the box would be cut off.
  for (const el of document.querySelectorAll('select')) {
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    const o = el.options[el.selectedIndex]; if (!o) continue;
    const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(el).font;
    if (c.measureText(o.text).width > el.clientWidth - 20) out.push(`select cut off: "${o.text}"`);
  }
  return [...new Set(out)];
});

async function audit(p, label, { layout = true } = {}) {
  await p.waitForTimeout(150);
  const left = englishLeft(await visibleTexts(p));
  ok(left.length === 0, `${label}: no English left on the screen: ${left.slice(0, 8).join(' | ')}`);
  if (layout) {
    const lp = await layoutProblems(p);
    ok(lp.length === 0, `${label}: nothing cut off or off screen: ${lp.slice(0, 6).join(' | ')}`);
    if (lp.length) await p.screenshot({ path: `${OUT}/i18n-${label.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true });
  }
}

const PUBLIC = ['/', '/jobs', `/jobs/${ID(1)}`, `/jobs/${ID(2)}`, `/companies/${NEBBIA.id}`, '/login', '/employers', '/how-it-works', '/safety', '/privacy', '/terms', '/nope'];

(async () => {
  const b = await chromium.launch();

  // ---- the switch, desktop: English by default, Italian remembered
  { const ctx = await b.newContext(desk); await mock(ctx); await stubMap(ctx); const p = await ctx.newPage();
    await p.goto(E + '/jobs'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => document.documentElement.lang) === 'en', 'English by default: <html lang="en">');
    const sw = p.locator('.site-header .header-actions .lang-switch');
    ok(await sw.isVisible() && (await sw.innerText()).replace(/\s+/g, '') === 'EN|IT', 'the header shows "EN | IT"');
    ok(await sw.locator('button[aria-pressed="true"]').innerText() === 'EN', 'EN is chosen');
    ok(await p.locator('.main-nav a').first().innerText() === 'Jobs', 'English header');
    await sw.locator('button', { hasText: 'IT' }).click(); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.documentElement.lang) === 'it', 'IT: <html lang="it">');
    ok(await p.locator('.main-nav a').first().innerText() === it['header.jobs'], 'IT: the header is in Italian');
    ok(await sw.locator('button[aria-pressed="true"]').innerText() === 'IT', 'IT is chosen');
    ok(await p.evaluate(() => localStorage.getItem('gigome-lang')) === 'it', 'the choice is remembered in localStorage');
    ok(await p.title() === `${it['seo.jobs.title']} | GigoMe`, 'IT: the tab title too: ' + await p.title());
    await p.reload(); await p.waitForTimeout(600);
    ok(await p.evaluate(() => document.documentElement.lang) === 'it' && await p.locator('.main-nav a').first().innerText() === it['header.jobs'], 'after a reload: still Italian');
    await p.goto(E + `/jobs/${ID(1)}`); await p.waitForTimeout(600);
    ok((await p.innerText('main')).includes('€11/h') && (await p.innerText('main')).includes(it['jobType.part_time']), 'IT job page');
    await p.locator('.site-header .lang-switch button', { hasText: 'EN' }).click(); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.documentElement.lang) === 'en' && (await p.innerText('main')).includes('Part-time'), 'back to English without reloading');
    ok(await p.evaluate(() => localStorage.getItem('gigome-lang')) === 'en', 'English remembered too');
    await ctx.close(); }

  // ---- blocked storage: the switch still works for the page
  { const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
    await p.goto(E + '/'); await p.waitForTimeout(500);
    await p.locator('.site-header .lang-switch button', { hasText: 'IT' }).click(); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.documentElement.lang) === 'it', 'storage blocked: switching still works');
    await ctx.close(); }

  // ---- phones: in the header at 320px and in the menu
  for (const [w, dev] of PHONES) {
    const ctx = await b.newContext(dev); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/'); await p.waitForTimeout(500);
    const sw = p.locator('.site-header .header-actions .lang-switch');
    ok(await sw.isVisible(), `${w}px: the switch is in the header`);
    const box = await sw.boundingBox();
    ok(box && box.x >= 0 && box.x + box.width <= Number(w), `${w}px: the switch fits on the screen`);
    const menu = await p.locator('#menu-btn').boundingBox();
    ok(menu && menu.x + menu.width <= Number(w), `${w}px: Menu still fits next to it`);
    await p.click('#menu-btn'); await p.waitForTimeout(200);
    ok(await p.locator('#menu-panel .lang-switch').isVisible(), `${w}px: the switch is in the menu too`);
    await p.locator('#menu-panel .lang-switch button', { hasText: 'IT' }).click(); await p.waitForTimeout(400);
    ok(await p.evaluate(() => document.documentElement.lang) === 'it', `${w}px: switching from the menu`);
    ok((await p.locator('#menu-btn').innerText()) === it['common.close'] || (await p.locator('#menu-btn').innerText()) === it['header.menu'], `${w}px: the menu button is in Italian`);
    const lp = await layoutProblems(p);
    ok(lp.length === 0, `${w}px IT: header and menu fit: ${lp.join(' | ')}`);
    await ctx.close();
  }

  // ---- Italian formats and the legal texts
  { const ctx = await b.newContext(desk); await italian(ctx); await mock(ctx, { examples: true }); const p = await ctx.newPage();
    await p.goto(E + `/jobs/${EXAMPLE_JOBS[0].id}`); await p.waitForTimeout(600);
    const main = await p.innerText('main');
    ok(main.includes('€9,50/h'), 'IT: €9,50/h (decimal comma)');
    await p.goto(E + '/jobs'); await p.waitForTimeout(600);
    ok((await p.innerText('main')).includes('€9,50/h'), 'IT: €9,50/h on the cards too');
    ok(/\b\d+ giorni fa\b/.test(await p.innerText('main')) && (await p.innerText('main')).includes('Ieri'), 'IT: posted "Ieri", "3 giorni fa"');
    for (const [path, title] of [['/privacy', 'Informativa sulla privacy'], ['/terms', 'Termini e condizioni']]) {
      await p.goto(E + path); await p.waitForTimeout(800);
      const first = p.locator('main .legal-courtesy').first();
      ok(await first.innerText() === 'Traduzione di cortesia. In caso di differenze, prevale la versione inglese.', `${path} IT: the courtesy line at the top`);
      ok(await first.evaluate((el) => el.compareDocumentPosition(document.querySelector('.legal-doc')) & Node.DOCUMENT_POSITION_FOLLOWING), `${path} IT: above the text`);
      ok((await p.innerText('.legal-doc h1')).length > 0 && !(await p.innerText('.legal-doc')).includes('Privacy at a glance'), `${path} IT: the Italian text`);
      ok((await p.title()).includes(title), `${path} IT: title ${await p.title()}`);
      ok(await p.locator('#section-10').count() === 1, `${path} IT: section anchors kept`);
    }
    await p.locator('.site-header .lang-switch button', { hasText: 'EN' }).click(); await p.waitForTimeout(400);
    ok(await p.locator('.legal-courtesy').count() === 0 && (await p.innerText('.legal-doc h1')).includes('Terms'), '/terms EN: the English text, no courtesy line');
    await ctx.close(); }

  // ---- every page in Italian, logged out, at 1280, 375 and 320
  for (const [w, dev] of [['1280', desk], ...PHONES]) {
    const ctx = await b.newContext(dev); await italian(ctx); await mock(ctx, { examples: true }); await stubMap(ctx); const p = await ctx.newPage();
    for (const path of PUBLIC) {
      await p.goto(E + path); await p.waitForTimeout(path === '/privacy' || path === '/terms' ? 900 : 600);
      await audit(p, `${w} logged out ${path}`);
    }
    await p.goto(E + '/jobs?view=map'); await p.waitForTimeout(900);
    await audit(p, `${w} logged out /jobs map`);
    // The Feedback button: fully shown on the home page at first load.
    await p.goto(E + '/'); await p.waitForTimeout(700);
    ok(await p.locator('.feedback-fab').isVisible() && await p.locator('.feedback-fab').getAttribute('data-away') === null, `${w} IT: home page, first load: the Feedback button is fully shown`);
    await p.click('.feedback-fab'); await p.waitForTimeout(300);
    await audit(p, `${w} logged out feedback panel`);
    await ctx.close();
  }

  // ---- a student
  for (const [w, dev] of [['1280', desk], ...PHONES]) {
    const ctx = await b.newContext(dev);
    const log = await mock(ctx, { examples: true, saved: [ID(1), 'gone-1'], searches: [{ id: 'ss1', name: 'Barista weekends', params: 'q=barista&when=weekends', created_at: new Date().toISOString(), last_seen_at: new Date(Date.now() - 5 * 864e5).toISOString() }], follows: [{ company_id: NEBBIA.id, created_at: new Date().toISOString() }], opened: [{ job_id: ID(1), title: 'Weekend barista', company_name: 'Nebbia Coffee Bar', last_opened_at: new Date().toISOString(), live: true }] });
    await stubMap(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p);
    await p.evaluate(() => localStorage.setItem('gigome-lang', 'it'));
    for (const path of ['/', '/jobs', `/jobs/${ID(1)}`, '/saved', '/account', `/companies/${NEBBIA.id}`, `/jobs/${EXAMPLE_JOBS[0].id}`]) {
      await p.goto(E + path); await p.waitForTimeout(700);
      await audit(p, `${w} student ${path}`);
    }
    // Apply, and the example's demo.
    await p.goto(E + `/jobs/${ID(1)}`); await p.waitForTimeout(700);
    await p.locator('.apply-box button.btn-primary, .apply-box .btn-primary').first().click().catch(() => {}); await p.waitForTimeout(500);
    for (const pg of ctx.pages()) if (pg !== p) await pg.close();
    await audit(p, `${w} student after Apply`);
    await p.goto(E + '/jobs?q=barista&when=weekends'); await p.waitForTimeout(700);
    await audit(p, `${w} student filtered jobs`);
    // Report this job, and the log-out dialog.
    await p.goto(E + `/jobs/${ID(1)}`); await p.waitForTimeout(700);
    const rep = p.locator('.report-job button').first(); if (await rep.count()) { await rep.click(); await p.waitForTimeout(300); await audit(p, `${w} student report form`); }
    await p.goto(E + '/account'); await p.waitForTimeout(700);
    const del = p.locator('main button', { hasText: it['account.delete'] || 'Elimina' }).first(); if (await del.count()) { await del.click(); await p.waitForTimeout(300); await audit(p, `${w} student delete reminder`); }
    void log; await ctx.close();
  }

  // ---- a new student on /welcome (self-declared, Terms not accepted)
  { const ctx = await b.newContext(PHONES[1][1]); await mock(ctx, { fullName: null, termsVersion: null, verification: 'self_declared' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p, 'ana@gmail.com');
    await p.evaluate(() => localStorage.setItem('gigome-lang', 'it'));
    await p.goto(E + '/welcome'); await p.waitForTimeout(800);
    await audit(p, '320 new student /welcome');
    await ctx.close(); }

  // ---- the login steps in Italian (code step, errors)
  for (const [w, dev] of [['1280', desk], PHONES[1]]) {
    const ctx = await b.newContext(dev); await italian(ctx); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await p.waitForTimeout(500);
    await p.locator('details').first().click().catch(() => {}); await p.waitForTimeout(300);
    await audit(p, `${w} login, universities open`);
    await p.fill('input[name=email]', 'ana@studbocconi.it'); await p.locator('form button[type=submit]').first().click(); await p.waitForTimeout(500);
    await audit(p, `${w} login, code step`);
    await p.fill('input[name=code]', '000000'); await p.waitForTimeout(800);
    await audit(p, `${w} login, wrong code`);
    await ctx.close();
  }

  // ---- a company: setup, dashboard, the job form
  const future = (d) => new Date(Date.now() + d * 864e5).toISOString();
  const jobs = [
    { title: 'Live barista', job_type: 'part_time', hours_per_week: 12, area_id: 1, status: 'published', published_at: future(-3) },
    { title: 'Needs changes', job_type: 'gig', hours_per_week: 8, area_id: 1, status: 'changes_requested', review_note: 'Please state the pay.', reviewed_at: future(-1) },
    { title: 'Rejected one', job_type: 'gig', hours_per_week: 8, status: 'rejected', review_note: 'Asks students for a deposit.' },
    { title: 'Old draft', job_type: 'other', hours_per_week: 5, status: 'draft' },
    { title: 'Expired one', job_type: 'gig', hours_per_week: 5, status: 'published', expires_at: future(-2) }
  ];
  for (const [w, dev] of [['1280', desk], ...PHONES]) {
    { const ctx = await b.newContext(dev); await emock(ctx); await stubMap(ctx); const p = await ctx.newPage();
      await employerLogin(p, E); await p.evaluate(() => localStorage.setItem('gigome-lang', 'it'));
      await p.goto(E + '/employers/setup'); await p.waitForTimeout(700);
      await audit(p, `${w} company /employers/setup`);
      await ctx.close(); }
    { const ctx = await b.newContext(dev); await emock(ctx, { company: { name: 'Nebbia', status: 'approved', website: null, description: null }, jobs, clicks: { j1: 7 }, contacts: { j1: { url: 'https://nebbia.it/jobs', email: null } } }); await stubMap(ctx); const p = await ctx.newPage();
      await employerLogin(p, E); await p.evaluate(() => localStorage.setItem('gigome-lang', 'it'));
      for (const path of ['/dashboard', '/dashboard/jobs/new', '/dashboard/jobs/j1/edit', '/account', '/employers']) {
        await p.goto(E + path); await p.waitForTimeout(800);
        await audit(p, `${w} company ${path}`);
      }
      // The job form's errors and preview.
      await p.goto(E + '/dashboard/jobs/new'); await p.waitForTimeout(800);
      await p.locator('main button[type=submit]').last().click().catch(() => {}); await p.waitForTimeout(400);
      await audit(p, `${w} company job form errors`);
      await ctx.close(); }
    { const ctx = await b.newContext(dev); await emock(ctx, { company: { name: 'Nebbia', status: 'pending' } }); const p = await ctx.newPage();
      await employerLogin(p, E); await p.evaluate(() => localStorage.setItem('gigome-lang', 'it'));
      await p.goto(E + '/dashboard'); await p.waitForTimeout(800);
      await audit(p, `${w} company in review /dashboard`);
      await ctx.close(); }
  }

  // ---- an admin
  for (const [w, dev] of [['1280', desk], PHONES[0]]) {
    const ctx = await b.newContext(dev); await amock(ctx, { admin: true, goneReport: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.evaluate(() => localStorage.setItem('gigome-lang', 'it'));
    await p.goto(E + '/admin'); await p.waitForTimeout(1000);
    await audit(p, `${w} admin /admin`);
    await ctx.close();
  }

  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})().catch((e) => { console.error('Error:', e); process.exit(1); });
