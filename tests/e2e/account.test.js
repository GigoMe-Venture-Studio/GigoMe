const { OUT } = require('./lib/browser.js');
const { chromium, devices } = require('./lib/browser.js');
const { mock, login } = require('./lib/mock.js');
const E = 'http://127.0.0.1:4402', N = 'http://127.0.0.1:4401';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const frames = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const SEL = "main a:not(.role-row),main button,main input,main select,main textarea,.site-footer a,.site-footer button:not(.footer-link-btn),.menu-panel a,.menu-panel button,.maplibregl-ctrl-attrib";
const probe = (sel) => { const b = document.querySelector('.feedback-fab'); const r = b.getBoundingClientRect(); const shown = !b.hasAttribute('data-away'); const hits = [];
  for (const el of document.querySelectorAll(sel)) { const q = el.getBoundingClientRect(); if (q.width && q.height && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) hits.push((el.textContent || el.name || '').trim().slice(0, 20)); }
  return { shown, hits }; };
const hasSession = (p) => p.evaluate(() => Object.keys(localStorage).some((k) => /auth-token/.test(k)));

(async () => {
  const b = await chromium.launch();
  const desk = { viewport: { width: 1280, height: 900 } };

  // logged out: /account -> /login?next=/account -> back to /account
  { const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/account'); await p.waitForTimeout(400);
    ok(new URL(p.url()).pathname === '/login' && new URL(p.url()).searchParams.get('next') === '/account', 'logged out goes to /login?next=/account: ' + p.url());
    await login(p); await p.waitForTimeout(500);
    ok(new URL(p.url()).pathname === '/account', 'back on /account after login: ' + p.url());
    await ctx.close(); }

  // student: header link, page contents, edit
  { const ctx = await b.newContext(desk); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs'); await p.waitForTimeout(400);
    const link = p.locator('.site-header a.header-user');
    ok((await link.innerText()) === 'Ana Rossi' && (await link.getAttribute('href')) === '/account', 'desktop: name is a link to /account');
    await link.click(); await p.waitForTimeout(500);
    ok(new URL(p.url()).pathname === '/account', 'clicking the name opens /account');
    ok((await link.getAttribute('aria-current')) === 'page', 'name marked current on /account');
    const main = await p.innerText('main');
    ok(/Your account/.test(main) && main.includes('ana@studbocconi.it') && main.includes('Bocconi University'), 'shows email and university');
    ok(await p.locator('main input[type=email], main input[name=email], main input[name=university]').count() === 0, 'email and university are not editable');
    ok(log.profileSelects.some((s) => /universities\(name\)/.test(s)), 'reads the university name with the profile');
    ok((await p.inputValue('input[name=full_name]')) === 'Ana Rossi' && (await p.inputValue('select[name=degree_level]')) === 'master' && (await p.inputValue('select[name=graduation_year]')) === '2028', 'fields prefilled');
    // same rules as /welcome
    await p.fill('input[name=full_name]', '   '); await p.click('button:has-text("Save changes")'); await p.waitForTimeout(200);
    ok((await p.innerText('main')).includes('Add your full name.') && !log.patches, 'empty name refused, nothing saved');
    await p.selectOption('select[name=degree_level]', ''); await p.click('button:has-text("Save changes")'); await p.waitForTimeout(200);
    ok((await p.innerText('main')).includes('Choose what you are studying.'), 'degree required');
    ok(await p.getAttribute('input[name=full_name]', 'maxlength') === '120', 'name max 120');
    await p.fill('input[name=full_name]', '  Ana   Maria  Rossi '); await p.selectOption('select[name=degree_level]', 'phd'); await p.selectOption('select[name=graduation_year]', '2030');
    await p.click('button:has-text("Save changes")'); await p.waitForTimeout(500);
    const patch = log.patches && log.patches[0];
    ok(patch && JSON.stringify(patch.body) === JSON.stringify({ full_name: 'Ana Maria Rossi', degree_level: 'phd', graduation_year: 2030 }), 'saves only the three fields, cleaned: ' + JSON.stringify(patch && patch.body));
    ok(patch && /id=eq\./.test(patch.search), 'update is for this user only');
    ok((await p.innerText('main')).includes('Your changes are saved.'), 'saved message');
    ok((await link.innerText()) === 'Ana Maria Rossi', 'header name updates right away');
    await p.screenshot({ path: OUT + '/desk-account.png', fullPage: true });
    await ctx.close(); }

  // save failure
  { const ctx = await b.newContext(desk); await mock(ctx, { saveFail: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/account'); await p.waitForTimeout(500);
    await p.click('button:has-text("Save changes")'); await p.waitForTimeout(400);
    ok((await p.innerText('main')).includes("We couldn't save your changes"), 'save error shown');
    await ctx.close(); }

  // load failure
  { const ctx = await b.newContext(desk); await mock(ctx, { accountFail: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/account'); await p.waitForTimeout(500);
    ok((await p.innerText('main')).includes("We couldn't load your account"), 'load error shown');
    await ctx.close(); }

  // the two buttons are the same size on phones too
  for (const w of [320, 375, 390]) { const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/account'); await p.waitForTimeout(500);
    const kb = await p.locator('.account-danger button:has-text("Keep my account")').boundingBox(), db = await p.locator('.account-danger button:has-text("Delete my account")').boundingBox();
    ok(Math.abs(kb.width - db.width) < 1 && Math.abs(kb.height - db.height) < 1 && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), w + 'px: Keep and Delete the same size, no sideways scroll: ' + Math.round(kb.width) + '/' + Math.round(db.width));
    await ctx.close(); }

  // delete: confirmation, then gone
  { const ctx = await b.newContext(desk); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/account'); await p.waitForTimeout(500);
    const ask = await p.innerText('.account-danger');
    ok(ask.includes('Before you go, remember that new opportunities are added regularly. You can keep your profile ready for the next role whenever the time is right. Still want to leave? You can delete your account below.'), 'step 1: the reminder, word for word');
    ok(await p.locator('input[name=confirm]').count() === 0, 'step 1: no DELETE field yet');
    const keepB = p.locator('.account-danger button:has-text("Keep my account")'), delB = p.locator('.account-danger button:has-text("Delete my account")');
    const kb = await keepB.boundingBox(), db = await delB.boundingBox();
    ok(await keepB.getAttribute('class') === await delB.getAttribute('class') && Math.abs(kb.width - db.width) < 1 && Math.abs(kb.height - db.height) < 1, 'step 1: both buttons equally clear (same style and size)');
    await keepB.click(); await p.waitForTimeout(200);
    ok((await p.innerText('.account-danger')).includes('Good, your account stays as it is.') && await p.locator('input[name=confirm]').count() === 0, 'Keep my account: stays, nothing asked');
    await delB.click(); await p.waitForTimeout(200);
    const del = p.locator('button.account-delete-btn');
    const sec = await p.innerText('.account-danger');
    ok(/can't be undone/.test(sec) && /feedback/.test(sec) && /apply clicks/.test(sec) && !/company/i.test(sec), 'step 2: explains it, student wording: ' + sec.replace(/\n/g, ' '));
    ok(await del.isDisabled(), 'delete disabled before typing');
    await p.locator('.account-danger button:has-text("Keep my account")').click(); await p.waitForTimeout(200);
    ok(await p.locator('input[name=confirm]').count() === 0, 'Keep my account on step 2 goes back');
    await p.locator('.account-danger button:has-text("Delete my account")').click(); await p.waitForTimeout(200);
    await p.fill('input[name=confirm]', 'delete'); ok(await del.isDisabled(), 'lowercase "delete" not enough');
    await p.fill('input[name=confirm]', 'DELET'); ok(await del.isDisabled(), 'partial word not enough');
    ok(!log.deleted, 'nothing deleted yet');
    await p.fill('input[name=confirm]', 'DELETE'); ok(!(await del.isDisabled()), 'DELETE enables the button');
    await del.click(); await p.waitForTimeout(800);
    ok(log.deleted === 1 && log.deleteMethod === 'POST', 'delete_my_account called once');
    ok(new URL(p.url()).pathname === '/', 'back on the home page: ' + p.url());
    ok((await p.innerText('main')).includes('Your account has been deleted.'), 'notice on home');
    ok(await p.locator('.site-header a:has-text("Log in")').count() === 1, 'header shows Log in');
    ok(!(await hasSession(p)), 'session removed from the browser (even though the server refused the logout)');
    await p.screenshot({ path: OUT + '/desk-deleted.png' });
    await p.reload(); await p.waitForTimeout(500);
    ok(!(await p.innerText('main')).includes('Your account has been deleted.'), 'notice not shown again after reload');
    await p.goto(E + '/account'); await p.waitForTimeout(400);
    ok(new URL(p.url()).pathname === '/login', '/account now asks to log in');
    await ctx.close(); }

  // delete failure keeps you logged in
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { deleteFail: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/account'); await p.waitForTimeout(500);
    await p.click('.account-danger button:has-text("Delete my account")'); await p.waitForTimeout(200);
    await p.fill('input[name=confirm]', 'DELETE'); await p.click('button.account-delete-btn'); await p.waitForTimeout(600);
    ok((await p.innerText('main')).includes("We couldn't delete your account"), 'delete error shown');
    ok(new URL(p.url()).pathname === '/account' && await hasSession(p), 'still on /account and logged in');
    await ctx.close(); }

  // company account
  { const ctx = await b.newContext(desk); await mock(ctx, { accountType: 'company' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/account'); await p.waitForTimeout(500);
    const main = await p.innerText('main');
    ok(main.includes('None (company account)'), 'company: no university');
    await p.click('.account-danger button:has-text("Delete my account")'); await p.waitForTimeout(200);
    ok((await p.innerText('.account-danger')).includes('Your company, its jobs and how to apply for them are deleted too.'), 'company: warned about company and jobs');
    await ctx.close(); }

  // no Supabase settings
  { const ctx = await b.newContext(desk); const p = await ctx.newPage();
    await p.goto(N + '/account'); await p.waitForTimeout(300);
    ok(/can't|configured|right now/i.test(await p.innerText('main')), 'no env: config message, no crash');
    await ctx.close(); }

  // phones: name link, menu link, no sideways scroll, feedback button never covers controls
  for (const [name, dev] of [['iPhone SE', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['iPhone 13', devices['iPhone 13']]]) {
    const ctx = await b.newContext(dev); await mock(ctx, { fullName: 'Alessandra Bianchi-Rossi' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs'); await p.waitForTimeout(400);
    ok(await p.locator('.site-header a.header-user').isVisible(), name + ': name visible in the header');
    await p.click('#menu-btn'); await frames(p);
    const m = p.locator('.menu-panel a.menu-user');
    ok((await m.innerText()) === 'Alessandra Bianchi-Rossi', name + ': name in the phone menu');
    await m.click(); await p.waitForTimeout(500);
    ok(new URL(p.url()).pathname === '/account' && await p.locator('.menu-panel').count() === 0, name + ': menu name opens /account and closes the menu');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), name + ': no sideways scroll');
    const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); let bad = 0;
    for (let y = 0; y <= max + 30; y += 23) { await p.evaluate((yy) => scrollTo(0, yy), y); await frames(p); const r = await p.evaluate(probe, SEL); if (r.shown && r.hits.length) { bad++; if (bad < 3) console.log('  overlap', y, r.hits); } }
    ok(bad === 0, name + ': feedback button never covers a control on /account');
    if (name === 'iPhone 13') { await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: OUT + '/phone-account.png', fullPage: true }); }
    await ctx.close();
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
})();
