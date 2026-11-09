const { OUT } = require('./lib/browser.js');
const { chromium, devices } = require('./lib/browser.js');
const { mock } = require('./lib/mock.js');
const { amock, login } = require('./lib/amock.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SEL = "main a:not(.role-row),main button,main input,main select,main textarea,.site-footer a,.site-footer button:not(.footer-link-btn),.menu-panel a,.menu-panel button,.maplibregl-ctrl-attrib";
const probe = (sel) => { const b = document.querySelector('.feedback-fab'); const r = b.getBoundingClientRect(); const shown = !b.hasAttribute('data-away'); const hits = [];
  for (const el of document.querySelectorAll(sel)) { const q = el.getBoundingClientRect(); if (q.width && q.height && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) hits.push((el.textContent || el.name || '').trim().slice(0, 20)); }
  return { shown, hits }; };
const shownSelects = (p) => p.$$eval('.job-filters select', (els) => els.filter((e) => e.offsetParent !== null).map((e) => e.name));

(async () => {
  const b = await chromium.launch();

  // ---- phones: filters folded, first job visible without scrolling
  const PHONES = [['iPhone SE', devices['iPhone SE']], ['iPhone 13', devices['iPhone 13']], ['Pixel 5', devices['Pixel 5']],
    ['320x568', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true }], ['360x640', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }]];
  for (const [name, dev] of PHONES) {
    const ctx = await b.newContext({ ...dev, deviceScaleFactor: 1 }); await mock(ctx, {}); const p = await ctx.newPage();
    await p.goto(E + '/jobs'); await p.waitForSelector('.job-list .role-row'); await p.waitForTimeout(300);
    const t = await p.locator('.job-filters-toggle');
    ok(await t.isVisible(), name + ': Filters button shown');
    ok((await t.innerText()).trim() === 'Filters', name + ': no count without filters: ' + await t.innerText());
    ok(await t.getAttribute('aria-expanded') === 'false', name + ': collapsed');
    ok((await shownSelects(p)).length === 0, name + ': selects hidden');
    ok(await p.locator('input[name=q]').isVisible(), name + ': keyword stays visible');
    const first = await p.$eval('.job-list .role-row', (e) => { const r = e.getBoundingClientRect(); const last = [...e.querySelectorAll('*')].reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), 0); return { top: r.top, bottom: r.bottom, last, vh: innerHeight }; });
    ok(first.last <= first.vh, `${name}: first job's whole text visible without scrolling (last line ends ${Math.round(first.last)}, card ${Math.round(first.top)}-${Math.round(first.bottom)}, screen ${first.vh})`);
    console.log(`${name}: card ${Math.round(first.top)}-${Math.round(first.bottom)} of ${first.vh}`);
    const kw = await p.$eval('input[name=q]', (e) => e.getBoundingClientRect()), bt = await p.$eval('.job-filters-toggle', (e) => e.getBoundingClientRect());
    ok(Math.abs(kw.bottom - bt.bottom) < 1 && bt.left > kw.right, name + ': button sits beside the keyword, bottoms aligned');
    ok(await p.$eval('body', (e) => e.scrollWidth <= innerWidth), name + ': no sideways scroll');
    if (name === 'iPhone SE') await p.screenshot({ path: OUT + '/se-closed.png' });
    await t.click();
    ok(await t.getAttribute('aria-expanded') === 'true', name + ': expanded after tap');
    ok((await shownSelects(p)).join() === 'area,category,type,italian,remote,hours', name + ': all six selects shown: ' + (await shownSelects(p)).join());
    await p.selectOption('select[name=italian]', 'none'); await p.waitForTimeout(400);
    await p.selectOption('select[name=type]', 'part_time'); await p.waitForTimeout(400);
    ok(await t.getAttribute('aria-expanded') === 'true', name + ': stays open while choosing');
    ok((await p.innerText('.job-filters-toggle .filter-count')) === '2', name + ': count 2');
    ok((await p.innerText('.job-filters-toggle .sr-only')).trim() === ', 2 active', name + ': screen readers hear "2 active"');
    ok(p.url().includes('italian=none') && p.url().includes('type=part_time'), name + ': filters in URL');
    if (name === 'iPhone SE') await p.screenshot({ path: OUT + '/se-open.png' });
    await t.click();
    ok((await shownSelects(p)).length === 0 && (await p.innerText('.job-filters-toggle .filter-count')) === '2', name + ': folds again, count kept');
    await p.fill('input[name=q]', 'barista'); await p.waitForTimeout(600);
    ok((await p.innerText('.job-filters-toggle .filter-count')) === '2', name + ': keyword not counted (it is visible)');
    await p.click('button:has-text("Clear filters")'); await p.waitForTimeout(400);
    ok((await t.innerText()).trim() === 'Filters', name + ': count gone after Clear filters');
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
    const pr = await p.evaluate(probe, SEL);
    ok(!pr.shown || pr.hits.length === 0, name + ': Feedback button covers nothing: ' + JSON.stringify(pr));
    await ctx.close();
  }

  // ---- arriving with filters (e.g. from the home page search): count shown, still folded
  { const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); await mock(ctx, {}); const p = await ctx.newPage();
    await p.goto(E + '/jobs?q=barista&italian=none&area=3&hours=20&view=map'); await p.waitForTimeout(800);
    ok((await p.innerText('.job-filters-toggle .filter-count')) === '3', 'from a link: 3 active (area, italian, hours)');
    ok(await p.getAttribute('.job-filters-toggle', 'aria-expanded') === 'false', 'from a link: still folded');
    ok(await p.locator('.view-toggle button[aria-pressed=true]').innerText() === 'Map', 'map view kept');
    await ctx.close(); }

  // ---- 768 and up: everything shown, no button; desktop identical to before
  for (const w of [768, 1024, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); await mock(ctx, {}); const p = await ctx.newPage();
    await p.goto(E + '/jobs?italian=none'); await p.waitForTimeout(800);
    ok(!(await p.locator('.job-filters-toggle').isVisible()), w + ': no Filters button');
    ok((await shownSelects(p)).length === 6, w + ': all six selects shown');
    await ctx.close();
  }
  // ---- admin: Feedback section
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const { log } = await amock(ctx, { admin: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/admin'); await p.waitForSelector('#admin-feedback');
    const q = new URLSearchParams(log.feedbackReads[0]);
    ok(q.get('select') === 'id,page,message,created_at', 'asks only for id, page, message, time: ' + q.get('select'));
    ok(q.get('order') === 'created_at.desc' && q.get('limit') === '50', 'newest 50: ' + log.feedbackReads[0]);
    const items = await p.$$eval('.admin-feedback li', (els) => els.map((e) => e.innerText));
    ok(items.length === 3, '3 messages');
    ok(items[0].includes('/jobs?area=3&view=map') && items[0].includes('The map is great.\nBut the pins overlap.'), 'page and message with its line break: ' + JSON.stringify(items[0]));
    ok(/\d{1,2} \w{3} \d{4}, \d\d:\d\d/.test(items[0]), 'time shown: ' + items[0]);
    ok(items[1].includes('<b>bold?</b>'), 'HTML in a message shown as text');
    ok(await p.locator('#admin-feedback a').count() === 0, 'no links in the feedback section (page is text)');
    ok(!items[2].includes(' · on'), 'no page: no "on"');
    ok(!(await p.innerText('#admin-feedback')).match(/@|Ana Rossi|Marco/), 'no sender shown');
    ok(await p.locator('.admin-summary a[href="#admin-feedback"]').count() === 1, 'summary links to the feedback');
    const order = await p.$$eval('.admin-section h2', (els) => els.map((e) => e.textContent));
    ok(order.join('|') === 'Companies waiting for review|Jobs waiting for review|Open reports|Live jobs missing an area, a schedule or structured pay|Feedback|Recent decisions', 'section order: ' + order.join('|'));
    await p.locator('#admin-feedback').screenshot({ path: OUT + '/admin-feedback.png' });
    await ctx.close(); }
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await amock(ctx, { admin: true, feedbackReadFail: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/admin'); await p.waitForTimeout(1200);
    ok((await p.innerText('#admin-feedback')).includes("We couldn't load the feedback."), 'feedback error shown');
    ok(await p.locator('#admin-companies .admin-item').count() === 2, 'moderation queue still shown when feedback fails');
    await ctx.close(); }
  { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await amock(ctx, { admin: true, feedbackRows: [] }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/admin'); await p.waitForTimeout(1200);
    ok((await p.innerText('#admin-feedback')).includes('None yet.'), 'empty: None yet.');
    await ctx.close(); }
  { const ctx = await b.newContext({ ...devices['iPhone SE'], deviceScaleFactor: 1 }); await amock(ctx, { admin: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/admin'); await p.waitForSelector('#admin-feedback');
    ok(await p.$eval('body', (e) => e.scrollWidth <= innerWidth), 'admin on a phone: no sideways scroll');
    await ctx.close(); }

  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
