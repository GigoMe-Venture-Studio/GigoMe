const { chromium, devices } = require('./lib/browser.js');
const { mock, login, ID } = require('./lib/mock.js');
const E = 'http://127.0.0.1:4402', N = 'http://127.0.0.1:4401';
const SHOTS = require('./lib/browser.js').OUT;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SEL = "main a:not(.role-row),main button,main input,main select,main textarea,.site-footer a,.site-footer button:not(.footer-link-btn),.menu-panel a,.menu-panel button,.maplibregl-ctrl-attrib";

// In the page: is the button shown, and does a shown button overlap anything it must keep clear of?
const probe = (sel) => {
  const b = document.querySelector('.feedback-fab');
  const shown = !b.hasAttribute('data-away');
  const r = b.getBoundingClientRect();
  const hits = [];
  for (const el of document.querySelectorAll(sel)) {
    const q = el.getBoundingClientRect();
    if (q.width && q.height && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) hits.push((el.textContent || el.name || el.tagName).trim().slice(0, 30));
  }
  return { shown, hits };
};
const frames = (p) => p.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));

async function sweep(p, label) {
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  let bad = 0, shownCount = 0, steps = 0;
  for (let y = 0; y <= max + 30; y += 23) {
    await p.evaluate((yy) => window.scrollTo(0, yy), y); await frames(p);
    let r = await p.evaluate(probe, SEL); steps++;
    // Content that appears while scrolling (a map loading its credits) gets
    // one re-check: the button must not *stay* over a control.
    if (r.shown && r.hits.length) { await p.waitForTimeout(150); r = await p.evaluate(probe, SEL); }
    if (r.shown) shownCount++;
    if (r.shown && r.hits.length) { bad++; if (bad < 3) console.log('  overlap', label, y, r.hits); }
  }
  ok(bad === 0, `${label}: button never covers a control (${bad} bad of ${steps})`);
  ok(shownCount > 0, `${label}: button is shown somewhere (${shownCount}/${steps})`);
  const end = await p.evaluate(probe, SEL);
  return end;
}

(async () => {
  const b = await chromium.launch();

  // ---- desktop, logged out
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const log = await mock(ctx); const p = await ctx.newPage();
    for (const path of ['/', '/jobs', `/jobs/${ID(1)}`, '/terms', '/login', '/privacy', '/nope']) {
      await p.goto(E + path); await p.waitForTimeout(300);
      ok(await p.locator('.feedback-fab').isVisible(), 'fab visible on ' + path);
      ok(await p.locator('.site-footer button:has-text("Give feedback")').count() === 1, 'footer Give feedback on ' + path);
      if (path === '/jobs') ok((await p.locator('.feedback-fab').innerText()).trim() === 'Feedback', 'desktop: the button shows the word "Feedback"');
    }
    await p.goto(E + '/terms'); await p.waitForTimeout(300);
    await p.click('.feedback-fab');
    const dlg = p.locator('dialog.feedback-dialog');
    ok(await dlg.evaluate((d) => d.open), 'dialog opens');
    ok((await dlg.innerText()).includes('Log in to send feedback, or write to hello@gigome.org.'), 'logged-out text');
    ok(await dlg.locator('textarea').count() === 0, 'no textarea logged out');
    ok(await dlg.locator('a:has-text("Log in")').getAttribute('href') === '/login?next=%2Fterms', 'login link has next');
    ok(await p.locator('.feedback-fab').getAttribute('data-away') === 'true', 'fab hidden while open');
    await p.screenshot({ path: SHOTS + '/desk-out.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    ok(!(await dlg.evaluate((d) => d.open)), 'Escape closes');
    ok(await p.evaluate(() => document.activeElement.classList.contains('feedback-fab')), 'focus back on fab');
    await p.click('.site-footer button:has-text("Give feedback")');
    ok(await dlg.evaluate((d) => d.open), 'footer opens dialog');
    await p.mouse.click(20, 20); await p.waitForTimeout(150);
    ok(!(await dlg.evaluate((d) => d.open)), 'backdrop click closes');
    await p.click('.feedback-fab'); await dlg.locator('a:has-text("Log in")').click(); await p.waitForTimeout(300);
    ok(p.url() === E + '/login?next=%2Fterms' && !(await dlg.evaluate((d) => d.open)), 'Log in link navigates and closes');
    ok(!log.feedback, 'nothing sent logged out');
    await ctx.close();
  }

  // ---- desktop, logged in
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p);
    await p.goto(E + '/'); await p.waitForTimeout(700);
    ok(await p.locator('.feedback-fab').isVisible() && await p.locator('.home-newest .save-btn').count() === 0, 'desktop logged in: home page, first load: the Feedback button is fully shown, no Save buttons on the cards');
    await p.goto(E + '/jobs?q=barista'); await p.waitForTimeout(500);
    // The button fades out while it would cover a control: scroll until it shows.
    for (let y = 0; y < 3000 && await p.$eval('.feedback-fab', (e) => e.hasAttribute('data-away')); y += 120) { await p.evaluate((yy) => scrollTo(0, yy), y); await p.waitForTimeout(80); }
    await p.click('.feedback-fab');
    const dlg = p.locator('dialog.feedback-dialog');
    const ta = dlg.locator('textarea#feedback-message');
    ok(await ta.isVisible(), 'textarea shown logged in');
    ok(await p.evaluate(() => document.activeElement.id === 'feedback-message'), 'textarea focused');
    ok((await dlg.locator('label[for=feedback-message]').innerText()) === "What worked, what didn't, what's missing?", 'label text');
    ok((await dlg.locator('#feedback-count').innerText()) === '0 / 2000', 'counter 0');
    ok(await dlg.locator('button[type=submit]').isDisabled(), 'Send disabled when empty');
    await ta.fill('   \n  '); ok(await dlg.locator('button[type=submit]').isDisabled(), 'Send disabled for whitespace');
    await ta.fill('x'.repeat(2100));
    ok((await ta.inputValue()).length === 2000 && (await dlg.locator('#feedback-count').innerText()) === '2000 / 2000', 'max 2000 + counter');
    await ta.fill('  Filters are great, but I miss a map.  ');
    ok((await dlg.locator('#feedback-count').innerText()) === '40 / 2000', 'counter counts');
    await p.screenshot({ path: SHOTS + '/desk-in.png' });
    // draft survives close
    await dlg.locator('button:has-text("Close")').click(); await p.click('.feedback-fab');
    ok((await ta.inputValue()) === '  Filters are great, but I miss a map.  ', 'draft kept after close');
    await dlg.locator('button[type=submit]').click(); await p.waitForTimeout(300);
    const sent = log.feedback && log.feedback[0];
    ok(sent && sent.method === 'POST', 'POST to feedback');
    ok(sent && JSON.stringify(sent.body) === JSON.stringify({ page: '/jobs?q=barista', message: 'Filters are great, but I miss a map.' }), 'body is page + trimmed message, no user_id: ' + JSON.stringify(sent && sent.body));
    ok(sent && !/return=representation/.test(sent.prefer) && !/select=/.test(sent.search), 'no read-back: ' + (sent && sent.prefer + sent.search));
    ok((await dlg.innerText()).includes('Thanks, we read every message.'), 'thanks shown');
    await p.screenshot({ path: SHOTS + '/desk-thanks.png' });
    await p.waitForTimeout(2700);
    ok(!(await dlg.evaluate((d) => d.open)), 'closes after thanks');
    await p.click('.feedback-fab');
    ok((await ta.inputValue()) === '', 'empty after sent');
    await dlg.locator('button:has-text("Close")').click();
    await ctx.close();
  }

  // ---- failure keeps the text
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const log = await mock(ctx, { feedbackFail: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/terms'); await p.waitForTimeout(300);
    await p.click('.feedback-fab'); const dlg = p.locator('dialog.feedback-dialog');
    await dlg.locator('textarea').fill('hello'); await dlg.locator('button[type=submit]').click(); await p.waitForTimeout(300);
    ok((await dlg.locator('.err').innerText()).includes("couldn't send"), 'error shown');
    ok((await dlg.locator('textarea').inputValue()) === 'hello' && await dlg.evaluate((d) => d.open), 'text kept, still open');
    await ctx.close();
  }

  // ---- no env build
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage();
    await p.goto(N + '/'); await p.waitForTimeout(300); await p.click('.feedback-fab');
    ok((await p.locator('dialog.feedback-dialog').innerText()).includes('Log in to send feedback'), 'no-env shows logged-out text');
    await ctx.close();
  }

  // ---- 375px phone: the home page at first load, logged in and out
  for (const logged of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }); await mock(ctx); const p = await ctx.newPage();
    if (logged) { await p.goto(E + '/login'); await login(p); }
    await p.goto(E + '/'); await p.waitForTimeout(700);
    ok(await p.locator('.feedback-fab').isVisible(), `375x667 ${logged ? 'logged in' : 'logged out'}: home page, first load: the Feedback button is fully shown`);
    await ctx.close();
  }

  // ---- phones: the button never covers a control while scrolling
  for (const [name, dev] of [['iPhone SE', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['iPhone 13', devices['iPhone 13']], ['Pixel 7', devices['Pixel 7']]]) {
    for (const logged of [false, true]) {
      const ctx = await b.newContext(dev); await mock(ctx); const p = await ctx.newPage();
      if (logged) { await p.goto(E + '/login'); await login(p); }
      {
        // Home page, first load: the button must be fully shown, logged in
        // or out (so no Save buttons on the home page's cards, for anyone).
        await p.goto(E + '/'); await p.waitForTimeout(700);
        ok(await p.locator('.feedback-fab').isVisible() && await p.locator('.home-newest .save-btn').count() === 0,
          `${name} ${logged ? 'logged in' : 'logged out'}: home page, first load: the Feedback button is fully shown, no Save buttons on the cards`);
      }
      if (!logged) {
        await p.goto(E + '/terms'); await p.waitForTimeout(400); // nothing there for it to step aside for
        const fab = await p.locator('.feedback-fab').boundingBox();
        const label = await p.locator('.feedback-fab-label').boundingBox();
        ok(Math.round(fab.width) === 44 && Math.round(fab.height) === 44 && label.width <= 1 && await p.getByRole('button', { name: 'Feedback', exact: true }).count() === 1,
          `${name}: the button is a 44px icon, still named "Feedback" for screen readers: ${Math.round(fab.width)}x${Math.round(fab.height)}`);
      }
      for (const path of ['/', '/jobs', `/jobs/${ID(1)}`, `/jobs/${ID(2)}`, '/terms', ...(logged ? [] : ['/login'])]) {
        await p.goto(E + path); await p.waitForTimeout(500);
        await sweep(p, `${name} ${logged ? 'in' : 'out'} ${path}`);
      }
      // key buttons at the moment they're on screen
      await p.goto(E + '/'); await p.waitForTimeout(400);
      const search = await p.locator('button:has-text("Search jobs")').boundingBox();
      ok(search, 'search button exists');
      await p.goto(E + `/jobs/${ID(1)}`); await p.waitForTimeout(500);
      const apply = p.locator('aside .btn-primary').first();
      await apply.scrollIntoViewIfNeeded(); await frames(p);
      const r = await p.evaluate(probe, SEL);
      ok(!(r.shown && r.hits.length), `${name} apply button not covered`);
      // menu open
      await p.goto(E + '/terms'); await p.waitForTimeout(300); await p.click('#menu-btn'); await frames(p);
      const m = await p.evaluate(probe, SEL); ok(!(m.shown && m.hits.length), `${name} menu not covered`);
      if (!logged && name === 'iPhone 13') {
        await p.goto(E + `/jobs/${ID(1)}`); await p.waitForTimeout(500); await p.screenshot({ path: SHOTS + '/phone-job-top.png' });
        await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await frames(p); await p.waitForTimeout(200);
        await p.screenshot({ path: SHOTS + '/phone-bottom.png' });
        await p.click('.site-footer button:has-text("Give feedback")'); await p.waitForTimeout(200);
        await p.screenshot({ path: SHOTS + '/phone-out.png' });
      }
      if (logged && name === 'iPhone 13') {
        await p.goto(E + '/jobs'); await p.waitForTimeout(500); await p.screenshot({ path: SHOTS + '/phone-jobs.png' });
        await p.evaluate(() => window.scrollTo(0, 0));
        const fab = p.locator('.feedback-fab');
        // find a scroll position where the fab is shown, then open it
        await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await frames(p); await p.waitForTimeout(200);
        await fab.click(); await p.waitForTimeout(200);
        await p.locator('textarea').fill('On my phone the filters take a lot of space.');
        await p.screenshot({ path: SHOTS + '/phone-in.png' });
        const box = await p.locator('dialog.feedback-dialog').boundingBox();
        ok(box.x === 0 && Math.round(box.width) === 390, 'phone sheet full width');
        ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'no sideways scroll');
      }
      await ctx.close();
    }
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
})();
