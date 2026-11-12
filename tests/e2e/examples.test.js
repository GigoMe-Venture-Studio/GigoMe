// Example listings (supabase/seed/examples.sql): made-up companies and jobs
// for testers. Every card, map card and page says "Example listing, not a
// real job" (companies: "Example company, not a real employer"), their pages
// are never indexed and get no JobPosting data, Apply explains instead of
// asking the database or opening anything, and every list shows the real
// listings first (each group in its usual order).
const { chromium, devices } = require('./lib/browser.js');
const { mock, login, ID, JOBS, NEBBIA, EXAMPLE_CO, EXAMPLE_JOBS, ago } = require('./lib/mock.js');
const { stubMap } = require('./lib/stub.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const LABEL = 'Example listing, not a real job';
const EX = EXAMPLE_JOBS[0]; // on the map, area 1 (no real mock job there); published 1 day ago, newer than most real ones
const EX_TITLES = EXAMPLE_JOBS.map((j) => j.title);
const titlesIn = (p, sel) => p.$$eval(sel + ' .role-title', (e) => e.map((x) => x.textContent));
// Real titles, then example titles: true when no example comes before a real one.
const realThenExamples = (t) => { const first = t.findIndex((x) => EX_TITLES.includes(x)); return first > 0 && t.slice(first).every((x) => EX_TITLES.includes(x)); };
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
    ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await ctx.close(); }

  // ---- Real listings first, everywhere, each group in its usual order
  { const { ctx, p, log } = await ctxWith(b);
    await p.goto(E + '/jobs'); await p.waitForSelector('.job-list .role-row'); await p.waitForTimeout(300);
    let t = await titlesIn(p, '.jobs-list-col > .job-list');
    ok(t.join('|') === 'Weekend barista|Event host|English tutor|Finance assistant|Social media helper|Remote researcher|Evening waiter or waitress|Online homework helper',
      '/jobs: the 6 real jobs newest first, then the 2 examples newest first (the newer example is not second): ' + t.join('|'));
    ok(new URLSearchParams(log.jobs[log.jobs.length - 1]).get('order').startsWith('is_example.asc,'), 'asked of the database: is_example first');
    await p.goto(E + '/jobs?sort=pay'); await p.waitForTimeout(700);
    t = await titlesIn(p, '.jobs-list-col > .job-list');
    ok(t.join('|') === 'English tutor|Weekend barista|Remote researcher|Event host|Finance assistant|Social media helper|Online homework helper|Evening waiter or waitress',
      'Highest pay: real ones by pay, then the examples by pay (€12/h before €9.50/h): ' + t.join('|'));
    await ctx.close(); }
  { const { ctx, p } = await ctxWith(b, { jobs: [JOBS[0], JOBS[1]] });
    await p.goto(E + '/'); await p.waitForSelector('.job-list .role-row'); await p.waitForTimeout(300);
    const t = await titlesIn(p, '.job-list');
    ok(t.join('|') === 'Weekend barista|Finance assistant|Evening waiter or waitress|Online homework helper', 'home page: real ones first, then examples: ' + t.join('|'));
    ok(await p.locator('.job-card', { hasText: EX.title }).locator('.tag-example').count() === 1, 'home page: the example card has the badge too');
    await ctx.close(); }
  { const { ctx, p } = await ctxWith(b);
    await p.goto(E + '/'); await p.waitForSelector('.job-list .role-row'); await p.waitForTimeout(300);
    ok((await titlesIn(p, '.job-list')).every((x) => !EX_TITLES.includes(x)), 'home page with 5+ real jobs: the 5 newest real ones, no example');
    await ctx.close(); }
  // Sort by distance, standing on the example job: it still comes after every real job.
  { const ctx = await b.newContext({ ...desk, geolocation: { latitude: EX.latitude, longitude: EX.longitude }, permissions: ['geolocation'] });
    const log = await mock(ctx, { examples: true }); await stubMap(ctx, log); const p = await ctx.newPage();
    await p.goto(E + '/jobs?view=map'); await p.waitForSelector('.jobs-map[data-state=ready]', { timeout: 15000 }); await p.waitForTimeout(800);
    await p.click('button:has-text("Use my location")'); await p.waitForTimeout(1500);
    await p.check('.locate-sort input'); await p.waitForTimeout(300);
    await p.uncheck('.map-follow input'); await p.waitForTimeout(500);
    const t = await titlesIn(p, '.jobs-list-col > .job-list');
    ok(t[0] === 'English tutor' && t[1] === 'Weekend barista' && realThenExamples(t) && t.slice(-2).join('|') === 'Evening waiter or waitress|Online homework helper',
      'by distance: the nearest real job first, the example 0 m away only after every real one: ' + t.join('|'));
    await ctx.close(); }
  // Saved jobs (live and no longer available) and "New from companies you follow".
  { const goneEx = 'e0000000-0000-4000-8000-0000000000ff', closed = 'dead0000-0000-4000-8000-000000000099';
    const { ctx, p } = await ctxWith(b, { saved: [EX.id, ID(1), goneEx, closed],
      follows: [{ company_id: EXAMPLE_CO.id, created_at: ago(1) }, { company_id: NEBBIA.id, created_at: ago(2) }] });
    await p.goto(E + '/login?next=/saved'); await login(p); await p.waitForSelector('.saved-list .role-row'); await p.waitForTimeout(800);
    ok((await titlesIn(p, '.saved-list')).join('|') === 'Weekend barista|' + EX.title, 'saved: the real job before the example saved after it: ' + (await titlesIn(p, '.saved-list')).join('|'));
    const gone = await p.$$eval('.saved-gone-row .role-title', (e) => e.map((x) => x.textContent));
    ok(gone.join('|') === 'Closed cafe job|Stocktaking helper, one weekend', 'no longer available: real before example: ' + gone.join('|'));
    ok(await p.locator('.saved-gone-row', { hasText: 'Stocktaking helper' }).locator('.tag-example').count() === 1
      && await p.locator('.saved-gone-row', { hasText: 'Closed cafe job' }).locator('.tag-example').count() === 0, 'a saved example that is no longer live still has the badge');
    await p.waitForSelector('#following .job-list .role-row');
    const f = await titlesIn(p, '#following .job-list');
    ok(f.join('|') === 'Weekend barista|Event host|English tutor|' + EX.title, 'new from companies you follow: real ones newest first, then the example: ' + f.join('|'));
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
