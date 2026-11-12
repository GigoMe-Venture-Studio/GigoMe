const { OUT } = require('./lib/browser.js');
const { chromium, devices } = require('./lib/browser.js');
const { mock, ID, NEBBIA } = require('./lib/mock.js');
const { emock, employerLogin } = require('./lib/emock.js');
const { stubMap } = require('./lib/stub.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const card = (p, t) => p.locator('.job-list li', { hasText: t });
(async () => {
  const b = await chromium.launch();
  { const ctx = await b.newContext(desk); const log = await mock(ctx); await stubMap(ctx, log); const p = await ctx.newPage();
    await p.goto(E + '/jobs'); await p.waitForTimeout(700);
    ok((await card(p, 'Weekend barista').innerText()).includes('New') && !(await card(p, 'English tutor').innerText()).match(/\bNew\b/), '"New" only on jobs published in the last 3 days');
    ok((await card(p, 'Event host').innerText()).includes('New'), 'published 2 days ago: still New');
    ok((await card(p, 'Weekend barista').innerText()).includes('M1 Porta Venezia · 3 min walk'), 'metro badge: M1 Porta Venezia · 3 min walk (201 m)');
    ok((await card(p, 'English tutor').innerText()).includes('M2 Lanza · 4 min walk'), 'metro badge: 350 m is 4 min');
    ok(!(await card(p, 'Finance assistant').innerText()).includes('min walk'), 'no badge beyond about 1 km');
    ok(!(await card(p, 'Social media helper').innerText()).includes('min walk'), 'no badge for a job that shows only its area');
    ok((await card(p, 'Weekend barista').innerText()).includes('Hospitality') && (await card(p, 'Event host').innerText()).includes('Events') && !/Other.*Other/s.test(await card(p, 'Remote researcher').innerText()), 'category on cards (category "Other" left out)');
    await p.selectOption('select[name=category]', 'tutoring_education'); await p.waitForTimeout(700);
    ok(new URL(p.url()).searchParams.get('category') === 'tutoring_education' && await p.locator('.job-list li').count() === 1 && (await txt(p, '.job-list')).includes('English tutor'), 'category filter in the URL, list filtered');
    await p.click('.view-toggle button:has-text("Map")'); await p.waitForFunction(() => document.querySelector('.jobs-map')?.dataset.state === 'ready', null, { timeout: 15000 }).catch(() => {});
    ok(await p.getAttribute('.jobs-map', 'data-points') === '1', 'category filter applies to the map too');
    // job page
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForTimeout(600);
    const main = await txt(p, 'main');
    ok(main.includes('New') && main.includes('Hospitality') && main.includes('M1 Porta Venezia · 3 min walk'), 'job page: New, category, metro badge');
    ok(await p.getAttribute('.detail-co a', 'href') === '/companies/' + NEBBIA.id && await p.locator(`a[href="/companies/${NEBBIA.id}"]:has-text("All jobs from")`).count() === 1, 'job page links to the company page');
    // company page
    const reqs = []; p.on('request', (r) => reqs.push(r.url()));
    await p.click('.detail-co a'); await p.waitForTimeout(900);
    const cp = await txt(p, 'main');
    ok(new URL(p.url()).pathname === '/companies/' + NEBBIA.id && cp.includes('Nebbia Coffee Bar') && cp.includes('Specialty coffee bar.') && cp.includes('nebbia-example.it'), 'company page: name, description, website');
    ok(cp.includes('Open jobs (3)') && cp.includes('Weekend barista') && cp.includes('English tutor') && cp.includes('Event host') && !cp.includes('Finance assistant'), 'company page: only its open jobs');
    ok(!/@/.test(cp) && !(log.companyReads || []).some((s) => /contact_email/.test(s || '')), 'company page: no contact email shown or asked for');
    await p.waitForFunction(() => document.querySelector('.company-map .jobs-map')?.dataset.state === 'ready', null, { timeout: 15000 }).catch(() => {});
    ok(await p.getAttribute('.company-map .jobs-map', 'data-points') === '2', 'company page: map with its located jobs');
    await p.goto(E + '/companies/c0000000-0000-4000-8000-00000000dead'); await p.waitForTimeout(600);
    ok((await txt(p, 'main')).includes("This company isn't on GigoMe"), 'unknown or unapproved company: not found');
    await p.goto(E + '/companies/not-a-uuid'); await p.waitForTimeout(400);
    ok((await txt(p, 'main')).includes("This company isn't on GigoMe"), 'bad id: not found');
    await ctx.close(); }
  { const ctx = await b.newContext(devices['iPhone 13']); const log = await mock(ctx); await stubMap(ctx, log); const p = await ctx.newPage();
    await p.goto(E + '/companies/' + NEBBIA.id); await p.waitForTimeout(1500);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone: company page, no sideways scroll');
    await p.goto(E + '/jobs'); await p.waitForTimeout(600);
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone: /jobs with badges, no sideways scroll');
    await p.screenshot({ path: OUT + '/p2-phone.png', fullPage: true });
    await ctx.close(); }
  // job form: category
  { const ctx = await b.newContext(desk); const { log } = await emock(ctx, { company: { name: 'Nebbia', status: 'approved' } }); await stubMap(ctx, log); const p = await ctx.newPage();
    await employerLogin(p, E); await p.goto(E + '/dashboard/jobs/new'); await p.waitForTimeout(600);
    await p.fill('input[name=title]', 'Barista'); await p.selectOption('select[name=job_type]', 'part_time'); await p.fill('input[name=hours_per_week]', '10');
    await p.selectOption('select[name=area_id]', '16'); await p.fill('input[name=apply_url]', 'nebbia.it/jobs');
    await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(300);
    ok((await txt(p, 'main')).includes('Choose the category.'), 'submit needs a category');
    await p.check('input[name=schedule][value=weekends]');
    await p.selectOption('select[name=pay_unit]', 'hour'); await p.fill('input[name=pay_min]', '11');
    await p.selectOption('select[name=category]', 'hospitality'); await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(900);
    const post = log.req.find((x) => x.method === 'POST' && x.path === '/rest/v1/jobs');
    ok(post && post.body.category === 'hospitality', 'category saved');
    await ctx.close(); }
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`);
})();
