const { chromium, devices } = require('./lib/browser.js');
const { mock, login, ID } = require('./lib/mock.js');
const { emock, employerLogin } = require('./lib/emock.js');
const { amock } = require('./lib/amock.js');
const { stubMap } = require('./lib/stub.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const titles = (p) => p.$$eval('.jobs-list-col > .job-list .role-title', (e) => e.map((x) => x.textContent));
const qp = (p) => new URL(p.url()).searchParams;
const card = (p, t) => p.locator('.job-card', { hasText: t }).innerText();
async function slide(p, to) { await p.focus('input[name=minpay]'); await p.keyboard.press('Home'); for (let i = 0; i < to; i++) await p.keyboard.press('ArrowRight'); await p.waitForTimeout(800); }

(async () => {
  const b = await chromium.launch();

  // ---- 3. Labels: cards, job page, markers
  { const ctx = await b.newContext(desk); const log = await mock(ctx, {}); await stubMap(ctx, log); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(E + '/jobs'); await p.waitForSelector('.job-list .role-row');
    ok((await card(p, 'Weekend barista')).includes('€11/h'), 'hourly: €11/h');
    ok((await card(p, 'English tutor')).includes('€15–18/h'), 'hourly range: €15–18/h');
    ok((await card(p, 'Remote researcher')).includes('€500/month (≈ €3/h)'), 'monthly with the hourly equivalent: ' + await card(p, 'Remote researcher'));
    ok((await card(p, 'Event host')).includes('€90 per project'), 'per project');
    ok((await card(p, 'Finance intern')).includes('Pay not listed'), 'a job from before structured pay: as before');
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.facts');
    const pay = await txt(p, '.facts > div:first-child dd');
    ok(pay.includes('€11/h') && pay.includes('+ tips'), 'job page: pay and its note: ' + JSON.stringify(pay));
    await p.goto(E + '/jobs?view=map&map=15.5/45.4721/9.1871'); await p.waitForSelector('.jobs-map[data-state=ready]'); await p.waitForTimeout(1200);
    const mk = await p.$$eval('.job-marker', (m) => m.map((x) => [x.textContent, x.getAttribute('aria-label')]));
    ok(mk.some(([t, a]) => t === '€15–18/h' && a.includes('€15–18/h')), 'marker: €15–18/h: ' + JSON.stringify(mk));
    ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await ctx.close(); }

  // ---- 4. Minimum pay slider
  { const ctx = await b.newContext(desk); const log = await mock(ctx, {}); await stubMap(ctx, log); const p = await ctx.newPage();
    await p.goto(E + '/jobs'); await p.waitForSelector('.job-list .role-row');
    ok((await txt(p, '.min-pay-value')) === 'Any' && await p.getAttribute('input[name=minpay]', 'max') === '30' && await p.getAttribute('input[name=minpay]', 'step') === '1', 'slider: €0 to €30, step €1, "Any"');
    await slide(p, 12);
    ok(qp(p).get('minpay') === '12' && (await txt(p, '.min-pay-value')) === '€12/h', 'minpay=12 in the URL, shown as €12/h');
    ok(log.jobs.some((s) => s.includes('pay_hourly=gte.12')), 'asks for an hourly equivalent of at least 12');
    ok((await titles(p)).join('|') === 'English tutor', 'only jobs paying €12/h or more: ' + (await titles(p)).join('|'));
    ok((await txt(p, '.pay-note-hidden')) === '3 jobs hidden: paid per project or pay not specified. Show them', 'note counts every hidden job, by kind: ' + JSON.stringify(await txt(p, '.pay-note-hidden')));
    const hq = log.jobs.find((s) => s.includes('pay_hourly=is.null'));
    ok(hq && hq.startsWith('?select=pay_unit%2Ccompanies%21inner%28status%29') && !hq.includes('gte'), 'asks only for the hidden jobs\' pay unit: ' + hq);
    ok(!(await txt(p, '.pay-note-hidden')).includes('Weekend barista'), 'jobs paying below the minimum are not counted as hidden');
    await p.click('.pay-note-hidden button:has-text("Show them")'); await p.waitForTimeout(600);
    ok(qp(p).get('nohourly') === 'yes' && (await titles(p)).sort().join('|') === 'English tutor|Event host|Finance intern|Social media helper', 'Show them: every hidden job back: ' + (await titles(p)).join('|'));
    ok((await txt(p, '.pay-note-hidden')).includes('Also showing jobs paid per project, unpaid or with pay not specified.'), 'says they are shown');
    await p.click('.pay-note-hidden button:has-text("Hide them")'); await p.waitForTimeout(600);
    ok(!qp(p).get('nohourly') && (await titles(p)).length === 1, 'Hide them');
    await p.goto(E + '/jobs?minpay=12&remote=no'); await p.waitForTimeout(700);
    ok((await txt(p, '.pay-note-hidden')) === '1 job hidden: paid per project. Show it', 'only the kinds present, singular: ' + JSON.stringify(await txt(p, '.pay-note-hidden')));
    await p.goto(E + '/jobs?minpay=12&projects=yes'); await p.waitForTimeout(700);
    ok((await titles(p)).length === 4, 'older links with projects=yes still show them');
    await p.goto(E + '/jobs?minpay=12'); await p.waitForTimeout(700);
    await p.click('.view-toggle button:has-text("Map")'); await p.waitForSelector('.jobs-map[data-state=ready]');
    ok(await p.getAttribute('.jobs-map', 'data-points') === '1', 'map follows the minimum pay');
    await p.click('.view-toggle button:has-text("List")'); await p.waitForTimeout(300);
    await p.focus('input[name=minpay]'); await p.keyboard.press('Home'); await p.waitForTimeout(800);
    ok(!qp(p).get('minpay') && (await titles(p)).length === 6 && await p.locator('.pay-note-hidden').count() === 0, 'back to €0: every job, no note');
    await p.goto(E + '/jobs?minpay=40&nohourly=yes'); await p.waitForTimeout(600);
    ok((await txt(p, '.min-pay-value')) === 'Any' && (await titles(p)).length === 6, 'out-of-range values in a link are ignored');
    await p.goto(E + '/jobs?minpay=3'); await p.waitForTimeout(600);
    ok((await titles(p)).sort().join('|') === 'English tutor|Weekend barista', 'monthly pay counts by its hourly equivalent (€500/month at 40 h ≈ €2.88: out at €3)');
    await ctx.close(); }
  { const ctx = await b.newContext(devices['iPhone 13']); await mock(ctx, {}); const p = await ctx.newPage();
    await p.goto(E + '/jobs?minpay=10'); await p.waitForSelector('.job-list'); await p.waitForTimeout(500);
    ok((await txt(p, '.job-filters-toggle .filter-count')) === '1' && !(await p.locator('.min-pay').isVisible()), 'phone: behind Filters, counted');
    await p.click('.job-filters-toggle'); ok(await p.locator('.min-pay').isVisible(), 'phone: slider in the panel');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone: no sideways scroll');
    await ctx.close(); }

  // ---- 5. Highest pay
  { const ctx = await b.newContext(desk); const log = await mock(ctx, {}); const p = await ctx.newPage();
    await p.goto(E + '/jobs'); await p.waitForSelector('.job-list .role-row');
    await p.selectOption('select[name=sort]', 'pay'); await p.waitForTimeout(600);
    ok(qp(p).get('sort') === 'pay' && new URLSearchParams(log.jobs.pop()).get('order').startsWith('is_example.asc,pay_hourly.desc.nullslast'), 'sort=pay, by the hourly equivalent');
    ok((await titles(p)).join('|') === 'English tutor|Weekend barista|Remote researcher|Event host|Finance intern|Social media helper', 'highest first, then the rest most recently published first: ' + (await titles(p)).join('|'));
    ok(!(await p.locator('button:has-text("Clear filters")').count()), 'sorting is not a filter');
    await ctx.close(); }

  // ---- saved search wording
  { const ctx = await b.newContext(desk); await mock(ctx, {}); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs?minpay=12'); await p.waitForTimeout(600);
    await p.click('button:has-text("Save this search")');
    ok((await p.inputValue('input[name=search_name]')) === '€12/h or more', 'saved search name: ' + await p.inputValue('input[name=search_name]'));
    await ctx.close(); }

  // ---- 2. Job form and preview
  { const ctx = await b.newContext(desk); const { log } = await emock(ctx, { company: { name: 'Nebbia', status: 'approved' } }); await stubMap(ctx, {}); const p = await ctx.newPage();
    await employerLogin(p, E); await p.click('a.btn:has-text("New job")'); await p.waitForTimeout(400);
    await p.fill('input[name=title]', 'Barista'); await p.selectOption('select[name=job_type]', 'part_time'); await p.selectOption('select[name=category]', 'hospitality');
    await p.fill('input[name=hours_per_week]', '12'); await p.check('input[name=schedule][value=weekends]'); await p.selectOption('select[name=area_id]', '3');
    await p.fill('input[name=apply_url]', 'nebbia.it/jobs');
    const units = await p.$$eval('select[name=pay_unit] option', (o) => o.map((x) => x.textContent));
    ok(units.join('|') === 'Choose…|Per hour|Per month|Per project|Curricular internship (university credits)', 'units: ' + units.join('|'));
    await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(300);
    ok((await txt(p, 'main')).includes('Choose how the job is paid.'), 'pay required to submit');
    await p.selectOption('select[name=pay_unit]', 'month'); await p.fill('input[name=pay_min]', '600');
    ok((await txt(p, '.pay-hourly')).includes('≈ €11.54 an hour at 12 h/week'), 'monthly: live hourly equivalent: ' + await txt(p, '.pay-hourly'));
    await p.fill('input[name=hours_per_week]', '24');
    ok((await txt(p, '.pay-hourly')).includes('≈ €5.77 an hour at 24 h/week'), 'follows the hours');
    await p.fill('input[name=pay_max]', '800');
    ok((await txt(p, '.pay-hourly')).includes('≈ €5.77–7.69'), 'range: both ends');
    await p.fill('input[name=pay_max]', '500'); await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(300);
    ok((await txt(p, 'main')).includes("The maximum can't be less than the minimum."), 'max below min refused');
    await p.fill('input[name=pay_max]', ''); await p.fill('input[name=pay_min]', '12,5'); await p.selectOption('select[name=pay_unit]', 'hour');
    await p.fill('input[name=pay]', 'meals included');
    await p.click('button:has-text("Preview")'); await p.waitForSelector('.preview-banner');
    ok((await txt(p, '.facts > div:first-child dd')).includes('€12.50/h') && (await txt(p, '.facts > div:first-child dd')).includes('meals included'), 'preview: "12,5" read as €12.50/h, with the note');
    await p.click('.preview-banner button'); await p.waitForTimeout(300);
    await p.selectOption('select[name=pay_unit]', 'unpaid_curricular'); await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(300);
    ok((await txt(p, 'main')).includes('Unpaid is possible only for an internship'), 'unpaid refused for a part-time job');
    await p.selectOption('select[name=job_type]', 'internship');
    ok(await p.locator('input[name=pay_min]').count() === 0, 'unpaid: no amount fields');
    await p.click('button:has-text("Preview")'); await p.waitForSelector('.preview-banner');
    ok((await txt(p, '.facts > div:first-child dd')).startsWith('Curricular internship (unpaid)'), 'shown as "Curricular internship (unpaid)"');
    await p.click('.preview-banner button'); await p.waitForTimeout(300);
    const n0 = log.req.length;
    await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(800);
    const post = log.req.slice(n0).find((x) => x.method === 'POST' && x.path === '/rest/v1/jobs');
    ok(post && post.body.pay_unit === 'unpaid_curricular' && post.body.pay_min === null && post.body.pay_max === null && post.body.pay === 'meals included', 'sends unit, no amounts, the note: ' + JSON.stringify(post && [post.body.pay_unit, post.body.pay_min, post.body.pay_max, post.body.pay]));
    await ctx.close(); }

  // ---- 1. /admin: live jobs without structured pay
  { const ctx = await b.newContext(desk);
    await amock(ctx, { admin: true, noAreaLive: [{ id: ID(9), title: 'Old cashier job', created_at: new Date(Date.now() - 864e5 * 20).toISOString(), remote: false, area_id: 2, schedule: ['weekends'], pay_unit: null, companies: { name: 'Old Shop', status: 'approved' } }],
      extraJobs: [{ id: 'pj9', title: 'No structured pay yet', description: 'x', job_type: 'gig', location: 'Navigli', remote: false, hours_per_week: 5, pay: '€10/h', italian_level: 'none', start_date: null, expires_at: new Date(Date.now() + 864e5 * 30).toISOString(), status: 'pending', created_at: new Date().toISOString(), review_note: null, reviewed_at: null, company_id: 'c3', area_id: 1, schedule: ['weekends'] }] });
    const p = await ctx.newPage(); await p.goto(E + '/login'); await login(p); await p.goto(E + '/admin'); await p.waitForSelector('#admin-no-area');
    ok((await txt(p, '#admin-no-area')).includes('Old cashier job') && (await txt(p, '#admin-no-area')).includes('no structured pay'), 'live job without structured pay listed');
    const item = p.locator('.admin-item', { hasText: 'No structured pay yet' });
    ok((await item.innerText()).includes('No structured pay.') && (await item.innerText()).includes('Not structured: "€10/h"'), 'pending job flagged, old pay text shown');
    for (const c of await item.locator('.admin-checklist input').all()) await c.check();
    ok(await item.locator('button:has-text("Publish")').isDisabled(), 'its Publish stays off');
    await ctx.close(); }

  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
