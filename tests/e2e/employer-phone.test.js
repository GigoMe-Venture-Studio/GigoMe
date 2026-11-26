// Companies on a phone (/employers?hl=it from a partner's link):
//   * the header's logged-out button says who it's for, "Student login" /
//     "Accesso studenti", and fits next to Menu without pushing anything off
//     screen (in Italian the logo is the G alone under 400px: the wordmark
//     and "Accesso studenti" don't fit together below that);
//   * /employers, while the login is below the pitch (under 900px), has
//     "Log in or register your company" / "Accedi o registra la tua azienda"
//     under the lead, on the first screen: it scrolls to the login and puts
//     focus there, without changing the address or adding a history entry.
//     From 900px (side by side) and when logged in there is no such button.
// In Italian and English, at 320 and 390px (and at 360, 375 and 399 for the
// header, the widths where the Italian button and the wordmark collide).
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
const path = (p) => { const u = new URL(p.url()); return u.pathname + u.search + u.hash; };

(async () => {
  const b = await chromium.launch();

  // ---- the header's logged-out button, and it fits
  for (const lang of ['it', 'en']) for (const [w, h] of [[320, 568], [360, 640], [375, 667], [390, 844], [399, 844]]) {
    const ctx = await b.newContext(phone(w, h)); await mock(ctx); const p = await ctx.newPage();
    await p.goto(`${E}/employers?hl=${lang}`); await p.waitForSelector('.employers-login input[name=email]'); await p.waitForTimeout(300);
    const at = `${lang} ${w}px`;
    const btn = p.locator('.site-header .header-actions a.btn-primary');
    const label = (await btn.textContent()).trim();
    ok(label === L[lang]['header.studentLogin'] && label === (lang === 'it' ? 'Accesso studenti' : 'Student login'), `${at}: the header button says "${L[lang]['header.studentLogin']}": ${label}`);
    ok(await btn.getAttribute('href') === '/login', `${at}: it opens the student login`);
    const r = await p.evaluate(() => {
      const q = (s) => document.querySelector(s).getBoundingClientRect();
      const logo = q('.site-logo'), btn = q('.site-header .header-actions a.btn-primary'), menu = q('#menu-btn');
      const b = document.querySelector('.site-header .header-actions a.btn-primary');
      return { logoRight: logo.right, btnLeft: btn.left, btnRight: btn.right, btnHeight: btn.height, menuLeft: menu.left, menuRight: menu.right,
        cut: b.scrollWidth > b.clientWidth, page: document.documentElement.scrollWidth, win: innerWidth,
        logo: document.querySelector('.site-logo img').currentSrc };
    });
    ok(r.page <= r.win, `${at}: nothing wider than the screen: ${r.page} > ${r.win}`);
    ok(r.btnLeft >= r.logoRight + 8 && r.btnRight <= r.menuLeft && r.menuRight <= r.win - 8, `${at}: logo, button and Menu side by side, all on screen: ${JSON.stringify(r)}`);
    ok(!r.cut && r.btnHeight === 32, `${at}: the button's words on one line, not cut: ${JSON.stringify(r)}`);
    const mark = w < 360 || (lang === 'it' && w < 400);
    ok(r.logo.endsWith(mark ? '/brand/header-mark.webp' : '/brand/header-wordmark.webp'), `${at}: the ${mark ? 'G alone' : 'wordmark'}: ${r.logo}`);
    if (w === 320) {
      await btn.click(); await p.waitForURL('**/login');
      const opened = await p.waitForFunction((want) => (document.querySelector('main h1') || {}).textContent === want, L[lang]['codeLogin.titleStudent'], { timeout: 5000 }).then(() => true, () => false);
      ok(opened, `${at}: the header button opens the student login`);
    }
    await ctx.close();
  }
  // In Italian from 400px the wordmark is back.
  { const ctx = await b.newContext(phone(400, 844)); await mock(ctx); const p = await ctx.newPage();
    await p.goto(`${E}/employers?hl=it`); await p.waitForSelector('.employers-login input[name=email]'); await p.waitForTimeout(300);
    ok((await p.evaluate(() => document.querySelector('.site-logo img').currentSrc)).endsWith('/brand/header-wordmark.webp'), 'it 400px: the wordmark');
    ok(await p.evaluate(() => document.documentElement.scrollWidth) === 400, 'it 400px: nothing wider than the screen');
    // Switching language changes the logo at once (the <source> follows the
    // language). Under 440px the switch is in the Menu panel.
    await p.setViewportSize({ width: 375, height: 667 }); await p.waitForTimeout(300);
    ok((await p.evaluate(() => document.querySelector('.site-logo img').currentSrc)).endsWith('/brand/header-mark.webp'), 'it 375px: the G alone');
    await p.click('#menu-btn'); await p.click('.menu-panel .lang-switch button[lang=en]'); await p.waitForTimeout(300);
    ok((await p.evaluate(() => document.querySelector('.site-logo img').currentSrc)).endsWith('/brand/header-wordmark.webp'), 'en 375px after the switch: the wordmark');
    if (!(await p.isVisible('.menu-panel'))) await p.click('#menu-btn'); await p.click('.menu-panel .lang-switch button[lang=it]'); await p.waitForTimeout(300);
    ok((await p.evaluate(() => document.querySelector('.site-logo img').currentSrc)).endsWith('/brand/header-mark.webp'), 'it 375px after the switch: the G alone');
    ok(await p.evaluate(() => document.documentElement.scrollWidth) === 375, 'it 375px after the switch: nothing wider than the screen');
    await ctx.close(); }

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
