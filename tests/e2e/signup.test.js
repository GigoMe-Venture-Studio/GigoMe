// The confirmation after signing up (src/components/SignupDone.jsx): students
// after /welcome's first save, company accounts after the company setup.
// Shown once, right after signup: never on a normal login or a Terms update.
const { chromium } = require('./lib/browser.js');
const { mock, login, ID } = require('./lib/mock.js');
const { emock, employerLogin } = require('./lib/emock.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const url = (p) => new URL(p.url());
const desk = { viewport: { width: 1280, height: 900 } };
const phoneAt = (width) => ({ viewport: { width, height: 640 }, isMobile: true, hasTouch: true });
const NEW_STUDENT = { fullName: null, termsVersion: null };
const buttons = (p) => p.$$eval('.signup-done .auth-buttons a', (els) => els.map((e) => e.textContent.trim() + ' ' + e.getAttribute('href')));
// Text cut off or pushed off the screen: anything wider than its box, or past the edges.
const cutOff = (p) => p.$$eval('.signup-done, .signup-done *', (els) => els.filter((e) => e.offsetParent !== null).filter((e) => {
  const r = e.getBoundingClientRect(); return e.scrollWidth > e.clientWidth + 1 || r.left < -0.5 || r.right > innerWidth + 0.5;
}).map((e) => e.tagName + ' ' + e.textContent.trim().slice(0, 30)));
const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);

async function fillWelcome(p, name = 'Ana Maria Rossi') {
  await p.fill('input[name=full_name]', name); await p.selectOption('select[name=degree_level]', 'master');
  await p.selectOption('select[name=graduation_year]', String(new Date().getFullYear() + 1));
  await p.check('input[name=accept_terms]');
  await p.click('button:has-text("Save and continue")'); await p.waitForTimeout(700);
}

(async () => {
  const b = await chromium.launch();

  // ---- A new student who pressed Save on a job: confirmation, then back to that job
  { const ctx = await b.newContext(desk); const log = await mock(ctx, NEW_STUDENT); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(E + '/jobs'); await p.waitForSelector('.job-list .role-row');
    await p.click(`.job-card a.save-btn[href="/login?next=${encodeURIComponent('/jobs/' + ID(1))}"]`); await p.waitForTimeout(400);
    ok(url(p).pathname === '/login' && url(p).searchParams.get('next') === '/jobs/' + ID(1), 'Save while logged out: /login?next=/jobs/<id>');
    await login(p);
    ok(url(p).pathname === '/welcome' && url(p).searchParams.get('next') === '/jobs/' + ID(1), 'new student: /welcome, keeping the way back');
    await fillWelcome(p);
    ok(url(p).pathname === '/welcome', 'stays on /welcome to confirm');
    ok((await txt(p, 'h1')) === "You're all set, Ana." && (await txt(p, '.signup-done .lead')) === 'Your GigoMe account is ready.', 'headline with the first name, account ready: ' + await txt(p, 'h1'));
    ok(await p.evaluate(() => document.activeElement && document.activeElement.tagName === 'H1'), 'the heading has the focus (screen readers hear the confirmation)');
    const l = await txt(p, '.signup-done-login');
    ok(l.includes("You're logged in as ana@studbocconi.it.") && l.includes("Next time, log in on the login page with this email and your password. Forgot it? You can always ask for a code by email instead."), 'signed-in email and how login works next time: ' + l);
    ok((await buttons(p)).join(' | ') === `Back to the job /jobs/${ID(1)} | Browse jobs /jobs`, 'buttons: back to the job, browse jobs: ' + (await buttons(p)).join(' | '));
    ok(await p.locator('.signup-done .auth-buttons a').first().evaluate((e) => e.classList.contains('btn-primary')), 'back to the job is the main button');
    ok(await p.getAttribute('.signup-done-account a', 'href') === '/account' && (await txt(p, '.signup-done-account')) === 'Edit or delete your account', 'small link to /account');
    ok((await txt(p, '.header-user')) === 'Ana Maria Rossi', 'header shows the saved name');
    ok(JSON.stringify(log.acceptTerms) === '[{"p_version":"2.2"}]', 'Terms accepted as usual');
    await p.click('text=Back to the job'); await p.waitForTimeout(600);
    ok(url(p).pathname === '/jobs/' + ID(1) && await p.locator('.apply button:has-text("Apply")').count() === 1, 'back on the job, with Apply');
    ok(log.rpc.length === 0, 'nothing revealed or counted on the way');
    await p.goto(E + '/welcome'); await p.waitForTimeout(600);
    ok(await p.locator('.signup-done').count() === 0, 'opening /welcome again: no confirmation (only right after signup)');
    ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await ctx.close(); }

  // ---- A new student who pressed Apply (with #apply): back to the job, hash kept
  { const ctx = await b.newContext(desk); await mock(ctx, NEW_STUDENT); const p = await ctx.newPage();
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForTimeout(500);
    await p.click('.apply >> text=Log in to see how to apply'); await p.waitForTimeout(400);
    await login(p); await fillWelcome(p);
    ok((await buttons(p))[0] === `Back to the job /jobs/${ID(1)}`, 'Apply: back to the job: ' + (await buttons(p)).join(' | '));
    await ctx.close(); }

  // ---- A new student from the home page: browse jobs and the map
  { const ctx = await b.newContext(desk); await mock(ctx, NEW_STUDENT); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await fillWelcome(p, 'Luca');
    ok((await txt(p, 'h1')) === "You're all set, Luca.", 'one-word name');
    ok((await buttons(p)).join(' | ') === 'Browse jobs /jobs | See jobs on the map /jobs?view=map', 'no job to go back to: browse jobs, map: ' + (await buttons(p)).join(' | '));
    await p.click('text=Browse jobs'); await p.waitForTimeout(600);
    ok(url(p).pathname === '/jobs' && await p.locator('.job-list .role-row').count() > 0, 'Browse jobs opens the list');
    await ctx.close(); }

  // ---- From another page (a search): Continue goes back there
  { const ctx = await b.newContext(desk); await mock(ctx, NEW_STUDENT); const p = await ctx.newPage();
    await p.goto(E + '/login?next=' + encodeURIComponent('/jobs?q=barista')); await login(p); await fillWelcome(p);
    ok((await buttons(p)).join(' | ') === 'Continue /jobs?q=barista | Browse jobs /jobs', 'from a search: continue, browse jobs: ' + (await buttons(p)).join(' | '));
    await ctx.close(); }

  // ---- Never on a normal login
  { const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login?next=' + encodeURIComponent('/jobs/' + ID(1))); await login(p);
    ok(url(p).pathname === '/jobs/' + ID(1) && await p.locator('.signup-done').count() === 0, 'returning student: straight back to the job, no confirmation');
    await ctx.close(); }
  { const ctx = await b.newContext(desk); await mock(ctx, { termsVersion: '1.0' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p);
    ok((await txt(p, 'h1')) === 'Before you continue', 'returning student, new Terms version: asked again');
    await p.check('input[name=accept_terms]'); await p.click('button:has-text("Continue")'); await p.waitForTimeout(700);
    ok(url(p).pathname === '/' && await p.locator('.signup-done').count() === 0, 'accepting new Terms: straight on, no confirmation');
    await ctx.close(); }
  { const ctx = await b.newContext(desk); await emock(ctx, { company: { name: 'Nebbia', status: 'approved' } }); const p = await ctx.newPage();
    await employerLogin(p, E);
    ok(url(p).pathname === '/dashboard' && await p.locator('.signup-done').count() === 0, 'returning company account: dashboard, no confirmation');
    await ctx.close(); }

  // ---- Company account: the company is submitted
  { const ctx = await b.newContext(desk); const { db } = await emock(ctx); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await employerLogin(p, E);
    ok(url(p).pathname === '/employers/setup', 'new company account: setup');
    await p.fill('input[name=company_name]', '  Nebbia   Coffee '); await p.fill('input[name=website]', 'nebbia.it');
    await p.fill('input[name=contact_email]', 'hiring@nebbia.it'); await p.check('input[name=accept_terms]');
    await p.click('button:has-text("Save company")'); await p.waitForTimeout(700);
    ok(db.company && db.company.status === 'pending', 'company saved, pending');
    ok((await txt(p, 'h1')) === 'Your company is submitted' && await p.evaluate(() => document.activeElement.tagName === 'H1'), 'headline, focused');
    const t = await txt(p, '.signup-done');
    ok(t.includes("Nebbia Coffee is now in review. GigoMe checks every company by hand before its jobs can go live. We'll review your company, usually within 2 working days."), 'names the company, in review, and the same review promise as /employers and the dashboard');
    ok(t.includes('You can already write your jobs. They stay drafts that only you can see.')
       && t.includes('Once your company is approved, submit each job. Students see a job only after it has been reviewed too.')
       && t.includes("Your dashboard shows your company's status. We don't send an email when it changes, so check there."), 'what happens next, as the review flow works');
    ok((t.match(/working days/g) || []).length === 1 && !/\bhours\b|we'll email|we will email|notify/i.test(t), 'only the usual review promise: no other timings, no emails');
    ok(t.includes("You're logged in as owner@cafe.it.") && t.includes("Next time, log in on the For employers page with this email and your password. Forgot it? You can always ask for a code by email instead."), 'signed-in email and how login works next time');
    ok((await buttons(p)).join(' | ') === 'Go to your dashboard /dashboard | Write a draft job /dashboard/jobs/new', 'buttons: dashboard, draft job: ' + (await buttons(p)).join(' | '));
    ok(await p.getAttribute('.signup-done-account a', 'href') === '/account', 'small link to /account');
    await p.click('text=Write a draft job'); await p.waitForTimeout(600);
    ok(url(p).pathname === '/dashboard/jobs/new' && await p.locator('input[name=title]').count() === 1, 'a pending company can start a draft');
    await p.goto(E + '/employers/setup'); await p.waitForTimeout(600);
    ok(url(p).pathname === '/dashboard' && await p.locator('.signup-done').count() === 0, 'setup again later: the dashboard, no confirmation');
    ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await ctx.close(); }

  // ---- 320px and 375px: nothing cut off, no sideways scroll
  for (const width of [320, 375]) {
    { const ctx = await b.newContext(phoneAt(width)); await mock(ctx, NEW_STUDENT); const p = await ctx.newPage();
      await p.goto(E + '/login?next=' + encodeURIComponent('/jobs/' + ID(1))); await login(p, 'maximilian.alessandro.longname@studbocconi.it');
      await fillWelcome(p, 'Maximiliano-Alessandro Bartolomeo');
      const cut = await cutOff(p);
      ok(cut.length === 0 && !(await sideways(p)), `${width}px student confirmation: nothing cut off, no sideways scroll: ${cut.join(', ')}`);
      ok(await p.$$eval('.signup-done .auth-buttons a', (els) => els.every((e) => e.getBoundingClientRect().height >= 44)), `${width}px: buttons at least 44px tall`);
      await ctx.close(); }
    { const ctx = await b.newContext(phoneAt(width)); await emock(ctx); const p = await ctx.newPage();
      await employerLogin(p, E);
      await p.fill('input[name=company_name]', 'Trattoria Internazionale dei Navigli Srl'); await p.fill('input[name=website]', 'trattoria-navigli.it');
      await p.fill('input[name=contact_email]', 'owner@cafe.it'); await p.check('input[name=accept_terms]');
      await p.click('button:has-text("Save company")'); await p.waitForTimeout(700);
      const cut = await cutOff(p);
      ok((await txt(p, 'h1')) === 'Your company is submitted' && cut.length === 0 && !(await sideways(p)), `${width}px company confirmation: nothing cut off, no sideways scroll: ${cut.join(', ')}`);
      await ctx.close(); }
  }

  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
