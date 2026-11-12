// Example listings (supabase/seed/examples.sql): made-up companies and jobs
// for testers. Every card, map card and page says "Example listing, not a
// real job" (companies: "Example company, not a real employer"), their pages
// are never indexed and get no JobPosting data, and Apply explains instead
// of asking the database or opening anything.
const { chromium, devices } = require('./lib/browser.js');
const { mock, login, ID, EXAMPLE_CO, EXAMPLE_JOBS } = require('./lib/mock.js');
const { stubMap } = require('./lib/stub.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const LABEL = 'Example listing, not a real job';
const EX = EXAMPLE_JOBS[0]; // on the map, area 1 (no real mock job there)
async function ctxWith(b, mopts = {}, dev = desk) {
  const ctx = await b.newContext(dev); const log = await mock(ctx, { examples: true, ...mopts }); await stubMap(ctx, log);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  return { ctx, p, log, errs };
}
// The page's own JSON-LD (not the WebSite block every page has), robots and canonical.
const meta = (p) => p.evaluate(() => ({
  robots: (document.querySelector('meta[name=robots]') || {}).content || null,
  canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
  postings: [...document.querySelectorAll('script[type="application/ld+json"]')].filter((s) => /JobPosting/.test(s.textContent)).length
}));

(async () => {
  const b = await chromium.launch();

  // ---- Cards: /jobs and the home page
  { const { ctx, p, errs } = await ctxWith(b);
    await p.goto(E + '/jobs'); await p.waitForSelector('.job-list .role-row'); await p.waitForTimeout(300);
    const exCard = p.locator('.job-card', { hasText: EX.title });
    ok(await exCard.locator('.tag-example').count() === 1 && (await exCard.locator('.tag-example').innerText()) === LABEL, 'an example card has the badge: ' + LABEL);
    ok(await exCard.evaluate((li) => li.querySelector('.role-row > div').firstElementChild.classList.contains('role-example')), 'the badge comes first, before the title');
    ok(await p.locator('.job-card', { hasText: EXAMPLE_JOBS[1].title }).locator('.tag-example').count() === 1, 'every example card has it (remote one too)');
    ok(await p.locator('.job-card .tag-example').count() === 2 && await p.locator('.job-card').count() === 8, 'real jobs have no badge (2 of 8 cards)');
    const bg = await exCard.locator('.tag-example').evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).color]);
    ok(bg[0] === 'rgb(29, 27, 46)' && bg[1] === 'rgb(255, 255, 255)', 'the badge is graphite with white text: ' + bg.join(' / '));
    await p.goto(E + '/'); await p.waitForSelector('.job-list .role-row'); await p.waitForTimeout(300);
    ok(await p.locator('.job-card', { hasText: EX.title }).locator('.tag-example').count() === 1, 'home page: the example card has the badge too');
    ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await ctx.close(); }

  // ---- Job page, logged out: notice, noindex, no JobPosting
  { const { ctx, p, log } = await ctxWith(b);
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.facts'); await p.waitForTimeout(400);
    let m = await meta(p);
    ok(!m.robots && m.canonical && m.postings === 1, 'control: a real job page is indexable, with JobPosting data: ' + JSON.stringify(m));
    ok(await p.locator('.example-notice').count() === 0, 'control: no notice on a real job');
    await p.goto(E + '/jobs/' + EX.id); await p.waitForSelector('.facts'); await p.waitForTimeout(400);
    const notice = await txt(p, '.detail-head .example-notice');
    ok(notice.startsWith(LABEL) && notice.includes("Example Café Immaginario doesn't exist, and there's nobody to apply to."), 'example job page: notice at the top: ' + notice);
    m = await meta(p);
    ok(m.robots === 'noindex' && !m.canonical && m.postings === 0, 'example job page: noindex, no canonical, no JobPosting data: ' + JSON.stringify(m));
    ok(await p.locator('a:has-text("Log in to see how to apply")').count() === 1, 'logged out: the usual "Log in to see how to apply"');
    ok(log.rpc.length === 0, 'nothing asked of the database');
    await ctx.close(); }

  // ---- Job page, student: Apply explains, opens nothing, asks nothing
  { const { ctx, p, log, errs } = await ctxWith(b);
    await p.goto(E + '/login?next=' + encodeURIComponent('/jobs/' + EX.id)); await login(p); await p.waitForSelector('.facts');
    await p.waitForSelector('.detail aside button:has-text("Apply")');
    ok((await txt(p, '.detail aside')).includes('An example listing: Apply only shows what would happen.'), 'under Apply: it only shows what would happen');
    const pages = ctx.pages().length;
    await p.click('.detail aside button:has-text("Apply")'); await p.waitForTimeout(700);
    const box = await txt(p, '.detail aside');
    ok(box.includes('This is an example listing') && box.includes("there's nobody to apply to: nothing opened and nothing was sent or counted"), 'Apply explains it is an example: ' + box);
    ok(!/hello@gigome\.org/.test(box) && await p.locator('.detail aside a[href^="mailto:"]').count() === 0, 'no contact shown');
    ok(log.rpc.length === 0, 'reveal_job_contact never called (no apply click): ' + JSON.stringify(log.rpc));
    ok(ctx.pages().length === pages && new URL(p.url()).pathname === '/jobs/' + EX.id, 'no tab opened, no email app, still on the job');
    // A real job still works as before.
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.detail aside button:has-text("Apply")');
    ok((await txt(p, '.detail aside')).includes('Applications go straight to the employer.'), 'control: a real job keeps its note');
    await p.click('.detail aside button:has-text("Apply")'); await p.waitForTimeout(800);
    ok(log.rpc.length === 1 && log.rpc[0].p_job_id === ID(1), 'control: Apply on a real job asks the database');
    ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await ctx.close(); }

  // ---- Company page
  { const { ctx, p } = await ctxWith(b);
    await p.goto(E + '/companies/' + EXAMPLE_CO.id); await p.waitForSelector('.company-page'); await p.waitForTimeout(500);
    const notice = await txt(p, '.company-page .example-notice');
    ok(notice.startsWith('Example company, not a real employer') && notice.includes("it doesn't exist, and its jobs aren't real"), 'example company page: notice: ' + notice);
    const m = await meta(p);
    ok(m.robots === 'noindex' && !m.canonical, 'example company page: noindex: ' + JSON.stringify(m));
    ok(await p.locator('.job-card .tag-example').count() === 2, 'its job cards have the badge');
    await ctx.close(); }

  // ---- Map cards: desktop popup and phone card
  { const { ctx, p } = await ctxWith(b);
    await p.goto(E + '/jobs?view=map&area=1'); await p.waitForSelector('.job-marker', { timeout: 15000 }); await p.waitForTimeout(600);
    await p.click('.job-marker'); await p.waitForTimeout(500);
    const pop = await txt(p, '.maplibregl-popup');
    ok(pop.startsWith(LABEL) && pop.includes(EX.title), 'desktop: the map popup starts with the badge: ' + pop);
    await ctx.close(); }
  { const { ctx, p } = await ctxWith(b, {}, devices['iPhone 13']);
    await p.goto(E + '/jobs?view=map&area=1'); await p.waitForSelector('.job-marker', { timeout: 15000 }); await p.waitForTimeout(600);
    await p.click('.job-marker'); await p.waitForSelector('.map-sheet');
    const sheet = await txt(p, '.map-sheet');
    ok(sheet.includes(LABEL) && sheet.indexOf(LABEL) < sheet.indexOf(EX.title), 'phone: the map card starts with the badge: ' + sheet);
    await ctx.close(); }

  // ---- Small phone: the badge fits
  { const { ctx, p } = await ctxWith(b, {}, { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
    await p.goto(E + '/jobs'); await p.waitForSelector('.job-list .role-row'); await p.waitForTimeout(300);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), '320px: no sideways scroll on /jobs');
    await p.goto(E + '/companies/' + EXAMPLE_CO.id); await p.waitForSelector('.company-page .example-notice'); await p.waitForTimeout(300);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), '320px: no sideways scroll on an example company page');
    await ctx.close(); }

  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
