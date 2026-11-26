// A link that opens the site in a given language: ?hl=it or ?hl=en, on any
// page (src/lib/i18n.js, initLang()):
//   * it wins over the remembered choice and is remembered like a press on
//     EN | IT; then it's taken out of the address bar, without a reload,
//     keeping every other parameter (/jobs's own ?lang= filter included);
//   * everything follows: <html lang>, the switch, the login email's
//     language sent with the code, the legal pages;
//   * the value in any case (IT, It); any other value is ignored; if
//     Italian can't be loaded, English.
const { chromium } = require('./lib/browser.js');
const { mock } = require('./lib/mock.js');
const it = require('../../src/i18n/it.json');
const en = require('../../src/i18n/en.json');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const remember = (ctx, l) => ctx.addInitScript((v) => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('gigome-lang', v); sessionStorage.setItem('seeded', '1'); } } catch {} }, l);
const saved = (p) => p.evaluate(() => localStorage.getItem('gigome-lang'));
const path = (p) => { const u = new URL(p.url()); return u.pathname + u.search + u.hash; };
const htmlLang = (p) => p.evaluate(() => document.documentElement.lang);
// One page load, no extra history entry: the address was changed in place.
// (history.length is recorded before the site's own script runs.)
const atStart = (ctx) => ctx.addInitScript(() => { window.__historyAtStart = history.length; });
const loads = (p) => p.evaluate(() => [performance.getEntriesByType('navigation').length, history.length - window.__historyAtStart]);

(async () => {
  const b = await chromium.launch();

  // ---- /employers?hl=it: Italian page, and the code request asks for an Italian email
  { const ctx = await b.newContext(desk); await atStart(ctx); const log = await mock(ctx, { accountType: 'company', fullName: null }); const p = await ctx.newPage();
    await p.goto(E + '/employers?hl=it'); await p.waitForSelector('#employers-title');
    ok(await htmlLang(p) === 'it', '<html lang="it"> on /employers?hl=it');
    ok((await p.textContent('#employers-title')).trim() === it['employers.title'], 'the employer page is in Italian: ' + await p.textContent('#employers-title'));
    ok(path(p) === '/employers', 'hl is taken out of the address: ' + path(p));
    ok(JSON.stringify(await loads(p)) === '[1,0]', 'no reload and no new history entry: ' + JSON.stringify(await loads(p)));
    ok(await saved(p) === 'it', 'remembered like a press on IT: ' + await saved(p));
    ok(await p.locator('.site-header .lang-switch button[lang=it]').getAttribute('aria-pressed') === 'true', 'the switch shows IT');
    await p.fill('input[name=email]', 'owner@cafe.it'); await p.click('.login-code-option button'); await p.waitForTimeout(400);
    ok(log.otp.length === 1 && JSON.stringify(log.otp[0].data) === JSON.stringify({ language: 'it' }), 'the code request sends { language: "it" }: ' + JSON.stringify(log.otp[0] && log.otp[0].data));
    // The next visit, without hl, stays Italian.
    await p.goto(E + '/jobs'); await p.waitForSelector('.job-card');
    ok(await htmlLang(p) === 'it', 'the next page without hl stays Italian');
    await ctx.close(); }

  // ---- hl=en wins over a remembered Italian
  { const ctx = await b.newContext(desk); await remember(ctx, 'it'); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/employers?hl=en'); await p.waitForSelector('#employers-title');
    ok(await htmlLang(p) === 'en' && (await p.textContent('#employers-title')).trim() === en['employers.title'], 'remembered "it", ?hl=en: English');
    ok(await saved(p) === 'en' && path(p) === '/employers', 'and "en" remembered, hl gone: ' + await saved(p) + ' ' + path(p));
    await ctx.close(); }

  // ---- any case works: ?hl=IT and ?hl=It like ?hl=it, removed the same way
  for (const v of ['IT', 'It']) {
    const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + `/employers?hl=${v}`); await p.waitForSelector('#employers-title');
    ok(await htmlLang(p) === 'it' && (await p.textContent('#employers-title')).trim() === it['employers.title'], `?hl=${v}: Italian`);
    ok(await saved(p) === 'it', `?hl=${v}: remembered as "it": ${await saved(p)}`);
    ok(path(p) === '/employers', `?hl=${v}: taken out of the address: ${path(p)}`);
    await ctx.close();
  }
  { const ctx = await b.newContext(desk); await remember(ctx, 'it'); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/jobs?lang=en&hl=EN'); await p.waitForSelector('.job-card');
    ok(await htmlLang(p) === 'en' && await saved(p) === 'en' && path(p) === '/jobs?lang=en', '?hl=EN over a remembered "it": English, "en" remembered, ?lang= kept: ' + path(p));
    await ctx.close(); }

  // ---- an invalid value: ignored, left in the address, nothing remembered
  for (const [v, before, want] of [['fr', null, 'en'], ['it-IT', null, 'en'], ['', null, 'en'], ['xx', 'it', 'it']]) {
    const ctx = await b.newContext(desk); if (before) await remember(ctx, before); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + `/employers?hl=${v}`); await p.waitForSelector('#employers-title');
    ok(await htmlLang(p) === want, `?hl=${v} (remembered: ${before}): stays ${want}, got ${await htmlLang(p)}`);
    ok(await saved(p) === before, `?hl=${v}: nothing new remembered: ${await saved(p)}`);
    ok(path(p) === `/employers?hl=${v}`, `?hl=${v}: the address is left alone: ${path(p)}`);
    await ctx.close();
  }

  // ---- /jobs?lang=en&hl=it: Italian, and the job-language filter stays
  { const ctx = await b.newContext(desk); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/jobs?lang=en&hl=it'); await p.waitForSelector('.job-card'); await p.waitForTimeout(300);
    ok(await htmlLang(p) === 'it', '/jobs?lang=en&hl=it: Italian');
    ok(path(p) === '/jobs?lang=en', 'only hl is taken out: ' + path(p));
    const chip = p.locator('.chip-filter', { hasText: it['jobs.languages'] }).locator('button', { hasText: it['language.en'] });
    ok(await chip.getAttribute('aria-pressed') === 'true', 'the "Inglese" job-language chip is still on');
    ok(log.jobs.length > 0 && log.jobs.every((s) => decodeURIComponent(s).includes('languages=ov.{en}')), 'every job query keeps the filter: ' + log.jobs.map(decodeURIComponent).join(' | '));
    await ctx.close(); }

  // ---- the legal pages follow, and the #part stays
  { const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/privacy?hl=it#section-10'); await p.waitForTimeout(800);
    ok(path(p) === '/privacy#section-10', '/privacy?hl=it#section-10 keeps the #part: ' + path(p));
    ok((await p.textContent('main')).includes(it['legal.courtesy']), '/privacy shows the Italian courtesy translation');
    await ctx.close(); }

  // ---- Italian can't be loaded: English, as before, and "it" not remembered
  { const ctx = await b.newContext(desk); await mock(ctx); await ctx.route(/\/assets\/it-[\w-]+\.js$/, (r) => r.abort());
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(E + '/employers?hl=it'); await p.waitForSelector('#employers-title');
    ok(await htmlLang(p) === 'en' && (await p.textContent('#employers-title')).trim() === en['employers.title'], 'Italian blocked: the page is in English');
    ok(await saved(p) === null, 'and "it" isn\'t remembered: ' + await saved(p));
    ok(path(p) === '/employers' && errors.length === 0, 'hl still taken out, no errors: ' + path(p) + ' ' + errors.join(' | '));
    await ctx.close(); }

  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})().catch((e) => { console.error('Error:', e); process.exit(1); });
