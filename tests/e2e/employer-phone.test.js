// Companies on a phone (/employers?hl=it from a partner's link):
//   * the header's logged-out button says who it's for, "Student login" /
//     "Area studenti", and fits next to the wordmark (from 360px; the G
//     alone below) and Menu, with nothing pushed off screen;
//   * on /employers only, that button is outlined like Menu, so the purple
//     button a company sees is the one to its own login; every other page
//     keeps it purple;
//   * /employers, while the login is below the pitch (under 900px), has
//     "Log in or register your company" / "Accedi o registra la tua azienda"
//     under the lead, on the first screen: it scrolls to the login and puts
//     focus there, without changing the address or adding a history entry.
//     From 900px (side by side) and when logged in there is no such button.
// In Italian and English, at 320 and 390px (the header also at 360, 375, 399
// and 400px, the button's style at 390 and 1280px).

const { chromium } = require('./lib/browser.js');
const { mock } = require('./lib/mock.js');
const { emock, employerLogin } = require('./lib/emock.js');
const it = require('../../src/i18n/it.json');
const en = require('../../src/i18n/en.json');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const L = { it, en };
const phone = (width, height) => ({ viewport: { width, height }, isMobile: true, hasTouch: true });
const box = (p, s) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height, visible: getComputedStyle(e).visibility === 'visible' && r.width > 0 }; }, s);
const HEADER_BTN = '.site-header .header-actions a[href="/login"]';
// Visible links and buttons drawn in the accent purple (inside the screen
// only, if onScreen), with their text and whether they're in the login card.
const purple = (p, onScreen) => p.evaluate((only) => {
  const probe = document.createElement('span'); probe.style.color = 'var(--accent)'; document.body.append(probe);
  const accent = getComputedStyle(probe).color; probe.remove();
  return [...document.querySelectorAll('a, button')].filter((e) => {
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    if (!r.width || !r.height || cs.visibility !== 'visible' || cs.backgroundColor !== accent) return false;
    return !only || (r.bottom > 0 && r.top < innerHeight);
  }).map((e) => ({ text: e.textContent.trim(), inLogin: Boolean(e.closest('.employers-login')), header: Boolean(e.closest('.site-header')) }));
}, onScreen);
const path = (p) => { const u = new URL(p.url()); return u.pathname + u.search + u.hash; };

(async () => {
  const b = await chromium.launch();

  // ---- the header's logged-out button, and it fits (the G alone under 360px only)
  for (const lang of ['it', 'en']) for (const [w, h] of [[320, 568], [360, 640], [375, 667], [390, 844], [399, 844], [400, 844]]) {
    const ctx = await b.newContext(phone(w, h)); await mock(ctx); const p = await ctx.newPage();
    await p.goto(`${E}/employers?hl=${lang}`); await p.waitForSelector('.employers-login input[name=email]'); await p.waitForTimeout(300);
    const at = `${lang} ${w}px`;
    const btn = p.locator(HEADER_BTN);
    const label = (await btn.textContent()).trim();
    ok(label === L[lang]['header.studentLogin'] && label === (lang === 'it' ? 'Area studenti' : 'Student login'), `${at}: the header button says "${L[lang]['header.studentLogin']}": ${label}`);
    const r = await p.evaluate((sel) => {
      const q = (s) => document.querySelector(s).getBoundingClientRect();
      const logo = q('.site-logo'), btn = q(sel), menu = q('#menu-btn');
      const b = document.querySelector(sel);
      return { logoRight: logo.right, btnLeft: btn.left, btnRight: btn.right, btnHeight: btn.height, menuLeft: menu.left, menuRight: menu.right, menuTop: menu.top, menuBottom: menu.bottom,
        cut: b.scrollWidth > b.clientWidth, page: document.documentElement.scrollWidth, win: innerWidth,
        logo: document.querySelector('.site-logo img').currentSrc };
    }, HEADER_BTN);
    ok(r.page <= r.win, `${at}: nothing wider than the screen: ${r.page} > ${r.win}`);
    ok(r.menuLeft >= 0 && r.menuRight <= r.win - 8 && r.menuTop >= 0 && r.menuBottom <= 64, `${at}: Menu fully visible: ${JSON.stringify(r)}`);
    ok(r.btnLeft >= r.logoRight + 8 && r.btnRight <= r.menuLeft, `${at}: logo, button and Menu side by side, not overlapping: ${JSON.stringify(r)}`);
    ok(!r.cut && r.btnHeight === 32, `${at}: the button's words on one line, not cut: ${JSON.stringify(r)}`);
    const mark = w < 360;
    ok(r.logo.endsWith(mark ? '/brand/header-mark.webp' : '/brand/header-wordmark.webp'), `${at}: the ${mark ? 'G alone' : 'wordmark'}: ${r.logo}`);
    if (w === 320) {
      await btn.click(); await p.waitForURL('**/login');
      const opened = await p.waitForFunction((want) => (document.querySelector('main h1') || {}).textContent === want, L[lang]['codeLogin.titleStudent'], { timeout: 5000 }).then(() => true, () => false);
      ok(opened, `${at}: the header button opens the student login`);
    }
    await ctx.close();
  }

  // ---- the header button: outlined like Menu on /employers, purple everywhere else
  for (const lang of ['it', 'en']) for (const [w, h, opts] of [[390, 844, phone(390, 844)], [1280, 900, { viewport: { width: 1280, height: 900 } }]]) {
    const ctx = await b.newContext(opts); await mock(ctx); const p = await ctx.newPage();
    const at = `${lang} ${w}px`;
    await p.goto(`${E}/employers?hl=${lang}`); await p.waitForSelector('.employers-login input[name=email]'); await p.waitForTimeout(300);
    const look = (sel) => p.evaluate((s) => { const cs = getComputedStyle(document.querySelector(s)); return [cs.backgroundColor, cs.color, cs.borderTopColor, cs.borderTopWidth, cs.height].join(' '); }, sel);
    ok(await p.locator(HEADER_BTN).getAttribute('class') === 'btn btn-secondary btn-sm', `${at} /employers: the header button has Menu's classes: ${await p.locator(HEADER_BTN).getAttribute('class')}`);
    ok(await look(HEADER_BTN) === await look('#menu-btn'), `${at} /employers: and looks like Menu: ${await look(HEADER_BTN)} / ${await look('#menu-btn')}`);
    if (w === 390) {
      const seen = await purple(p, true);
      ok(seen.length === 1 && seen[0].text === L[lang]['employers.jumpToLogin'], `${at} /employers: the only purple button on the first screen is "${L[lang]['employers.jumpToLogin']}": ${JSON.stringify(seen)}`);
    } else {
      // From 900px there's no jump button: the login is beside the pitch, and
      // its own "Log in" button is the purple one.
      const seen = await purple(p, false);
      ok(seen.length >= 1 && seen.every((x) => x.inLogin) && !seen.some((x) => x.header), `${at} /employers: purple only inside the employer login, none in the header: ${JSON.stringify(seen)}`);
    }
    // Every other page keeps it purple, including after leaving /employers in the app.
    for (const pg of ['/', '/jobs', '/how-it-works']) {
      await p.goto(E + pg); await p.waitForSelector(HEADER_BTN); await p.waitForTimeout(200);
      ok(await p.locator(HEADER_BTN).getAttribute('class') === 'btn btn-primary btn-sm' && (await purple(p, false)).some((x) => x.header && x.text === L[lang]['header.studentLogin']), `${at} ${pg}: the header button stays purple`);
    }
    await p.goto(`${E}/employers`); await p.waitForSelector('.employers-login input[name=email]'); await p.waitForTimeout(200);
    if (w === 1280) await p.click('.main-nav a[href="/jobs"]');
    else { await p.click('#menu-btn'); await p.click('.menu-panel a[href="/jobs"]'); }
    await p.waitForURL('**/jobs'); await p.waitForTimeout(200);
    ok(await p.locator(HEADER_BTN).getAttribute('class') === 'btn btn-primary btn-sm', `${at}: from /employers to /jobs in the app, purple again`);
    await ctx.close();
  }

  // ---- /employers on a phone: the button to the login
  for (const lang of ['it', 'en']) for (const [w, h] of [[320, 568], [390, 844]]) {
    const ctx = await b.newContext(phone(w, h)); await ctx.addInitScript(() => { window.__historyAtStart = history.length; });
    await mock(ctx); const p = await ctx.newPage();
    await p.goto(`${E}/employers?hl=${lang}`); await p.waitForSelector('.employers-login input[name=email]'); await p.waitForTimeout(300);
    const at = `${lang} ${w}px`;
    const jump = p.locator('.employers-jump button');
    ok(await jump.count() === 1 && (await jump.textContent()).trim() === L[lang]['employers.jumpToLogin'], `${at}: "${L[lang]['employers.jumpToLogin']}" on /employers`);
    const j = await box(p, '.employers-jump button');
    ok(j && j.visible && j.top >= 0 && j.bottom <= h, `${at}: the button is on the first screen: ${JSON.stringify(j)}`);
    ok(j.top > (await box(p, '.employers-intro .lead')).bottom && j.bottom < (await box(p, '.employers-intro h2')).top, `${at}: right under the lead, before the rest of the pitch`);
    ok((await box(p, '.employers-login input[name=email]')).top > h, `${at}: before it's pressed, the login is below the first screen`);
    const before = path(p);
    await jump.click(); await p.waitForTimeout(1200);
    const card = await box(p, '.employers-login'), email = await box(p, '.employers-login input[name=email]');
    ok(card.top >= 0 && card.top <= 40, `${at}: after the press, the login is at the top of the screen: ${card.top}`);
    ok(email.top >= 0 && email.bottom <= h, `${at}: and its email field is on screen: ${JSON.stringify(email)}`);
    ok((await box(p, '.employers-login .employers-login-title, .employers-login h1, .employers-login h2')).top >= 0, `${at}: its heading too`);
    ok(await p.evaluate(() => document.activeElement === document.querySelector('.employers-login')), `${at}: focus moved to the login (not the field: no keyboard pops up)`);
    await p.keyboard.press('Tab');
    ok(await p.evaluate(() => Boolean(document.activeElement.closest('.employers-login'))), `${at}: Tab goes on inside the login`);
    ok(path(p) === before && await p.evaluate(() => history.length - window.__historyAtStart) === 0, `${at}: no change to the address and no history entry: ${path(p)}`);
    if (w === 390) {
      // The login form works as before after the jump.
      await p.fill('input[name=email]', 'owner@cafe.it'); await p.click('.login-code-option button'); await p.waitForTimeout(400);
      ok(await p.locator('input[name=code]').count() === 1, `${at}: the code step after the jump`);
    }
    await ctx.close();
  }

  // ---- reduced motion: the jump is instant
  { const ctx = await b.newContext({ ...phone(390, 844), reducedMotion: 'reduce' }); await mock(ctx); const p = await ctx.newPage();
    await p.goto(`${E}/employers?hl=it`); await p.waitForSelector('.employers-login input[name=email]'); await p.waitForTimeout(300);
    await p.click('.employers-jump button'); await p.waitForTimeout(50);
    const t = (await box(p, '.employers-login')).top;
    ok(t >= 0 && t <= 40, 'reduced motion: at the login straight away: ' + t);
    await ctx.close(); }

  // ---- from 900px the login is next to the pitch: no button
  for (const w of [900, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); await mock(ctx); const p = await ctx.newPage();
    await p.goto(`${E}/employers?hl=it`); await p.waitForSelector('.employers-login input[name=email]'); await p.waitForTimeout(300);
    ok(!(await p.isVisible('.employers-jump button')), `${w}px: no jump button, the login is beside the pitch`);
    ok((await box(p, '.employers-login input[name=email]')).bottom <= 900, `${w}px: the email field is on the first screen`);
    await ctx.close();
  }
  // Under 900px (a tablet held upright) the login is below the pitch: the button is there.
  { const ctx = await b.newContext({ viewport: { width: 820, height: 1180 } }); await mock(ctx); const p = await ctx.newPage();
    await p.goto(`${E}/employers`); await p.waitForSelector('.employers-login input[name=email]'); await p.waitForTimeout(300);
    ok(await p.isVisible('.employers-jump button'), '820px: the jump button, the login is below the pitch');
    await ctx.close(); }

  // ---- logged in: the card says what to do; no "Log in or register" button
  { const ctx = await b.newContext(phone(390, 844)); await emock(ctx); const p = await ctx.newPage();
    await employerLogin(p, E);
    await p.goto(`${E}/employers?hl=it`); await p.waitForSelector('.employers-login .auth-card'); await p.waitForTimeout(500);
    ok((await p.textContent('.employers-login')).includes(it['employers.loggedInTitle']), 'logged in: the card says so');
    ok(await p.locator('.employers-jump').count() === 0, 'logged in: no jump button');
    await ctx.close(); }

  // ---- no Supabase (ConfigError): no button to a login that isn't there
  { const ctx = await b.newContext(phone(390, 844)); const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:4401/employers'); await p.waitForSelector('#employers-title'); await p.waitForTimeout(300);
    ok(await p.locator('.employers-jump').count() === 0, 'no Supabase: no jump button');
    await ctx.close(); }

  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})().catch((e) => { console.error('Error:', e); process.exit(1); });
