// The login email's language (src/lib/emailLanguage.js,
// EmailLanguageSync.jsx, sendCode() in src/lib/auth.js;
// docs/email/login-code.md):
//   * every code request sends the site's language as { language } (with
//     signup_as on the student login only), which Supabase saves when it
//     creates the account;
//   * right after logging in, and when a logged-in user switches language,
//     the account's saved language is updated with updateUser({ data }) if it
//     differs; never when it's already the same, never when logged out;
//   * a failed update is tried once per visit (again after a reload, never
//     in a loop), and the site keeps working;
//   * "Download my data" includes it.
const { chromium } = require('./lib/browser.js');
const { mock, login } = require('./lib/mock.js');
const { employerLogin } = require('./lib/emock.js');
const { readFileSync } = require('fs');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const italian = (ctx) => ctx.addInitScript(() => { try { if (!localStorage.getItem('gigome-lang')) localStorage.setItem('gigome-lang', 'it'); } catch {} });
// What the site asked Supabase to save, in order.
const updates = (log) => (log.userUpdates || []).map((u) => JSON.stringify(u.data));
// Log in with the Italian page's own words (the login helpers click the English ones).
async function loginIt(p, email = 'ana@studbocconi.it') {
  await p.fill('input[name=email]', email); await p.locator('form button[type=submit]').first().click(); await p.waitForTimeout(300);
  await p.fill('input[name=code]', '123456'); await p.waitForTimeout(900);
}

(async () => {
  const b = await chromium.launch();

  // ---- student login in English, a new account: language "en" with signup_as
  { const ctx = await b.newContext(desk); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p);
    ok(log.otp.length === 1 && JSON.stringify(log.otp[0].data) === JSON.stringify({ signup_as: 'student', language: 'en' }), 'student, English: the code request sends { signup_as: "student", language: "en" }: ' + JSON.stringify(log.otp[0] && log.otp[0].data));
    await p.waitForTimeout(400);
    ok(JSON.stringify(updates(log)) === JSON.stringify(['{"language":"en"}']), 'after logging in, an account without a saved language gets "en", once: ' + updates(log));
    await p.goto(E + '/jobs'); await p.waitForTimeout(500);
    ok(updates(log).length === 1, 'nothing more while the language stays the same');
    // Switching while logged in saves the new language, and back again.
    await p.locator('.site-header .lang-switch button', { hasText: 'IT' }).click(); await p.waitForTimeout(500);
    ok(updates(log).length === 2 && updates(log)[1] === '{"language":"it"}', 'logged in, switch to IT: { language: "it" } saved: ' + updates(log));
    ok(log.userMeta.language === 'it' && Object.keys(log.userMeta).length === 1, 'only the language key is sent (updateUser merges it in)');
    await p.goto(E + '/saved'); await p.waitForTimeout(500);
    ok(updates(log).length === 2, 'saved once: not again on the next page');
    await p.locator('.site-header .lang-switch button', { hasText: 'EN' }).click(); await p.waitForTimeout(500);
    ok(updates(log).length === 3 && updates(log)[2] === '{"language":"en"}', 'switch back to EN: { language: "en" } saved');
    // Download my data includes it.
    await p.goto(E + '/account'); await p.waitForSelector('.account-data-btn');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.account-data-btn')]);
    const data = JSON.parse(readFileSync(await dl.path(), 'utf8'));
    ok(data.account.email_language === 'en', 'Download my data: account.email_language = ' + data.account.email_language);
    await ctx.close(); }

  // ---- student login in Italian: language "it"
  { const ctx = await b.newContext(desk); await italian(ctx); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await loginIt(p);
    ok(log.otp.length === 1 && JSON.stringify(log.otp[0].data) === JSON.stringify({ signup_as: 'student', language: 'it' }), 'student, Italian: { signup_as: "student", language: "it" }: ' + JSON.stringify(log.otp[0] && log.otp[0].data));
    await p.waitForTimeout(400);
    ok(JSON.stringify(updates(log)) === JSON.stringify(['{"language":"it"}']), 'after logging in: "it" saved');
    await ctx.close(); }

  // ---- employer login: the language, never signup_as
  for (const [lang, setup] of [['en', null], ['it', italian]]) {
    const ctx = await b.newContext(desk); if (setup) await setup(ctx); const log = await mock(ctx, { accountType: 'company', fullName: null }); const p = await ctx.newPage();
    if (lang === 'en') await employerLogin(p, E);
    else { await p.goto(E + '/employers'); await p.waitForTimeout(300); await loginIt(p, 'owner@cafe.it'); }
    ok(log.otp.length === 1 && JSON.stringify(log.otp[0].data) === JSON.stringify({ language: lang }), `employer, ${lang}: the code request sends only { language: "${lang}" }: ` + JSON.stringify(log.otp[0] && log.otp[0].data));
    await ctx.close();
  }

  // ---- an account that already has the site's language: nothing to update
  { const ctx = await b.newContext(desk); await italian(ctx); const log = await mock(ctx, { userLanguage: 'it' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await loginIt(p); await p.waitForTimeout(400);
    await p.goto(E + '/jobs'); await p.waitForTimeout(400);
    ok(updates(log).length === 0, 'saved "it", site in Italian: no update');
    await ctx.close(); }

  // ---- an account saved as "it" logging in from an English page: "en"
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { userLanguage: 'it' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.waitForTimeout(400);
    ok(JSON.stringify(updates(log)) === JSON.stringify(['{"language":"en"}']), 'saved "it", logged in from English: "en" saved');
    await ctx.close(); }

  // ---- logged out: switching saves nothing anywhere
  { const ctx = await b.newContext(desk); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/jobs'); await p.waitForTimeout(400);
    await p.locator('.site-header .lang-switch button', { hasText: 'IT' }).click(); await p.waitForTimeout(400);
    await p.locator('.site-header .lang-switch button', { hasText: 'EN' }).click(); await p.waitForTimeout(400);
    ok(updates(log).length === 0 && log.otp.length === 0, 'logged out: no request to Supabase Auth when switching');
    await ctx.close(); }

  // ---- the update fails: tried once, the site keeps working
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { userUpdateFail: true }); const p = await ctx.newPage();
    const errors = []; p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(E + '/login'); await login(p); await p.waitForTimeout(500);
    // Moving around inside the site: no new attempt.
    await p.click('.main-nav a[href="/jobs"]'); await p.waitForTimeout(500);
    await p.click('.main-nav a[href="/saved"]'); await p.waitForTimeout(500);
    await p.click('.main-nav a[href="/jobs"]'); await p.waitForTimeout(500);
    ok(updates(log).length === 1, 'a failed update is tried once while on the site, not on every page: ' + updates(log).length);
    // The next visit (a reload) tries again, once.
    await p.reload(); await p.waitForTimeout(800);
    ok(updates(log).length === 2, 'and once more on the next visit: ' + updates(log).length);
    ok(errors.length === 0 && (await p.locator('.header-user').count()) === 1 && (await p.locator('.job-card').count()) > 0, 'the site keeps working, logged in: ' + errors.join(' | '));
    await ctx.close(); }

  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})().catch((e) => { console.error('Error:', e); process.exit(1); });
