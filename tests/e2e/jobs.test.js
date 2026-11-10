const { OUT } = require('./lib/browser.js');
const { chromium, devices } = require('./lib/browser.js');
const ENV = 'http://127.0.0.1:4302', NOENV = 'http://127.0.0.1:4301', SB = 'https://testproj.supabase.co';
const SHOTS = require('./lib/browser.js').OUT + '/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
const ID = (n) => '00000000-0000-4000-8000-00000000000' + n;
const NEBBIA = { name: 'Nebbia Coffee Bar', status: 'approved', website: 'nebbia-example.it', description: 'Specialty coffee bar.\nInternational crowd.' };
const FINTRA = { name: 'Fintra', status: 'approved', website: 'https://fintra.example/', description: null };
const JOBS = [
  { id: ID(1), title: 'Weekend barista', job_type: 'part_time', location: 'Porta Venezia', remote: false, hours_per_week: 12, pay: '€11/h', italian_level: 'none', start_date: '2026-12-01', created_at: ago(0), description: 'Serve coffee.\nLearn latte art.', companies: NEBBIA },
  { id: ID(2), title: 'Finance intern', job_type: 'internship', location: 'Porta Romana', remote: true, hours_per_week: 20, pay: null, italian_level: 'basic', start_date: null, created_at: ago(2), description: null, companies: FINTRA },
  { id: ID(3), title: 'Event host', job_type: 'gig', location: null, remote: false, hours_per_week: 8, pay: '€90/day', italian_level: 'fluent', start_date: null, created_at: ago(5), description: 'One evening.', companies: NEBBIA },
  { id: ID(4), title: 'Remote researcher', job_type: 'other', location: null, remote: true, hours_per_week: 40, pay: '€500', italian_level: 'none', start_date: null, created_at: ago(9), description: 'Desk research.', companies: FINTRA }
];
const CONTACT = { [ID(1)]: { apply_url: 'https://nebbia-example.it/jobs', apply_email: 'jobs@nebbia-example.it' }, [ID(3)]: { apply_url: null, apply_email: 'host@nebbia-example.it' } };

function applyFilters(url, rows) {
  const p = url.searchParams; let out = rows.slice();
  const f = (k, fn) => { for (const v of p.getAll(k)) out = out.filter((r) => fn(v, r)); };
  f('status', (v) => v === 'eq.published'); f('companies.status', (v, r) => v === 'eq.approved' && r.companies.status === 'approved');
  f('expires_at', (v) => v.startsWith('gt.'));
  f('id', (v, r) => r.id === v.slice(3));
  f('job_type', (v, r) => r.job_type === v.slice(3));
  f('remote', (v, r) => String(r.remote) === v.slice(3));
  f('italian_level', (v, r) => v.startsWith('in.') ? v.slice(4, -1).split(',').includes(r.italian_level) : r.italian_level === v.slice(3));
  f('hours_per_week', (v, r) => r.hours_per_week <= Number(v.slice(4)));
  if ((p.get('order') || '').startsWith('created_at.desc')) out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return out;
}

async function mock(ctx, opts = {}) {
  const log = { rpc: [], jobsQueries: [] };
  const profile = { full_name: opts.fullName === undefined ? 'Ana Rossi' : opts.fullName, degree_level: 'master', graduation_year: 2028, account_type: opts.accountType || 'student' };
  await ctx.route(SB + '/**', async (r) => {
    const req = r.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
    const j = (s, b) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (path === '/rest/v1/jobs') {
      log.jobsQueries.push(url.search);
      if (opts.jobsFail) return j(500, { message: 'boom' });
      const rows = applyFilters(url, opts.noJobs ? [] : JOBS);
      const single = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
      return j(200, single ? (rows[0] || null) : rows);
    }
    if (path === '/rest/v1/rpc/reveal_job_contact') {
      const body = req.postDataJSON(); log.rpc.push(body);
      if (profile.account_type !== 'student') return j(403, { code: '42501', message: 'Only student accounts can see how to apply.' });
      return j(200, CONTACT[body.p_job_id] ? [CONTACT[body.p_job_id]] : []);
    }
    if (path === '/rest/v1/universities') return j(200, [{ id: 'u', name: 'B', email_domains: ['studbocconi.it'] }]);
    if (path === '/auth/v1/otp') return j(200, {});
    if (path === '/auth/v1/verify') { const exp = Math.floor(Date.now() / 1000) + 3600; return j(200, { access_token: b64({ alg: 'HS256' }) + '.' + b64({ sub: 'u1', exp }) + '.s', token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user: { id: 'u1', aud: 'authenticated', email: 'ana@studbocconi.it', app_metadata: {}, user_metadata: {} } }); }
    if (path === '/rest/v1/profiles' && method === 'GET') { const single = /vnd\.pgrst\.object/.test(req.headers()['accept'] || ''); return j(200, single ? profile : [profile]); }
    if (path === '/rest/v1/profiles' && method === 'PATCH') { Object.assign(profile, req.postDataJSON()); return r.fulfill({ status: 204, body: '' }); }
    return r.fulfill({ status: 204, body: '' });
  });
  return log;
}

(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts = {}, device = devices['iPhone 13']) => {
    const ctx = await b.newContext({ ...device, reducedMotion: 'reduce' }); const log = await mock(ctx, opts); const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource|Missing VITE/.test(m.text())) errs.push(m.text()); });
    return { ctx, p, log };
  };
  const txt = async (p, s) => ((await p.textContent(s)) || '').replace(/\s+/g, ' ').trim();
  const titles = (p) => p.$$eval('.job-list .role-title', (els) => els.map((e) => e.textContent));
  const login = async (p) => { await p.fill('input[name=email]', 'ana@studbocconi.it'); await p.click('text=Send me a code'); await p.waitForTimeout(300); await p.fill('input[name=code]', '123456'); await p.waitForTimeout(900); };

  // List, newest first, card contents
  { const { ctx, p } = await mk();
    await p.goto(ENV + '/jobs'); await p.waitForTimeout(500);
    ok((await titles(p)).join('|') === 'Weekend barista|Finance intern|Event host|Remote researcher', 'list newest first: ' + (await titles(p)).join(', '));
    ok((await txt(p, '.jobs-status')).startsWith('4 jobs'), 'count shown');
    const card = await txt(p, '.job-list li:first-child');
    ok(['Weekend barista', 'Nebbia Coffee Bar', 'No Italian needed', 'Part-time', 'Porta Venezia', '12 h/week', '€11/h', 'Today'].every((w) => card.includes(w)), 'card: title, company, Italian, type, location, hours, pay: ' + card);
    const card2 = await txt(p, '.job-list li:nth-child(2)');
    ok(card2.includes('Remote or Porta Romana') && card2.includes('Pay not listed') && card2.includes('Basic Italian'), 'remote + location, missing pay: ' + card2);
    ok((await txt(p, '.job-list li:nth-child(4)')).includes('Remote ·') || (await txt(p, '.job-list li:nth-child(4)')).includes('Remote'), 'remote only');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on phone (/jobs)');
    await p.screenshot({ path: SHOTS + 'jobs-phone.png', fullPage: true });
    // Filters apply instantly and go in the URL
    await p.click('.job-filters-toggle'); // phones: the filters are folded behind "Filters"
    await p.selectOption('select[name=italian]', 'none'); await p.waitForTimeout(300);
    ok(new URL(p.url()).search === '?italian=none' && (await titles(p)).join('|') === 'Weekend barista|Remote researcher', 'Italian "No Italian needed": URL ?italian=none, 2 jobs');
    await p.selectOption('select[name=hours]', '15'); await p.waitForTimeout(300);
    ok(new URL(p.url()).searchParams.get('hours') === '15' && (await titles(p)).join('|') === 'Weekend barista', 'plus up to 15 hours: 1 job');
    await p.selectOption('select[name=remote]', 'yes'); await p.waitForTimeout(300);
    ok((await txt(p, '.empty-state strong')) === 'No jobs match these filters.' && (await txt(p, '.empty-state .muted')) === 'Try removing one: Italian, remote or hours per week.', 'no matches: advice names the filters that are set: ' + await txt(p, '.empty-state'));
    await p.click('.empty-state >> text=Clear filters'); await p.waitForTimeout(300);
    ok(new URL(p.url()).search === '' && (await titles(p)).length === 4, 'clear filters: all jobs, clean URL');
    await p.selectOption('select[name=italian]', 'basic'); await p.waitForTimeout(300);
    ok((await titles(p)).join('|') === 'Weekend barista|Finance intern|Remote researcher', 'Italian "basic at most" includes none and basic');
    await p.selectOption('select[name=italian]', ''); await p.selectOption('select[name=type]', 'gig'); await p.waitForTimeout(300);
    ok((await titles(p)).join('|') === 'Event host', 'type filter');
    await ctx.close(); }

  // Shared filtered URL, and bad values ignored
  { const { ctx, p } = await mk({}, { viewport: { width: 1280, height: 900 } });
    await p.goto(ENV + '/jobs?italian=none&remote=yes'); await p.waitForTimeout(500);
    ok((await titles(p)).join('|') === 'Remote researcher' && (await p.inputValue('select[name=italian]')) === 'none' && (await p.inputValue('select[name=remote]')) === 'yes', 'opening a shared filtered link sets the filters');
    await p.goto(ENV + '/jobs?type=evil&hours=99&remote=maybe'); await p.waitForTimeout(500);
    ok((await titles(p)).length === 4, 'unknown filter values are ignored');
    ok((await p.getAttribute('.site-header .main-nav a:first-child', 'aria-current')) === 'page' && (await p.getAttribute('.site-header .main-nav a:first-child', 'href')) === '/jobs', 'header Jobs points to /jobs and is marked current');
    await p.screenshot({ path: SHOTS + 'jobs-desk.png', fullPage: true });
    await p.click('.job-list li:first-child a'); await p.waitForTimeout(500);
    ok(new URL(p.url()).pathname === '/jobs/' + ID(1), 'card opens the job page');
    const d = await txt(p, 'main');
    ok(['Weekend barista', 'Nebbia Coffee Bar', 'Part-time', 'No Italian needed', '€11/h', '12 h/week', 'Porta Venezia', '1 December 2026', 'Serve coffee.', 'Specialty coffee bar.'].every((w) => d.includes(w)), 'job page: everything from the card plus start date, description, company');
    ok((await p.getAttribute('a[href^="https://nebbia"]', 'href')) === 'https://nebbia-example.it' && (await txt(p, 'a[href^="https://nebbia"]')) === 'nebbia-example.it', 'company website gets https:// and opens');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.job-text')).whiteSpace) === 'pre-line', 'line breaks in descriptions are kept');
    ok((await p.getAttribute('.site-header .main-nav a:first-child', 'aria-current')) === 'page', 'Jobs marked current on a job page');
    await p.screenshot({ path: SHOTS + 'job-desk-out.png', fullPage: true });
    await ctx.close(); }

  // Logged out -> log in -> back on the same job -> reveal (counts once)
  { const { ctx, p, log } = await mk({ fullName: null });
    await p.goto(ENV + '/jobs/' + ID(1)); await p.waitForTimeout(500);
    ok((await txt(p, '.apply')).includes('Log in with your university email to see how to apply') && log.rpc.length === 0, 'logged out: log-in prompt, nothing revealed');
    await p.click('.apply >> text=Log in to see how to apply'); await p.waitForTimeout(400);
    ok(new URL(p.url()).pathname === '/login' && new URL(p.url()).searchParams.get('next') === '/jobs/' + ID(1), 'goes to /login?next=/jobs/<id>');
    await login(p);
    ok(new URL(p.url()).pathname === '/welcome' && new URL(p.url()).searchParams.get('next') === '/jobs/' + ID(1), 'first login: /welcome keeps the way back');
    await p.fill('input[name=full_name]', 'Ana Rossi'); await p.selectOption('select[name=degree_level]', 'master'); await p.selectOption('select[name=graduation_year]', String(new Date().getFullYear() + 1));
    await p.click('text=Save and continue'); await p.waitForTimeout(800);
    ok(new URL(p.url()).pathname === '/jobs/' + ID(1), 'after /welcome, back on the same job');
    ok(log.rpc.length === 0 && await p.locator('.apply button:has-text("Apply")').count() === 1 && await p.locator('.apply >> text=How to apply').count() === 0, 'student sees one "Apply" button; nothing counted yet');
    await p.reload(); await p.waitForTimeout(700);
    ok(log.rpc.length === 0, 'reloading the page counts nothing');
    await ctx.route('https://nebbia-example.it/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Nebbia jobs</title>ok' }));
    const [tab] = await Promise.all([ctx.waitForEvent('page'), p.click('.apply button:has-text("Apply")')]);
    await tab.waitForURL('https://nebbia-example.it/jobs', { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(300);
    ok(log.rpc.length === 1 && log.rpc[0].p_job_id === ID(1), 'Apply calls reveal_job_contact once with the job id');
    ok(tab.url() === 'https://nebbia-example.it/jobs', 'link and email: the application page opens in a new tab (the link wins): ' + tab.url());
    ok(await tab.evaluate(() => window.opener === null), 'the new tab has no opener (no tabnabbing)');
    await tab.close();
    ok((await p.getAttribute('.apply a.btn', 'href')) === 'https://nebbia-example.it/jobs' && (await p.getAttribute('.apply a.btn', 'rel')).includes('noopener') && (await txt(p, '.apply')).includes('jobs@nebbia-example.it'), 'the link and the email are still shown underneath');
    ok((await p.getAttribute('.apply a.apply-email', 'href')) === 'mailto:jobs@nebbia-example.it?subject=' + encodeURIComponent('Application: Weekend barista (via GigoMe)'), 'email link has the subject');
    ok((await txt(p, '.apply')).includes("If it didn't, use the link below."), 'explains what to do if nothing opened');
    await p.screenshot({ path: SHOTS + 'job-phone-revealed.png', fullPage: true });
    await p.goto(ENV + '/jobs/' + ID(3)); await p.waitForTimeout(500);
    const title3 = await txt(p, 'h1');
    await p.click('.apply button:has-text("Apply")'); await p.waitForTimeout(800);
    ok(ctx.pages().length === 1, 'email only: the extra tab is closed again');
    ok((await txt(p, '.apply')).includes('host@nebbia-example.it') && await p.locator('.apply a.btn').count() === 0, 'email-only contact shown');
    ok((await p.getAttribute('.apply a.apply-email', 'href')) === 'mailto:host@nebbia-example.it?subject=' + encodeURIComponent('Application: ' + title3 + ' (via GigoMe)'), 'email-only: mailto with "Application: <title> (via GigoMe)"');
    ok((await txt(p, '.apply')).includes('Your email app should have opened'), 'email-only: says the email app should have opened');
    await p.goto(ENV + '/jobs/' + ID(2)); await p.waitForTimeout(500); await p.click('.apply button:has-text("Apply")'); await p.waitForTimeout(500);
    ok((await txt(p, '.apply')).includes("hasn't added how to apply yet"), 'no contact set: friendly note');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on phone (job page)');
    await ctx.close(); }

  // Returning student goes straight back to the job; unsafe next ignored
  { const { ctx, p } = await mk();
    await p.goto(ENV + '/login?next=' + encodeURIComponent('/jobs/' + ID(2))); await p.waitForTimeout(300); await login(p);
    ok(new URL(p.url()).pathname === '/jobs/' + ID(2), 'returning student: straight back to the job');
    await ctx.close(); }
  for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example']) {
    const { ctx, p } = await mk();
    await p.goto(ENV + '/login?next=' + encodeURIComponent(bad)); await p.waitForTimeout(300); await login(p);
    ok(new URL(p.url()).origin === ENV && new URL(p.url()).pathname === '/', 'unsafe next ' + bad + ' is ignored');
    await ctx.close();
  }

  // Pop-up blocked: the contact is still there to use
  { const { ctx, p, log } = await mk();
    await ctx.addInitScript(() => { window.open = () => null; });
    await p.goto(ENV + '/login'); await p.waitForTimeout(300); await login(p);
    await p.goto(ENV + '/jobs/' + ID(1)); await p.waitForTimeout(600);
    await p.click('.apply button:has-text("Apply")'); await p.waitForTimeout(600);
    ok(log.rpc.length === 1 && (await p.getAttribute('.apply a.btn', 'href')) === 'https://nebbia-example.it/jobs' && (await txt(p, '.apply')).includes("If it didn't, use the link below."), 'pop-up blocked: one apply click, the link is shown to open by hand');
    await ctx.close(); }

  // Company account
  { const { ctx, p, log } = await mk({ accountType: 'company' });
    await p.goto(ENV + '/login'); await p.waitForTimeout(300); await login(p);
    await p.goto(ENV + '/jobs/' + ID(1)); await p.waitForTimeout(700);
    ok((await txt(p, '.apply')).includes('Only students can apply') && await p.locator('.apply button').count() === 0 && log.rpc.length === 0, 'company account: note, no button, nothing revealed');
    await ctx.close(); }

  // Missing job, empty board, errors, no config
  { const { ctx, p } = await mk();
    await p.goto(ENV + '/jobs/' + ID(9)); await p.waitForTimeout(500);
    ok((await txt(p, 'h1')) === "This job isn't available", 'unknown job: friendly page');
    await p.goto(ENV + '/jobs/not-a-uuid'); await p.waitForTimeout(500);
    ok((await txt(p, 'h1')) === "This job isn't available", 'malformed id: same friendly page');
    await ctx.close(); }
  { const { ctx, p } = await mk({ noJobs: true });
    await p.goto(ENV + '/jobs'); await p.waitForTimeout(500);
    ok((await txt(p, '.empty-state')).startsWith('No jobs yet.'), 'no jobs at all: friendly empty state');
    await ctx.close(); }
  { const { ctx, p } = await mk({ jobsFail: true });
    await p.goto(ENV + '/jobs'); await p.waitForTimeout(500);
    ok((await txt(p, '.empty-state')).includes("We couldn't load the jobs") && await p.locator('.empty-state button', { hasText: 'Try again' }).count() === 1, 'load error: message and Try again');
    await ctx.close(); }
  { const { ctx, p } = await mk();
    await p.goto(NOENV + '/jobs'); await p.waitForTimeout(400);
    ok((await txt(p, 'h1')) === "Jobs can't be shown right now", 'no Supabase settings: clear message on /jobs');
    await ctx.close(); }

  ok(errs.length === 0, 'no JS errors: ' + errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'JOBS ALL PASSED'); await b.close();
})();
