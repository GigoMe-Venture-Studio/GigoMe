const { OUT } = require('./lib/browser.js');
const { chromium, devices } = require('./lib/browser.js');
const { emock, employerLogin, login } = require('./lib/emock.js');
const { mock } = require('./lib/mock.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const path = (p) => new URL(p.url()).pathname;
const frames = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const SEL = "main a:not(.role-row),main button,main input,main select,main textarea,.site-footer a,.site-footer button:not(.footer-link-btn),.menu-panel a,.menu-panel button,.maplibregl-ctrl-attrib";
const probe = (sel) => { const b = document.querySelector('.feedback-fab'); const r = b.getBoundingClientRect(); const shown = !b.hasAttribute('data-away'); const hits = [];
  for (const el of document.querySelectorAll(sel)) { const q = el.getBoundingClientRect(); if (q.width && q.height && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) hits.push((el.textContent || el.name || '').trim().slice(0, 20)); }
  return { shown, hits }; };
const future = (d) => new Date(Date.now() + d * 864e5).toISOString();

(async () => {
  const b = await chromium.launch();

  // ---- logged out: For employers in header and footer
  { const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/'); await p.waitForTimeout(400);
    ok(await p.locator('.main-nav a:has-text("For employers")').getAttribute('href') === '/employers', 'header: For employers when logged out');
    ok(await p.locator('.site-footer a:has-text("For employers")').count() === 1, 'footer: For employers when logged out');
    await p.click('.main-nav a:has-text("For employers")'); await p.waitForTimeout(400);
    ok(path(p) === '/employers', 'opens /employers');
    const t = await txt(p, 'main');
    ok(/free/i.test(t) && /review/i.test(t) && /2 working days/.test(t), '/employers explains free listing and review');
    ok(await p.locator('main input[name=email]').count() === 1 && (await txt(p, '.employers-login')).includes('Work email'), 'login form with work email');
    ok(await p.locator('.login-unis').count() === 0, 'employer login: no "Open to students of ..." line');
    await p.screenshot({ path: OUT + '/employers.png', fullPage: true });
    // a student email is pointed to the student login, no code sent
    const before = 0;
    await p.fill('input[name=email]', 'ana@studbocconi.it'); await p.click('text=Send me a code'); await p.waitForTimeout(400);
    const note = await txt(p, '.employers-login');
    ok(/university email/.test(note) && await p.locator('.employers-login a[href="/login"]').count() === 1, 'student email: pointed to the student login');
    ok(await p.locator('input[name=code]').count() === 0, 'student email: no code step');
    // /login with a company email points to /employers
    await p.goto(E + '/login'); await p.waitForTimeout(300);
    await p.fill('input[name=email]', 'owner@cafe.it'); await p.click('text=Send me a code'); await p.waitForTimeout(400);
    ok(await p.locator('main a[href="/employers"]').count() === 1, '/login with a non-university email links to /employers');
    await p.goto(E + '/dashboard'); await p.waitForTimeout(400);
    ok(path(p) === '/employers' && new URL(p.url()).searchParams.get('next') === '/dashboard', 'logged out /dashboard goes to /employers?next=/dashboard');
    await ctx.close(); }

  // ---- first login -> setup -> dashboard
  { const ctx = await b.newContext(desk); const { log, db } = await emock(ctx); const p = await ctx.newPage();
    await employerLogin(p, E);
    ok(path(p) === '/employers/setup', 'first login without a company goes to /employers/setup: ' + p.url());
    ok(await p.inputValue('input[name=contact_email]') === 'owner@cafe.it', 'contact email prefilled with the login email');
    await p.fill('input[name=contact_email]', ''); await p.fill('input[name=website]', 'not a site'); await p.click('button:has-text("Save company")'); await p.waitForTimeout(200);
    const t = await txt(p, 'main');
    ok(t.includes('Add your company name.') && t.includes('Enter a web address') && t.includes('Add an email address'), 'setup validation');
    ok(!log.req.some((x) => x.method === 'POST'), 'nothing saved while invalid');
    ok((await txt(p, 'main')).includes('Accept the terms to continue.'), 'setup: terms must be accepted');
    ok(await p.getAttribute('.terms-field a', 'href') === '/terms' && await p.getAttribute('.terms-field a', 'target') === '_blank', 'setup: "terms" links to /terms in a new tab');
    await p.fill('input[name=company_name]', '  Nebbia   Coffee '); await p.fill('input[name=website]', 'nebbia.it'); await p.fill('textarea[name=company_description]', 'Specialty coffee.');
    await p.fill('input[name=contact_email]', 'Hiring@Nebbia.it'); await p.click('button:has-text("Save company")'); await p.waitForTimeout(300);
    ok(!log.req.some((x) => x.method === 'POST'), 'not saved until the terms are accepted');
    await p.check('input[name=accept_terms]'); await p.click('button:has-text("Save company")'); await p.waitForTimeout(600);
    const post = log.req.find((x) => x.method === 'POST' && x.path === '/rest/v1/companies');
    const pb = post ? { ...post.body } : {}; const ta = pb.terms_accepted_at; delete pb.terms_accepted_at;
    ok(post && JSON.stringify(pb) === JSON.stringify({ name: 'Nebbia Coffee', website: 'https://nebbia.it', description: 'Specialty coffee.', contact_email: 'hiring@nebbia.it' }) && ta && !isNaN(Date.parse(ta)), 'creates the company without status, with terms accepted: ' + JSON.stringify(post && post.body));
    ok((await txt(p, 'main')).includes("We'll review your company, usually within 2 working days."), 'review message after setup');
    ok(db.company.status === 'pending', 'company is pending');
    await p.waitForTimeout(300);
    ok((await txt(p, '.site-header .header-user')) === 'Nebbia Coffee', 'header shows the company name: ' + await txt(p, '.site-header .header-user'));
    ok(await p.locator('.main-nav a:has-text("Dashboard")').count() === 1 && await p.locator('.main-nav a:has-text("For employers")').count() === 0, 'header: Dashboard, no For employers');
    ok(await p.locator('.site-footer a:has-text("For employers")').count() === 0, 'footer: no For employers when logged in');
    await p.click('text=Go to your dashboard'); await p.waitForTimeout(600);
    const d = await txt(p, 'main');
    ok(d.includes('In review') && d.includes('usually within 2 working days'), 'dashboard: company in review with explanation');
    ok(d.includes('hiring@nebbia.it'), 'dashboard shows the contact email (via the owner-only function)');
    ok(!log.req.some((x) => x.method === 'GET' && x.path === '/rest/v1/companies' && /contact_email/.test(x.search)), 'never selects contact_email directly');
    ok(d.includes('No jobs yet'), 'empty jobs state');
    // edit company
    await p.click('text=Edit company details'); await p.fill('input[name=company_name]', 'Nebbia Coffee Bar'); await p.click('button:has-text("Save changes")'); await p.waitForTimeout(500);
    ok((await txt(p, 'main')).includes('Your company details are saved.') && db.company.name === 'Nebbia Coffee Bar', 'company details edited');
    // a draft while pending
    await p.click('a.btn:has-text("New job")'); await p.waitForTimeout(400);
    ok(path(p) === '/dashboard/jobs/new', 'New job opens the form');
    ok(await p.locator('button:has-text("Submit for review")').isDisabled() && (await txt(p, 'main')).includes('once your company is approved'), 'pending company: submit disabled, explained');
    await p.fill('input[name=title]', 'Weekend barista'); await p.selectOption('select[name=job_type]', 'part_time');
    await p.fill('input[name=hours_per_week]', '25'); await frames(p);
    ok((await txt(p, 'main')).includes('Students with a non-EU study permit can usually work up to 20 hours a week'), 'hours above 20: hint shown');
    await p.fill('input[name=hours_per_week]', '12'); await frames(p);
    ok(!(await txt(p, 'main')).includes('non-EU study permit'), 'hours 20 or less: no hint');
    await p.fill('input[name=apply_url]', 'nebbia.it/jobs');
    await p.click('button:has-text("Save as draft")'); await p.waitForTimeout(700);
    const jp = log.req.filter((x) => x.path === '/rest/v1/jobs' && x.method === 'POST');
    ok(jp.length === 1 && jp[0].body.status === 'draft' && jp[0].body.hours_per_week === 12 && jp[0].body.company_id === 'c1', 'draft created');
    const sc = log.req.filter((x) => x.path === '/rest/v1/rpc/set_job_contact').pop();
    ok(sc && sc.body.p_apply_url === 'https://nebbia.it/jobs' && sc.body.p_apply_email === null, 'contact saved via set_job_contact');
    ok(path(p) === '/dashboard' && (await txt(p, 'main')).includes('"Weekend barista" is saved as a draft.'), 'back on the dashboard with a message');
    ok((await txt(p, '.dash-jobs')).includes('Draft'), 'job listed as Draft');
    await p.screenshot({ path: OUT + '/dashboard-pending.png', fullPage: true });
    await ctx.close(); }

  // ---- approved company: submit, validation, live job with clicks, edit live, changes requested, rejected, close, delete
  const jobs = [
    { title: 'Live barista', job_type: 'part_time', hours_per_week: 12, status: 'published', pay: '€11/h', area_id: 3 },
    { title: 'Needs changes', job_type: 'gig', hours_per_week: 8, area_id: 1, status: 'changes_requested', review_note: 'Please state the pay.', reviewed_at: future(-1) },
    { title: 'Rejected one', job_type: 'gig', hours_per_week: 8, status: 'rejected', review_note: 'Asks students for a deposit.' },
    { title: 'Old draft', job_type: 'other', hours_per_week: 5, status: 'draft' },
    { title: 'Expired one', job_type: 'gig', hours_per_week: 5, status: 'published', expires_at: future(-2) },
    { title: 'Unpublished one', job_type: 'gig', hours_per_week: 5, status: 'closed', review_note: 'Unpublished after a report: asked for a fee.' }
  ];
  { const ctx = await b.newContext(desk); const { log, db } = await emock(ctx, { company: { name: 'Nebbia', status: 'approved', website: null, description: null }, jobs, clicks: { j1: 7 }, contacts: { j1: { url: 'https://nebbia.it/jobs', email: null }, j2: { url: null, email: 'jobs@nebbia.it' } } });
    const p = await ctx.newPage();
    await employerLogin(p, E);
    ok(path(p) === '/dashboard', 'returning employer goes to /dashboard: ' + p.url());
    const d = await txt(p, 'main');
    ok(d.includes('Approved'), 'company approved');
    const row = (t) => p.locator('.dash-job', { hasText: t });
    ok((await row('Live barista').innerText()).includes('7 apply clicks'), 'live job shows apply clicks');
    ok(!(await row('Old draft').innerText()).includes('clicks'), 'no clicks shown for drafts');
    ok((await row('Needs changes').innerText()).includes('Please state the pay.') && (await row('Needs changes').innerText()).includes('Changes requested'), 'changes requested: status and note');
    const rej = await row('Rejected one').innerText();
    ok(rej.includes('Asks students for a deposit.') && rej.includes('Rejected') && await row('Rejected one').locator('a.btn:has-text("Edit")').count() === 0, 'rejected: note, no Edit');
    ok((await row('Expired one').innerText()).includes('Expired'), 'expired published job shows Expired');
    ok((await row('Unpublished one').innerText()).includes('Unpublished after a report: asked for a fee.'), 'closed by an admin: the note is shown');
    ok(await row('Old draft').locator('button:has-text("Delete")').count() === 1 && await row('Live barista').locator('button:has-text("Delete")').count() === 0, 'Delete for drafts only');
    ok(log.req.some((x) => x.path === '/rest/v1/rpc/my_job_stats'), 'clicks come from my_job_stats');
    // approved: name and website read-only
    const comp = await txt(p, '.dash-card:has(#company-title)');
    ok(comp.includes('To change these, write to hello@gigome.org.') && comp.includes('Edit description and contact email'), 'approved: name and website read-only with the note');
    await p.click('text=Edit description and contact email');
    ok(await p.locator('input[name=company_name]').count() === 0 && await p.locator('input[name=website]').count() === 0, 'approved: no name or website inputs in the form');
    ok((await txt(p, '.company-form')).includes('To change these, write to hello@gigome.org.'), 'approved: the form repeats the note');
    await p.fill('textarea[name=company_description]', 'Coffee and pastries.'); await p.click('button:has-text("Save changes")'); await p.waitForTimeout(500);
    const cpatch = log.req.filter((x) => x.method === 'PATCH' && x.path === '/rest/v1/companies').pop();
    ok(cpatch && JSON.stringify(Object.keys(cpatch.body).sort()) === '["contact_email","description"]' && db.company.description === 'Coffee and pastries.', 'approved: saves only description and contact email: ' + JSON.stringify(cpatch && cpatch.body));
    ok((await txt(p, 'main')).includes('Your company details are saved.'), 'approved: saved');
    await p.screenshot({ path: OUT + '/dashboard-approved.png', fullPage: true });

    // new job: submit needs a contact
    await p.click('a.btn:has-text("New job")'); await p.waitForTimeout(400);
    await p.fill('input[name=title]', 'Tutor'); await p.selectOption('select[name=job_type]', 'gig'); await p.fill('input[name=hours_per_week]', '6');
    await p.selectOption('select[name=area_id]', '16');
    await p.selectOption('select[name=category]', 'tutoring_education');
    await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(300);
    ok((await txt(p, 'main')).includes('Add a link or an email address'), 'submit needs a link or email');
    ok((await txt(p, 'main')).includes('Choose when the job happens (at least one).'), 'submit needs a schedule');
    await p.check('input[name=schedule][value=weekday_evenings]'); await p.check('input[name=schedule][value=weekends]'); await p.check('input[name=languages][value=en]');
    ok((await txt(p, 'main')).includes('Choose how the job is paid.'), 'submit needs structured pay');
    await p.selectOption('select[name=pay_unit]', 'month'); await p.fill('input[name=pay_min]', '600');
    await p.fill('input[name=apply_email]', 'nope'); await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(200);
    ok((await txt(p, 'main')).includes("That email address doesn't look right."), 'bad apply email refused');
    await p.fill('input[name=hours_per_week]', '41'); await p.fill('input[name=apply_email]', 'Jobs@Nebbia.it'); await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(200);
    ok((await txt(p, 'main')).includes('from 1 to 40'), 'hours over 40 refused');
    await p.fill('input[name=hours_per_week]', '6');
    const n0 = log.req.length;
    await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(800);
    const seq = log.req.slice(n0).filter((x) => x.method !== 'GET' && !/my_job_stats|get_company/.test(x.path)).map((x) => x.method + ' ' + x.path.replace('/rest/v1/', '') + (x.body && x.body.status ? ':' + x.body.status : ''));
    ok(seq.slice(0, 3).join(' > ') === 'POST jobs:draft > POST rpc/set_job_contact > PATCH jobs:pending', 'submit = draft, then contact, then pending: ' + seq.join(' > '));
    const firstPost = log.req.slice(n0).find((x) => x.method === 'POST' && x.path === '/rest/v1/jobs');
    ok(firstPost && firstPost.body.pay_unit === 'month' && firstPost.body.pay_min === 600 && firstPost.body.pay_max === null, 'structured pay sent: ' + JSON.stringify(firstPost && [firstPost.body.pay_unit, firstPost.body.pay_min, firstPost.body.pay_max]));
    ok(firstPost && JSON.stringify(firstPost.body.schedule) === '["weekday_evenings","weekends"]' && JSON.stringify(firstPost.body.languages) === '["en"]', 'schedule and languages sent, in list order: ' + JSON.stringify(firstPost && [firstPost.body.schedule, firstPost.body.languages]));
    ok((await txt(p, 'main')).includes('"Tutor" is submitted for review.') && (await txt(p, '.dash-job:has-text("Tutor")')).includes('In review'), 'submitted job is In review');

    // edit a live job
    await row('Live barista').locator('a.btn:has-text("Edit")').click(); await p.waitForTimeout(500);
    ok(await p.inputValue('input[name=apply_url]') === 'https://nebbia.it/jobs', 'edit form loads the contact (get_own_job_contact)');
    ok((await txt(p, 'main')).includes('Saving changes sends it back to review'), 'live job: warned before saving');
    await p.fill('input[name=pay]', '€12/h');
    const n1 = log.req.length;
    await p.click('button:has-text("Save and submit for review")'); await p.waitForTimeout(700);
    const patches = log.req.slice(n1).filter((x) => x.method === 'PATCH');
    ok(patches.length === 1 && patches[0].body.status === 'pending' && patches[0].body.pay === '€12/h', 'live job edit = one update with status pending');
    ok(db.jobs.find((x) => x.id === 'j1').status === 'pending', 'live job back in review');

    // resubmit changes requested
    await row('Needs changes').locator('a.btn:has-text("Edit")').click(); await p.waitForTimeout(500);
    ok((await txt(p, 'main')).includes('Please state the pay.'), 'editor shows the reviewer note');
    await p.fill('input[name=pay]', '€90 a day'); await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(700);
    ok(db.jobs.find((x) => x.id === 'j2').status === 'pending' && db.jobs.find((x) => x.id === 'j2').pay === '€90 a day', 'changes requested job resubmitted');

    // rejected can't be edited even by URL
    await p.goto(E + '/dashboard/jobs/j3/edit'); await p.waitForTimeout(500);
    ok((await txt(p, 'main')).includes("can't be edited or submitted again") && await p.locator('input[name=title]').count() === 0, 'rejected job: no form by URL either');
    await p.goto(E + '/dashboard/jobs/nope/edit'); await p.waitForTimeout(500);
    ok((await txt(p, 'main')).includes('Job not found'), 'unknown job id: not found');

    // close and delete
    await p.goto(E + '/dashboard'); await p.waitForTimeout(600);
    p.once('dialog', (dl) => dl.accept());
    await row('Tutor').locator('button:has-text("Close")').click(); await p.waitForTimeout(600);
    ok(db.jobs.find((x) => x.title === 'Tutor').status === 'closed' && (await txt(p, '.dash-job:has-text("Tutor")')).includes('Closed'), 'Close sets closed');
    p.once('dialog', (dl) => dl.dismiss());
    await row('Old draft').locator('button:has-text("Delete")').click(); await p.waitForTimeout(400);
    ok(db.jobs.some((x) => x.title === 'Old draft'), 'Delete cancelled keeps the draft');
    p.once('dialog', (dl) => dl.accept());
    await row('Old draft').locator('button:has-text("Delete")').click(); await p.waitForTimeout(600);
    ok(!db.jobs.some((x) => x.title === 'Old draft') && await row('Old draft').count() === 0, 'Delete removes the draft');
    await ctx.close(); }

  // ---- a company account on /account: name only
  { const ctx = await b.newContext(desk); const { log } = await emock(ctx, { company: { name: 'Nebbia', status: 'approved' } }); const p = await ctx.newPage();
    await employerLogin(p, E); await p.goto(E + '/account'); await p.waitForTimeout(600);
    ok(await p.locator('select[name=degree_level]').count() === 0 && await p.locator('select[name=graduation_year]').count() === 0, 'company /account: no degree or graduation year');
    await p.fill('input[name=full_name]', 'Marta Neri'); await p.click('button:has-text("Save changes")'); await p.waitForTimeout(500);
    const patch = (log.patches || []).pop();
    ok(patch && JSON.stringify(patch.body) === JSON.stringify({ full_name: 'Marta Neri' }) && (await txt(p, 'main')).includes('Your changes are saved.'), 'company /account: saves just the name: ' + JSON.stringify(patch && patch.body));
    await ctx.close(); }

  // ---- a student on employer pages
  { const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/dashboard'); await p.waitForTimeout(500);
    ok((await txt(p, 'main')).includes('This page is for employers'), 'student on /dashboard: told it is for employers');
    ok(await p.locator('.main-nav a:has-text("Dashboard")').count() === 0 && await p.locator('.main-nav a:has-text("For employers")').count() === 0, 'student header: no Dashboard, no For employers');
    await p.goto(E + '/employers'); await p.waitForTimeout(500);
    ok((await txt(p, '.employers-login')).includes("You're logged in as a student"), 'student on /employers: told so');
    await ctx.close(); }

  // ---- logged out /dashboard -> login -> back
  { const ctx = await b.newContext(desk); await emock(ctx, { company: { name: 'Nebbia', status: 'approved' } }); const p = await ctx.newPage();
    await p.goto(E + '/dashboard/jobs/new'); await p.waitForTimeout(400);
    ok(path(p) === '/employers', 'logged out job form -> /employers');
    await p.fill('input[name=email]', 'owner@cafe.it'); await p.click('text=Send me a code'); await p.waitForTimeout(300);
    await p.fill('input[name=code]', '123456'); await p.waitForTimeout(900);
    ok(path(p) === '/dashboard/jobs/new', 'after login: back to the job form: ' + p.url());
    await ctx.close(); }

  // ---- phones
  for (const [name, dev] of [['iPhone SE', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['iPhone 13', devices['iPhone 13']]]) {
    { const ctx = await b.newContext(dev); await mock(ctx); const p = await ctx.newPage();
      await p.goto(E + '/'); await p.waitForTimeout(300); await p.click('#menu-btn'); await frames(p);
      ok(await p.locator('.menu-panel a:has-text("For employers")').count() === 1, name + ': menu has For employers when logged out');
      await p.goto(E + '/employers'); await p.waitForTimeout(300);
      ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), name + ': /employers no sideways scroll');
      await ctx.close(); }
    { const ctx = await b.newContext(dev); await emock(ctx, { company: { name: 'Nebbia Coffee Bar Milano', status: 'approved' }, jobs, clicks: { j1: 3 } }); const p = await ctx.newPage();
      await employerLogin(p, E);
      await p.click('#menu-btn'); await frames(p);
      const menu = await txt(p, '.menu-panel');
      ok(menu.includes('Dashboard') && menu.includes('Nebbia Coffee Bar Milano'), name + ': menu has Dashboard and the company name');
      await p.click('#menu-btn');
      for (const u of ['/dashboard', '/dashboard/jobs/new', '/dashboard/jobs/j1/edit']) {
        await p.goto(E + u); await p.waitForTimeout(600);
        ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${name} ${u}: no sideways scroll`);
        const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); let bad = 0;
        for (let y = 0; y <= max + 30; y += 31) { await p.evaluate((yy) => scrollTo(0, yy), y); await frames(p); const r = await p.evaluate(probe, SEL); if (r.shown && r.hits.length) { bad++; if (bad < 3) console.log('  overlap', u, y, r.hits); } }
        ok(bad === 0, `${name} ${u}: feedback button never covers a control`);
      }
      if (name === 'iPhone 13') { await p.goto(E + '/dashboard'); await p.waitForTimeout(600); await p.screenshot({ path: OUT + '/phone-dashboard.png', fullPage: true });
        await p.goto(E + '/dashboard/jobs/j1/edit'); await p.waitForTimeout(600); await p.fill('input[name=hours_per_week]', '25'); await p.screenshot({ path: OUT + '/phone-editor.png', fullPage: true }); }
      await ctx.close(); }
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
})();
