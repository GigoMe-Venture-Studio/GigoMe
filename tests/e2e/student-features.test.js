const { chromium, devices } = require('./lib/browser.js');
const { mock, login, ID, NEBBIA, FINTRA, ago } = require('./lib/mock.js');
const { emock, employerLogin } = require('./lib/emock.js');
const { stubMap } = require('./lib/stub.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const titles = (p) => p.$$eval('.jobs-list-col > .job-list .role-title', (e) => e.map((x) => x.textContent));
const qp = (p) => new URL(p.url()).searchParams;
async function ctxWith(b, opts = {}, mopts = {}, dev = desk) {
  const ctx = await b.newContext({ ...dev, ...opts }); const log = await mock(ctx, mopts); await stubMap(ctx, log);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  return { ctx, p, log, errs };
}

(async () => {
  const b = await chromium.launch();

  // ---- 1-2. Schedule and languages: cards, job page, filters
  { const { ctx, p, log, errs } = await ctxWith(b);
    await p.goto(E + '/jobs'); await p.waitForSelector('.job-list .role-row'); await p.waitForTimeout(300);
    const card = await txt(p, '.job-list li:first-child');
    ok(card.includes('Weekends'), 'card shows the schedule tag');
    ok(await p.locator('.job-card', { hasText: 'Social media helper' }).locator('.tag-when').count() === 0, 'a job without a schedule shows no When tag');
    ok(await p.locator('.chip-filter legend', { hasText: 'When' }).count() === 1 && await p.locator('.chip-filter legend', { hasText: 'Languages at work' }).count() === 1, 'When and Languages filters');
    await p.click('.chip:has-text("Weekends")'); await p.waitForTimeout(500);
    ok(qp(p).get('when') === 'weekends', 'when=weekends in the URL');
    ok(log.jobs.pop().includes('schedule=ov.%7Bweekends%2Cflexible%7D'), 'asks for weekends or flexible');
    ok((await titles(p)).sort().join('|') === 'English tutor|Remote researcher|Weekend barista', 'weekends + flexible jobs: ' + (await titles(p)).join('|'));
    await p.click('.chip:has-text("Weekday evenings")'); await p.waitForTimeout(500);
    ok(qp(p).get('when') === 'weekday_evenings,weekends', 'two times, in list order: ' + qp(p).get('when'));
    ok((await titles(p)).length === 4, 'evenings or weekends or flexible: 4');
    ok(await p.getAttribute('.chip:has-text("Weekends")', 'aria-pressed') === 'true', 'chip shows it is on');
    await p.click('.chip:has-text("Weekends")'); await p.click('.chip:has-text("Weekday evenings")'); await p.waitForTimeout(400);
    await p.click('.chip:has-text("Spanish")'); await p.waitForTimeout(500);
    ok(qp(p).get('lang') === 'es' && (await titles(p)).join('|') === 'Remote researcher', 'Languages: Spanish: ' + (await titles(p)).join('|'));
    await p.goto(E + '/jobs?when=brunch,weekends&lang=klingon'); await p.waitForTimeout(700);
    ok(await p.getAttribute('.chip:has-text("Weekends")', 'aria-pressed') === 'true' && await p.locator('.chip[aria-pressed=true]').count() === 1, 'unknown values in a link are ignored');
    await p.goto(E + '/jobs?when=weekends&view=map'); await p.waitForSelector('.jobs-map[data-state=ready]'); await p.waitForTimeout(800);
    ok(await p.getAttribute('.jobs-map', 'data-points') === '2', 'map follows the When filter (2 on-site jobs with a place)');
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.detail');
    const d = await txt(p, '.detail');
    ok(d.includes('Weekends') && d.includes('Languages at work') && d.includes('English, Italian'), 'job page: When tag and languages');
    await p.goto(E + '/jobs/' + ID(3)); await p.waitForSelector('.detail');
    ok(!(await txt(p, '.detail')).includes('Languages at work') && (await txt(p, '.detail')).includes('Weekday evenings'), 'no languages: no row');
    ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await ctx.close(); }
  { const { ctx, p } = await ctxWith(b, devices['iPhone 13'], {}, {});
    await p.goto(E + '/jobs?when=weekends&lang=en'); await p.waitForSelector('.job-list'); await p.waitForTimeout(400);
    ok((await txt(p, '.job-filters-toggle .filter-count')) === '2', 'phone: Filters counts When and Languages');
    ok(!(await p.locator('.chip-filter').first().isVisible()), 'phone: chips folded away');
    await p.click('.job-filters-toggle'); ok(await p.locator('.chip-filter').first().isVisible(), 'phone: chips in the panel');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone: no sideways scroll');
    await ctx.close(); }

  // ---- 3. Saved searches
  { const { ctx, p, log } = await ctxWith(b);
    await p.goto(E + '/jobs?q=barista&when=weekends'); await p.waitForTimeout(600);
    ok(await p.locator('button:has-text("Save this search")').count() === 0, 'logged out: no Save this search');
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs'); await p.waitForTimeout(700);
    ok(await p.locator('button:has-text("Save this search")').count() === 0, 'student, no filters: nothing to save');
    await p.goto(E + '/jobs?q=barista&when=weekends&view=map&map=13.0/45.4700/9.1900'); await p.waitForTimeout(800);
    await p.click('button:has-text("Save this search")');
    ok((await p.inputValue('input[name=search_name]')) === '“barista” · Weekends', 'suggested name: ' + await p.inputValue('input[name=search_name]'));
    ok((await txt(p, '.save-search')).includes('Shown only to you') && (await txt(p, '.save-search')).includes('No emails'), 'says it is private, no emails');
    await p.fill('input[name=search_name]', 'Weekend barista jobs'); await p.click('.save-search button[type=submit]'); await p.waitForTimeout(500);
    const post = log.searchReq.find((x) => x.method === 'POST');
    ok(post && JSON.stringify(post.body) === JSON.stringify({ name: 'Weekend barista jobs', params: 'q=barista&when=weekends' }), 'saves name and filters only (no map or view): ' + JSON.stringify(post && post.body));
    ok((await txt(p, '.save-search-done')).includes('Search saved') && await p.locator('.save-search-done a[href="/saved#saved-searches"]').count() === 1, 'confirmation with a link');
    await ctx.close(); }
  { const { ctx, p } = await ctxWith(b, {}, { searchFail: 'You can save up to 20 searches. Delete one to save another.' });
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs?q=tutor'); await p.waitForTimeout(700);
    await p.click('button:has-text("Save this search")'); await p.click('.save-search button[type=submit]'); await p.waitForTimeout(500);
    ok((await txt(p, '.save-search')).includes('You can save up to 20 searches'), 'limit explained');
    await ctx.close(); }
  { const { ctx, p } = await ctxWith(b, {}, { accountType: 'company' });
    await p.goto(E + '/employers'); await login(p, 'owner@cafe.it'); await p.goto(E + '/jobs?q=tutor'); await p.waitForTimeout(700);
    ok(await p.locator('button:has-text("Save this search")').count() === 0, 'company accounts: no Save this search');
    await ctx.close(); }
  { const searches = [{ id: 's1', name: 'Barista weekends', params: 'q=barista&when=weekends', created_at: ago(3), last_seen_at: ago(2) },
                      { id: 's2', name: 'Old tutor search', params: 'q=tutor', created_at: ago(9), last_seen_at: ago(0.1) }];
    const { ctx, p, log } = await ctxWith(b, {}, { searches });
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/saved'); await p.waitForSelector('#saved-searches .saved-row'); await p.waitForTimeout(600);
    const rows = await p.$$eval('#saved-searches .saved-row', (e) => e.map((x) => x.innerText));
    ok(rows[0].includes('Barista weekends') && rows[0].includes('“barista” · Weekends') && rows[0].includes('1 new since your last visit'), 'saved search: name, filters, 1 new: ' + JSON.stringify(rows[0]));
    ok(rows[1].includes('Nothing new since your last visit'), 'nothing new for the other');
    ok((await txt(p, 'main')).includes('Only you can see this page. Nothing here is emailed.'), '/saved says it is private');
    await p.click('#saved-searches a:has-text("Barista weekends")'); await p.waitForTimeout(700);
    ok(new URL(p.url()).pathname === '/jobs' && qp(p).get('q') === 'barista' && qp(p).get('when') === 'weekends', 'the link opens the search');
    const patch = log.searchReq.find((x) => x.method === 'PATCH');
    ok(patch && patch.search === '?id=eq.s1' && Object.keys(patch.body).join() === 'last_seen_at', 'opening it marks it seen (the database sets the time)');
    await p.goto(E + '/saved'); await p.waitForSelector('#saved-searches .saved-row');
    await p.click('button[aria-label="Delete the saved search Old tutor search"]'); await p.waitForTimeout(600);
    ok(log.searchReq.some((x) => x.method === 'DELETE' && x.search === '?id=eq.s2') && !(await txt(p, '#saved-searches')).includes('Old tutor search'), 'delete');
    await ctx.close(); }

  // ---- 4. Follow a company
  { const { ctx, p, log } = await ctxWith(b);
    await p.goto(E + '/companies/' + NEBBIA.id); await p.waitForSelector('.company-page');
    ok((await p.getAttribute('a.follow-btn', 'href')) === '/login?next=' + encodeURIComponent('/companies/' + NEBBIA.id), 'logged out: Log in to follow');
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/companies/' + NEBBIA.id); await p.waitForSelector('button.follow-btn');
    ok(await p.getAttribute('button.follow-btn', 'aria-pressed') === 'false' && (await txt(p, 'button.follow-btn')) === 'Follow', 'Follow button');
    ok((await txt(p, '.follow-note')).includes('No emails'), 'says no emails');
    await p.click('button.follow-btn'); await p.waitForTimeout(400);
    ok(JSON.stringify(log.followReq.find((x) => x.method === 'POST').body) === JSON.stringify({ company_id: NEBBIA.id }), 'follow sends only the company');
    ok((await txt(p, 'button.follow-btn')) === 'Following' && await p.getAttribute('button.follow-btn', 'aria-pressed') === 'true', 'Following');
    await p.reload(); await p.waitForSelector('button.follow-btn'); await p.waitForTimeout(300);
    ok((await txt(p, 'button.follow-btn')) === 'Following', 'still following after reload');
    await p.goto(E + '/saved'); await p.waitForSelector('#following .saved-row'); await p.waitForTimeout(500);
    const f = await txt(p, '#following');
    ok(f.includes('Weekend barista') && f.includes('Event host') && f.includes('English tutor') && !f.includes('Finance intern'), 'New from companies you follow: Nebbia\'s recent jobs only');
    ok(log.jobs.some((s) => s.includes('company_id=in.%28' + NEBBIA.id)), 'asks for the followed companies\' jobs');
    await p.click('button[aria-label="Unfollow Nebbia Coffee Bar"]'); await p.waitForTimeout(600);
    ok(log.followReq.some((x) => x.method === 'DELETE') && (await txt(p, '#following')).includes("You don't follow any companies yet"), 'unfollow from /saved');
    await ctx.close(); }
  { const { ctx, p } = await ctxWith(b, {}, { accountType: 'company' });
    await p.goto(E + '/employers'); await login(p, 'owner@cafe.it'); await p.goto(E + '/companies/' + NEBBIA.id); await p.waitForSelector('.company-page'); await p.waitForTimeout(600);
    ok(await p.locator('.follow-btn').count() === 0, 'company accounts: no Follow');
    await ctx.close(); }

  // ---- 5. Jobs you opened
  { const opened = [{ job_id: ID(1), last_opened_at: '2026-11-01T10:00:00Z', title: 'Weekend barista', company_name: 'Nebbia Coffee Bar', live: true },
                    { job_id: 'gone', last_opened_at: '2026-10-20T10:00:00Z', title: 'Old cafe job', company_name: 'Old Cafe', live: false }];
    const { ctx, p } = await ctxWith(b, {}, { opened });
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/saved'); await p.waitForSelector('#opened .saved-row');
    const t = await txt(p, '#opened');
    ok(t.includes('You opened the application on 1 November 2026') && t.includes('You opened the application on 20 October 2026'), 'exact label with the date');
    ok(!/\bapplied\b|\bapplication sent\b/i.test(t), 'never says applied');
    ok(await p.locator('#opened a[href="/jobs/' + ID(1) + '"]').count() === 1 && t.includes('Old Cafe · No longer available') && await p.locator('#opened a:has-text("Old cafe job")').count() === 0, 'live job linked, closed one not');
    await ctx.close(); }

  // ---- 7. Share
  { const { ctx, p } = await ctxWith(b, { permissions: ['clipboard-read', 'clipboard-write'] });
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.share-btn');
    ok((await txt(p, '.share-btn')) === 'Copy link', 'desktop: Copy link');
    await p.click('.share-btn'); await p.waitForTimeout(300);
    ok((await p.evaluate(() => navigator.clipboard.readText())) === E + '/jobs/' + ID(1), 'the job\'s address is copied');
    ok((await txt(p, '.share-btn')) === 'Link copied' && (await txt(p, '.share-status')) === 'Link copied to the clipboard.', 'confirmation (also for screen readers)');
    await p.waitForTimeout(3200); ok((await txt(p, '.share-btn')) === 'Copy link', 'back to Copy link');
    await ctx.close(); }
  { const { ctx, p } = await ctxWith(b, {});
    await p.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('no')) } }); });
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.share-btn'); await p.click('.share-btn'); await p.waitForTimeout(300);
    ok((await p.inputValue('.share-field')) === E + '/jobs/' + ID(1), 'no clipboard: the link is shown to copy by hand');
    await ctx.close(); }
  { const { ctx, p } = await ctxWith(b, devices['iPhone 13'], {}, {});
    await p.addInitScript(() => { window.__shared = []; navigator.share = (d) => { window.__shared.push(d); return Promise.resolve(); }; });
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.share-btn');
    ok((await txt(p, '.share-btn')) === 'Share', 'phone: Share');
    await p.tap('.share-btn'); await p.waitForTimeout(300);
    const shared = await p.evaluate(() => window.__shared);
    ok(shared.length === 1 && shared[0].url === E + '/jobs/' + ID(1) && shared[0].title === 'Weekend barista | GigoMe', 'phone: the share sheet gets the title and link: ' + JSON.stringify(shared));
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone: no sideways scroll');
    await ctx.close(); }

  // ---- 6. Employer preview; follower count
  { const ctx = await b.newContext(desk); const { log } = await emock(ctx, { company: { name: 'Nebbia', status: 'approved', website: 'nebbia.it', description: 'Coffee.' } }); await stubMap(ctx, {});
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await employerLogin(p, E);
    ok((await txt(p, 'main')).includes('3 students follow your company') && (await txt(p, 'main')).includes('You see how many, never who.'), 'dashboard: follower count, never who');
    await p.click('a.btn:has-text("New job")'); await p.waitForTimeout(500);
    await p.fill('input[name=title]', 'Weekend barista'); await p.selectOption('select[name=job_type]', 'part_time'); await p.selectOption('select[name=category]', 'hospitality');
    await p.fill('textarea[name=description]', 'Serve coffee.'); await p.fill('input[name=hours_per_week]', '12'); await p.fill('input[name=pay]', '€11 an hour');
    await p.check('input[name=schedule][value=weekends]'); await p.check('input[name=languages][value=en]'); await p.check('input[name=languages][value=it]');
    await p.selectOption('select[name=area_id]', '3'); await p.fill('input[name=location]', 'Via Lazzaretto 3'); await p.click('button:has-text("Find address")'); await p.waitForTimeout(800);
    const n0 = log.req.filter((x) => x.method !== 'GET').length;
    await p.click('button:has-text("Preview")'); await p.waitForSelector('.preview-banner'); await p.waitForTimeout(500);
    const v = await txt(p, '.detail');
    ok((await txt(p, '.preview-banner')).includes('Nothing is saved yet'), 'preview banner');
    ok(v.includes('Weekend barista') && v.includes('Nebbia') && v.includes('Weekends') && v.includes('Hospitality') && v.includes('English, Italian') && v.includes('€11 an hour') && v.includes('12 h/week'), 'preview shows the job: ' + v.slice(0, 200));
    ok(/M1 Porta Venezia · \d+ min walk/.test(v), 'preview works out the metro badge like the database will');
    ok(v.includes('New') && v.includes('Coffee.') && v.includes('Via Lazzaretto 3'), 'New badge, company description, location');
    ok(await p.locator('.detail aside button:has-text("Apply")').isDisabled() && await p.locator('.detail .share-btn').isDisabled(), 'Apply and Share shown but do nothing');
    ok(await p.locator('.detail a[href^="/companies/"]').count() === 0, 'no links away from the form');
    ok(log.req.filter((x) => x.method !== 'GET').length === n0, 'nothing saved by previewing');
    await p.click('.preview-banner button:has-text("Back to editing")'); await p.waitForTimeout(300);
    ok((await p.inputValue('input[name=title]')) === 'Weekend barista' && await p.isChecked('input[name=schedule][value=weekends]'), 'back to the form, everything kept');
    await p.check('input[name=only_area]'); await p.click('button:has-text("Preview")'); await p.waitForSelector('.preview-banner'); await p.waitForTimeout(300);
    ok((await txt(p, '.detail')).includes('the employer shows only the area') && !/min walk/.test(await txt(p, '.detail')), 'area only: preview shows the area, no station');
    ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await ctx.close(); }
  { const ctx = await b.newContext(desk); await emock(ctx, { company: { name: 'Pending Co', status: 'pending' } }); const p = await ctx.newPage();
    await employerLogin(p, E); ok(!(await txt(p, 'main')).includes('follow your company'), 'pending company: no follower count');
    await ctx.close(); }

  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
