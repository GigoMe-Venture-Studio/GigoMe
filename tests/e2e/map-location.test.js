const { OUT } = require('./lib/browser.js');
const { chromium, devices } = require('./lib/browser.js');
const { mock, login, ID } = require('./lib/mock.js');
const { stubMap } = require('./lib/stub.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const card = (p, t) => p.locator('.job-list li', { hasText: t });
const CLOSED = 'dead0000-0000-4000-8000-000000000099';
(async () => {
  const b = await chromium.launch();
  // logged out
  { const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/jobs'); await p.waitForTimeout(600);
    ok(await p.locator('.save-btn').count() === 0 && !(await txt(p, '.site-header')).includes('Saved jobs'), 'logged out: no save buttons, no "Saved jobs" link');
    await p.goto(E + '/saved'); await p.waitForTimeout(500);
    ok(new URL(p.url()).pathname === '/login' && new URL(p.url()).searchParams.get('next') === '/saved', 'logged out /saved -> /login?next=/saved');
    await ctx.close(); }
  // student
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { saved: [CLOSED] }); await stubMap(ctx, log); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); const before = (log.savedReq || []).length; await p.goto(E + '/jobs'); await p.waitForTimeout(800);
    ok(await p.locator('.save-btn').count() === 6 && await card(p, 'Weekend barista').locator('.save-btn').getAttribute('aria-pressed') === 'false', 'student: a save button on every card');
    ok(await card(p, 'Weekend barista').locator('.save-btn').getAttribute('aria-label') === 'Save Weekend barista', 'save button has a clear label');
    ok(log.savedReq.slice(before).filter((x) => x.method === 'GET').length === 1, 'saved ids loaded once for the whole list of 6 cards');
    await card(p, 'Weekend barista').locator('.save-btn').click(); await p.waitForTimeout(500);
    ok(new URL(p.url()).pathname === '/jobs', 'saving does not open the job');
    const post = log.savedReq.find((x) => x.method === 'POST');
    ok(post && JSON.stringify(post.body) === JSON.stringify({ job_id: ID(1) }) && await card(p, 'Weekend barista').locator('.save-btn').getAttribute('aria-pressed') === 'true', 'saves just the job id; button shows saved');
    const pay = await card(p, 'Weekend barista').locator('.role-pay').boundingBox(), sb = await card(p, 'Weekend barista').locator('.save-btn').boundingBox();
    ok(sb.x >= pay.x + pay.width - 1 || sb.y >= pay.y + pay.height || sb.y + sb.height <= pay.y, 'desktop: the bookmark does not cover the pay');
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForTimeout(600);
    ok((await txt(p, '.detail-title-row .save-btn')) === 'Saved', 'job page: "Saved" after a reload');
    await p.click('.detail-title-row .save-btn'); await p.waitForTimeout(400);
    ok(log.savedReq.some((x) => x.method === 'DELETE' && x.search.includes('job_id=eq.' + ID(1))) && (await txt(p, '.detail-title-row .save-btn')) === 'Save', 'job page: press again to remove');
    await p.click('.detail-title-row .save-btn'); await p.waitForTimeout(400);
    await p.click('.main-nav a:has-text("Saved jobs")'); await p.waitForTimeout(900);
    ok(new URL(p.url()).pathname === '/saved' && await p.getAttribute('.main-nav a:has-text("Saved jobs")', 'aria-current') === 'page', 'header "Saved jobs" opens /saved');
    const sv = await txt(p, 'main');
    ok(sv.includes('Weekend barista') && await p.locator('.saved-list li').count() === 1, '/saved: the live saved job as a card');
    ok(sv.includes('No longer available') && sv.includes('Closed cafe job') && sv.includes('Old Cafe'), '/saved: a closed job shows as No longer available');
    await p.click('.saved-gone-row button:has-text("Remove")'); await p.waitForTimeout(500);
    ok(!(await txt(p, 'main')).includes('Closed cafe job') && log.savedReq.some((x) => x.method === 'DELETE' && x.search.includes(CLOSED)), 'removing a closed job');
    await p.click('.saved-list .save-btn'); await p.waitForTimeout(500);
    ok((await txt(p, 'main')).includes('No saved jobs yet.'), 'removing the last one: empty state');
    await ctx.close(); }
  // failure: change undone, message shown
  { const ctx = await b.newContext(desk); await mock(ctx, { saveFail: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs'); await p.waitForTimeout(800);
    await card(p, 'English tutor').locator('.save-btn').click(); await p.waitForTimeout(500);
    ok(await card(p, 'English tutor').locator('.save-btn').getAttribute('aria-pressed') === 'false' && (await txt(p, '.job-list')).includes("We couldn't save this job."), 'save fails: undone, with a message');
    await ctx.close(); }
  // company account
  { const ctx = await b.newContext(desk); await mock(ctx, { accountType: 'company' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs'); await p.waitForTimeout(800);
    ok(await p.locator('.save-btn').count() === 0 && !(await txt(p, '.site-header')).includes('Saved jobs'), 'company account: no save buttons, no Saved jobs link');
    await p.goto(E + '/saved'); await p.waitForTimeout(600);
    ok((await txt(p, 'main')).includes('Saving jobs is for student accounts.'), 'company on /saved: explained');
    await ctx.close(); }
  // phone
  { const ctx = await b.newContext(devices['iPhone 13']); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs'); await p.waitForTimeout(800);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone: no sideways scroll with bookmarks');
    const t = await card(p, 'Weekend barista').locator('.role-title').boundingBox(), sb = await card(p, 'Weekend barista').locator('.save-btn').boundingBox();
    ok(t.x + t.width <= sb.x + 1 || t.y >= sb.y + sb.height, 'phone: the bookmark does not cover the title');
    await p.click('#menu-btn'); await p.waitForTimeout(200);
    ok((await txt(p, '.menu-panel')).includes('Saved jobs'), 'phone menu: Saved jobs');
    await p.screenshot({ path: OUT + '/p3-phone.png' });
    await ctx.close(); }
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`);
})();
