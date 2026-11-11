// Accepting the Terms: every logged-in account is asked once for the current
// version (TERMS_VERSION in src/lib/terms.js), then sent back where it was.
const { OUT } = require('./lib/browser.js');
const { chromium } = require('./lib/browser.js');
const { mock, login, ID } = require('./lib/mock.js');
const { emock, employerLogin } = require('./lib/emock.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const url = (p) => new URL(p.url());
const phone = { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true };
const desk = { viewport: { width: 1280, height: 900 } };

(async () => {
  const b = await chromium.launch();

  // ---- A student from before the Terms were asked for (name, nothing accepted)
  { const ctx = await b.newContext(phone); const log = await mock(ctx, { termsVersion: null }); const p = await ctx.newPage();
    await p.goto(E + '/login?next=' + encodeURIComponent('/jobs?q=barista')); await login(p);
    ok(url(p).pathname === '/welcome' && url(p).searchParams.get('next') === '/jobs?q=barista', 'login: sent to /welcome, keeping the way back: ' + p.url());
    ok((await txt(p, 'h1')) === 'Before you continue' && await p.locator('input[name=full_name]').count() === 0, 'only the Terms are asked (the details are already there)');
    ok((await txt(p, '.terms-field label')) === "I'm 18 or older and I accept the Terms" && await p.getAttribute('.terms-field label a', 'href') === '/terms'
       && await p.getAttribute('.terms-field .field-hint a', 'href') === '/privacy', 'the box: "I\'m 18 or older and I accept the Terms", with /terms and /privacy');
    ok(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'phone: no sideways scroll');
    await p.screenshot({ path: OUT + '/phone-terms.png' });
    await p.click('button:has-text("Continue")'); await p.waitForTimeout(300);
    ok((await txt(p, '.terms-field .err')) === 'Tick this box to continue.' && !log.acceptTerms && url(p).pathname === '/welcome', 'not ticked: asked to tick it, nothing recorded');
    await p.goto(E + '/saved'); await p.waitForTimeout(500);
    ok(url(p).pathname === '/welcome' && url(p).searchParams.get('next') === '/saved', 'any other page sends it back to /welcome first: ' + p.url());
    for (const open of ['/terms', '/privacy', '/account']) {
      await p.goto(E + open); await p.waitForTimeout(500);
      ok(url(p).pathname === open, open + ' stays open before accepting (to read the texts, download the data or delete the account)');
    }
    await p.goto(E + '/jobs/' + ID(1) + '#apply'); await p.waitForTimeout(500);
    ok(url(p).pathname === '/welcome' && url(p).searchParams.get('next') === '/jobs/' + ID(1) + '#apply', 'a job page: back to it afterwards, hash included');
    await p.check('input[name=accept_terms]'); await p.click('button:has-text("Continue")'); await p.waitForTimeout(700);
    ok(JSON.stringify(log.acceptTerms) === '[{"p_version":"2.0"}]', 'ticked: the acceptance is recorded with the version: ' + JSON.stringify(log.acceptTerms));
    ok(url(p).pathname === '/jobs/' + ID(1) && await p.locator('.apply button:has-text("Apply")').count() === 1, 'then back on the job, which works as usual');
    await p.goto(E + '/saved'); await p.waitForTimeout(500);
    ok(url(p).pathname === '/saved' && log.acceptTerms.length === 1, 'asked once: the other pages open normally afterwards');
    await p.reload(); await p.waitForTimeout(600);
    ok(url(p).pathname === '/saved', 'and still after a reload (the database has the acceptance)');
    await ctx.close(); }

  // ---- A new version of the Terms asks everyone again
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { termsVersion: '1.0' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p);
    ok(url(p).pathname === '/welcome' && (await txt(p, 'h1')) === 'Before you continue', 'accepted an older version: asked again');
    await p.check('input[name=accept_terms]'); await p.click('button:has-text("Continue")'); await p.waitForTimeout(700);
    ok(url(p).pathname === '/' && JSON.stringify(log.acceptTerms) === '[{"p_version":"2.0"}]', 'then on to the home page');
    await ctx.close(); }

  // ---- Current version accepted: never asked
  { const ctx = await b.newContext(desk); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p);
    ok(url(p).pathname === '/', 'accepted the current version: login goes straight on');
    for (const path of ['/saved', '/jobs', '/account']) { await p.goto(E + path); await p.waitForTimeout(400); ok(url(p).pathname === path, path + ' opens without asking'); }
    ok(!log.acceptTerms, 'nothing recorded again');
    await ctx.close(); }

  // ---- Saving fails: the person is told and stays
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { termsVersion: null, acceptFail: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p);
    await p.check('input[name=accept_terms]'); await p.click('button:has-text("Continue")'); await p.waitForTimeout(600);
    ok(url(p).pathname === '/welcome' && (await txt(p, '[role=alert]')).includes("couldn't save") && log.acceptTerms.length === 1, 'saving fails: an error, stays on /welcome');
    await ctx.close(); }

  // ---- A company account from before (company approved, nothing accepted)
  { const ctx = await b.newContext(desk);
    const { log } = await emock(ctx, { termsVersion: null, company: { name: 'Nebbia Coffee', status: 'approved', terms_accepted_at: '2026-11-01T10:00:00Z' } });
    const p = await ctx.newPage();
    await employerLogin(p, E); await p.waitForTimeout(400);
    ok(url(p).pathname === '/welcome' && url(p).searchParams.get('next') === '/dashboard', 'employer login: /welcome first, then the dashboard: ' + p.url());
    ok((await txt(p, 'h1')) === 'Before you continue' && await p.locator('select[name=degree_level]').count() === 0, 'a company account is asked only the Terms, no student fields');
    await p.check('input[name=accept_terms]'); await p.click('button:has-text("Continue")'); await p.waitForTimeout(800);
    ok(url(p).pathname === '/dashboard' && JSON.stringify(log.acceptTerms) === '[{"p_version":"2.0"}]', 'accepted: on the dashboard, version recorded: ' + p.url() + ' ' + JSON.stringify(log.acceptTerms));
    await ctx.close(); }

  // ---- A new company account: the setup asks (no separate stop on /welcome)
  { const ctx = await b.newContext(desk); const { log } = await emock(ctx, { termsVersion: null }); const p = await ctx.newPage();
    await employerLogin(p, E); await p.waitForTimeout(400);
    ok(url(p).pathname === '/employers/setup' && await p.locator('input[name=accept_terms]').count() === 1, 'new employer: the setup page itself has the Terms box');
    await p.fill('input[name=company_name]', 'Nebbia Coffee'); await p.check('input[name=accept_terms]');
    await p.click('button:has-text("Save company")'); await p.waitForTimeout(700);
    ok(JSON.stringify(log.acceptTerms) === '[{"p_version":"2.0"}]' && (await txt(p, 'main')).includes('your company is saved'), 'setup: company saved, version recorded: ' + JSON.stringify(log.acceptTerms) + ' ' + (await txt(p, 'main')).slice(0, 200));
    await p.click('text=Go to your dashboard'); await p.waitForTimeout(600);
    ok(url(p).pathname === '/dashboard', 'and the dashboard opens without asking again');
    await ctx.close(); }

  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
