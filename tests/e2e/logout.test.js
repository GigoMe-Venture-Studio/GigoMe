// "Log out?" before logging out (LogOutButton.jsx), the phone menu's Log out
// set apart at the bottom, and the Junk folder line on the code step.
const { chromium } = require('./lib/browser.js');
const { mock, login } = require('./lib/mock.js');
const { emock } = require('./lib/emock.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const desk = { viewport: { width: 1280, height: 900 } };
const phoneAt = (width) => ({ viewport: { width, height: 640 }, isMobile: true, hasTouch: true });
const JUNK = "Can't find it? Check your Junk or Spam folder and mark it as 'Not junk', so the next one arrives in your inbox.";
const DIALOG = 'dialog.logout-dialog[open]';
const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
// vertical: also inside the screen's height (the dialog must be fully on screen).
const cutOff = (p, sel, vertical = false) => p.$$eval(sel, (els, v) => els.filter((e) => e.offsetParent !== null || e.tagName === 'DIALOG').filter((e) => {
  const r = e.getBoundingClientRect(); return e.scrollWidth > e.clientWidth + 1 || r.left < -0.5 || r.right > innerWidth + 0.5 || (v && (r.top < -0.5 || r.bottom > innerHeight + 0.5));
}).map((e) => e.tagName + ' ' + e.textContent.trim().slice(0, 30)), vertical);

(async () => {
  const b = await chromium.launch();

  // ---- Desktop header: asks first; Cancel and Escape keep you logged in
  { const ctx = await b.newContext(desk); const log = await mock(ctx); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs'); await p.waitForSelector('.header-user');
    await p.click('.site-header .header-actions > button.signin'); await p.waitForTimeout(200);
    ok(await p.locator(DIALOG).count() === 1, 'Log out opens the confirmation');
    ok((await txt(p, DIALOG + ' .logout-title')) === 'Log out?' && (await txt(p, DIALOG + ' .logout-text')) === "To log back in, you'll need your password or a new code from your email.", 'the wording');
    ok(JSON.stringify(await p.$$eval(DIALOG + ' button', (bs) => bs.map((x) => x.textContent))) === '["Log out","Cancel"]', 'two buttons: Log out and Cancel');
    ok(await p.evaluate(() => document.activeElement && document.activeElement.textContent === 'Cancel'), 'Cancel has the focus');
    ok(await p.$eval(DIALOG, (d) => d.getAttribute('aria-labelledby') && document.getElementById(d.getAttribute('aria-labelledby')).textContent === 'Log out?'), 'the dialog is named "Log out?"');
    await p.keyboard.press('Enter'); await p.waitForTimeout(200);
    ok(await p.locator(DIALOG).count() === 0 && !log.logout && await p.locator('.header-user').count() === 1, 'Enter on the focused Cancel: still logged in, nothing sent');
    await p.click('.site-header .header-actions > button.signin'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok(await p.locator(DIALOG).count() === 0 && !log.logout, 'Escape closes it, still logged in');
    await p.click('.site-header .header-actions > button.signin'); await p.click(DIALOG + ' button:has-text("Cancel")'); await p.waitForTimeout(200);
    ok(!log.logout && await p.locator('.header-user').count() === 1, 'Cancel: still logged in');
    await p.click('.site-header .header-actions > button.signin'); await p.click(DIALOG + ' button:has-text("Log out")'); await p.waitForTimeout(500);
    ok(log.logout === 1 && await p.locator('.header-user').count() === 0 && (await txt(p, '.site-header')).includes('Student login'), 'confirmed: logged out');
    ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await ctx.close(); }

  // ---- "You're logged in" (/login) and /employers ask too
  { const ctx = await b.newContext(desk); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/login'); await p.waitForSelector('h1:has-text("You\'re logged in")');
    await p.click('main button:has-text("Log out")'); await p.waitForTimeout(200);
    ok(await p.locator(DIALOG).count() === 1 && !log.logout, '/login "You\'re logged in": asks first');
    await p.click(DIALOG + ' button:has-text("Log out")'); await p.waitForTimeout(500);
    ok(log.logout === 1, 'then logs out');
    await ctx.close(); }

  // ---- Phones: Log out last in the menu, set apart; the dialog fits
  for (const width of [320, 375]) {
    const ctx = await b.newContext(phoneAt(width)); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs'); await p.waitForTimeout(500);
    ok(await p.locator('.site-header .header-actions > button.signin').isHidden(), `${width}px: no Log out in the header bar`);
    await p.click('#menu-btn');
    const items = await p.$$eval('#menu-panel > a, #menu-panel > button', (els) => els.map((e) => e.textContent.trim()));
    ok(items[items.length - 1] === 'Log out', `${width}px: Log out is last in the menu: ${items.join(', ')}`);
    const gap = await p.evaluate(() => { const u = document.querySelector('#menu-panel .menu-user').getBoundingClientRect(); const l = document.querySelector('#menu-panel .menu-logout'); return { gap: l.getBoundingClientRect().top - u.bottom, line: getComputedStyle(l).borderTopWidth }; });
    ok(gap.gap >= 12 && gap.line === '1px', `${width}px: set apart from the account link above it (${gap.gap}px, line ${gap.line})`);
    await p.click('#menu-panel .menu-logout'); await p.waitForTimeout(200);
    ok(await p.locator(DIALOG).count() === 1 && !log.logout, `${width}px: menu Log out asks first`);
    const cut = await cutOff(p, DIALOG + ', ' + DIALOG + ' *', true);
    ok(cut.length === 0 && !(await sideways(p)), `${width}px: the dialog fits, nothing cut off: ${cut.join(', ')}`);
    ok(await p.$$eval(DIALOG + ' button', (bs) => bs.every((x) => x.getBoundingClientRect().height >= 44)), `${width}px: dialog buttons at least 44px tall`);
    await p.click(DIALOG + ' button:has-text("Cancel")'); await p.waitForTimeout(200);
    ok(!log.logout && await p.locator('#menu-panel').count() === 1, `${width}px: Cancel keeps you logged in, the menu stays open`);
    await p.click('#menu-panel .menu-logout'); await p.click(DIALOG + ' button:has-text("Log out")'); await p.waitForTimeout(500);
    ok(log.logout === 1 && await p.locator('#menu-panel').count() === 0, `${width}px: confirmed: logged out, menu closed`);
    await ctx.close();
  }

  // ---- The code step: the Junk folder line, students and employers, phones
  for (const width of [320, 375]) {
    for (const [path, email, mk] of [['/login', 'ana@studbocconi.it', mock], ['/employers', 'owner@cafe.it', emock]]) {
      const ctx = await b.newContext(phoneAt(width)); await mk(ctx); const p = await ctx.newPage();
      await p.goto(E + path); await p.fill('input[name=email]', email); await p.click('text=Email me a code instead'); await p.waitForSelector('#code-hint');
      ok((await txt(p, '#code-hint')).includes(JUNK), `${width}px ${path}: the Junk folder line`);
      const cut = await cutOff(p, '#code-hint');
      ok(cut.length === 0 && !(await sideways(p)), `${width}px ${path}: not cut off, no sideways scroll`);
      await ctx.close();
    }
  }

  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
