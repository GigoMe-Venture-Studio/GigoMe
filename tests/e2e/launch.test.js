// The launch pass: security headers, safe links and redirects, daily limits,
// "Download my data", what the site keeps in the browser, job expiry on the
// dashboard, the admin numbers, the error page and search-engine data.
const { chromium, devices } = require('./lib/browser.js');
const { mock, login, ID, NEBBIA, JOBS } = require('./lib/mock.js');
const { emock, employerLogin } = require('./lib/emock.js');
const { amock } = require('./lib/amock.js');
const { stubMap } = require('./lib/stub.js');
const { readFileSync } = require('fs');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const day = 864e5;
const isoDate = (ms) => { const d = new Date(ms); const z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };

async function downloadJson(p, click) {
  const [dl] = await Promise.all([p.waitForEvent('download'), click()]);
  return { name: dl.suggestedFilename(), data: JSON.parse(readFileSync(await dl.path(), 'utf8')) };
}

(async () => {
  const b = await chromium.launch();

  // ---- Security headers, robots.txt, sitemap
  { const ctx = await b.newContext(desk); await mock(ctx, {}); const p = await ctx.newPage();
    for (const path of ['/', '/jobs/' + ID(1), '/does-not-exist']) {
      const h = (await p.request.get(E + path)).headers();
      const csp = h['content-security-policy'] || '';
      ok(/default-src 'self'/.test(csp) && /connect-src 'self' https:\/\/testproj\.supabase\.co https:\/\/tiles\.openfreemap\.org https:\/\/nominatim\.openstreetmap\.org https:\/\/cloudflareinsights\.com;/.test(csp), path + ': CSP with the build\'s Supabase origin: ' + csp);
      ok(/frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp) && /script-src 'self' https:\/\/challenges\.cloudflare\.com https:\/\/static\.cloudflareinsights\.com;/.test(csp) && !/unsafe-inline|unsafe-eval|\*/.test(csp), path + ': no inline scripts, no wildcards, no framing');
      ok(h['referrer-policy'] === 'strict-origin-when-cross-origin' && h['x-content-type-options'] === 'nosniff' && h['x-frame-options'] === 'DENY', path + ': Referrer-Policy, nosniff, X-Frame-Options');
      ok(/^geolocation=\(self\), camera=\(\), microphone=\(\)/.test(h['permissions-policy'] || ''), path + ': Permissions-Policy: location only for our own pages');
    }
    const robots = await (await p.request.get(E + '/robots.txt')).text();
    ok(/Disallow: \/account/.test(robots) && /Disallow: \/admin/.test(robots) && /Sitemap: https:\/\/gigome\.org\/sitemap\.xml/.test(robots), 'robots.txt');
    const sitemap = await (await p.request.get(E + '/sitemap.xml')).text();
    ok(['/', '/jobs', '/employers', '/privacy', '/terms'].every((x) => sitemap.includes(`<loc>https://gigome.org${x}</loc>`)) && !sitemap.includes('/account'), 'sitemap: the fixed pages');
    await ctx.close(); }

  // ---- Titles, descriptions and JobPosting data
  { const ctx = await b.newContext(desk); await mock(ctx, {}); await stubMap(ctx); const p = await ctx.newPage();
    const meta = () => p.evaluate(() => ({ title: document.title, desc: (document.querySelector('meta[name=description]') || {}).content,
      canonical: (document.querySelector('link[rel=canonical]') || {}).href || null, robots: (document.querySelector('meta[name=robots]') || {}).content || null,
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent) }));
    await p.goto(E + '/'); await p.waitForTimeout(500);
    let m = await meta();
    ok(m.title === 'GigoMe: part-time work and internships in Milan, in English' && m.canonical === 'https://gigome.org/' && !m.robots, 'home: title and canonical: ' + JSON.stringify(m));
    await p.goto(E + '/jobs?area=3'); await p.waitForSelector('.job-list .role-row'); m = await meta();
    ok(m.title === 'Jobs in Milan in English | GigoMe' && m.canonical === 'https://gigome.org/jobs' && /Filter by area/.test(m.desc), '/jobs: title, description, canonical without the filters: ' + JSON.stringify(m));
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.facts'); await p.waitForTimeout(300); m = await meta();
    ok(m.title === 'Weekend barista at Nebbia Coffee Bar | GigoMe' && /^Weekend barista at Nebbia Coffee Bar, Milan\. Serve coffee/.test(m.desc), 'job page: title and description: ' + JSON.stringify(m));
    ok(m.ld.length === 1, 'job page: one JSON-LD block');
    const ld = JSON.parse(m.ld[0]);
    ok(ld['@type'] === 'JobPosting' && ld.title === 'Weekend barista' && ld.employmentType === 'PART_TIME' && ld.hiringOrganization.name === 'Nebbia Coffee Bar' && ld.datePosted, 'JobPosting: title, type, company, date: ' + m.ld[0].slice(0, 200));
    ok(ld.baseSalary && ld.baseSalary.currency === 'EUR' && ld.baseSalary.value.value === 11 && ld.baseSalary.value.unitText === 'HOUR', 'JobPosting: pay €11 an hour');
    ok(ld.jobLocation && ld.jobLocation.address.addressLocality === 'Milano' && ld.jobLocation.geo && ld.jobLocation.geo.latitude === 45.47612 && !ld.jobLocationType, 'JobPosting: place with its point');
    await p.goto(E + '/jobs/' + ID(2)); await p.waitForSelector('.facts'); await p.waitForTimeout(300); m = await meta();
    const ld2 = JSON.parse(m.ld[0]);
    ok(ld2.jobLocationType === 'TELECOMMUTE' && ld2.employmentType === 'INTERN' && !ld2.baseSalary, 'JobPosting: remote internship, no structured pay: ' + m.ld[0].slice(0, 300));
    await p.goto(E + '/jobs/' + ID(3)); await p.waitForSelector('.facts'); await p.waitForTimeout(300); m = await meta();
    ok(!JSON.parse(m.ld[0]).baseSalary, 'JobPosting: paid per project: no baseSalary');
    await p.goto(E + '/companies/' + NEBBIA.id); await p.waitForSelector('.company-page'); await p.waitForTimeout(300); m = await meta();
    ok(m.title === 'Nebbia Coffee Bar: jobs in Milan | GigoMe' && m.ld.length === 0, 'company page: title, no job data left over: ' + JSON.stringify(m.title));
    await p.goto(E + '/employers'); await p.waitForTimeout(300); m = await meta();
    ok(m.title === 'Hire international students in Milan | GigoMe', 'employers: title');
    await p.goto(E + '/saved'); await p.waitForTimeout(300); m = await meta();
    ok(m.robots === 'noindex' && !m.canonical, 'private pages: noindex: ' + JSON.stringify(m));
    await p.goto(E + '/nothing-here'); await p.waitForTimeout(300); m = await meta();
    ok(m.title === 'Page not found | GigoMe' && m.robots === 'noindex', '404: title, noindex');
    // a job description trying to close the JSON-LD block
    const before = JOBS[0].description; JOBS[0].description = 'Fun job </script><script>window.pwned=1</script>';
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.facts'); await p.waitForTimeout(400); m = await meta();
    ok(m.ld.length === 1 && !m.ld[0].includes('</script>') && JSON.parse(m.ld[0]).description.includes('</script>') && !(await p.evaluate(() => window.pwned)), 'JSON-LD: "<" escaped, nothing runs');
    JOBS[0].description = before;
    await ctx.close(); }

  // ---- Apply: only http(s) links are opened, only plain emails linked
  { const ctx = await b.newContext(desk); const log = await mock(ctx, {}); const p = await ctx.newPage();
    await ctx.route('https://testproj.supabase.co/rest/v1/rpc/reveal_job_contact', (r) =>
      r.fulfill({ contentType: 'application/json', body: JSON.stringify([{ apply_url: 'javascript:alert(document.cookie)', apply_email: 'jobs@x.it?bcc=all@x.it' }]) }));
    await p.goto(E + '/login?next=' + encodeURIComponent('/jobs/' + ID(1))); await login(p); await p.waitForSelector('.facts');
    const pages = ctx.pages().length;
    await p.click('button:has-text("Apply")'); await p.waitForTimeout(800);
    ok(ctx.pages().length === pages, 'a javascript: link never opens a tab (the blank tab is closed again)');
    ok(await p.locator('a[href^="javascript:"]').count() === 0, 'no javascript: link on the page');
    ok(await p.locator('a[href^="mailto:jobs@x.it"]').count() === 0 && (await txt(p, '.apply-contact')).includes('jobs@x.it?bcc=all@x.it'), 'an email with ?bcc= is shown as text, never linked');
    await ctx.close(); }

  // ---- Login redirects stay on this site
  for (const next of ['//evil.example/x', '/\\evil.example', 'https://evil.example', '/%5Cevil.example', '/\t/evil.example']) {
    const ctx = await b.newContext(desk); await mock(ctx, {}); const p = await ctx.newPage();
    await p.goto(E + '/login?next=' + encodeURIComponent(next)); await login(p); await p.waitForTimeout(600);
    const u = new URL(p.url());
    // Ending on a page of this site (at worst its 404 page) is fine; leaving it isn't.
    ok(u.host === '127.0.0.1:4402' && u.pathname.startsWith('/') && !u.pathname.startsWith('//') && !u.pathname.includes('\\'), `next=${JSON.stringify(next)} stays on the site: ${p.url()}`);
    await ctx.close();
  }
  { const ctx = await b.newContext(desk); await mock(ctx, {}); const p = await ctx.newPage();
    await p.goto(E + '/login?next=' + encodeURIComponent('/jobs?area=3&when=weekends')); await login(p); await p.waitForTimeout(600);
    ok(p.url() === E + '/jobs?area=3&when=weekends', 'a path on the site is kept, query included: ' + p.url());
    await ctx.close(); }

  // ---- Daily limits: the database's message is shown
  { const ctx = await b.newContext(desk); await mock(ctx, { feedbackLimit: true, saveLimit: true }); const p = await ctx.newPage();
    await p.goto(E + '/login?next=/jobs'); await login(p); await p.waitForSelector('.job-list .role-row');
    await p.click('.footer-link-btn'); await p.fill('.feedback-text', 'One more idea'); await p.click('dialog button[type=submit]'); await p.waitForTimeout(600);
    ok((await txt(p, 'dialog .err')).startsWith('Daily limit reached: you can send feedback up to 20 times a day.'), 'feedback: limit message: ' + await txt(p, 'dialog .err'));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    await p.locator('.save-btn').first().click(); await p.waitForTimeout(600);
    ok((await txt(p, '.save-err')).startsWith('Daily limit reached: you can save jobs'), 'save: limit message: ' + await txt(p, '.save-err'));
    await ctx.close(); }

  // ---- Download my data (student) and what's kept in the browser
  { const ctx = await b.newContext(desk);
    const log = await mock(ctx, { saved: [ID(1)], opened: [{ job_id: ID(5), title: 'English tutor', company_name: 'Nebbia Coffee Bar', opened_at: new Date().toISOString(), live: true }],
      clicks: [{ job_id: ID(5), created_at: new Date().toISOString() }], myFeedback: [{ page: '/jobs', message: 'Nice map', created_at: new Date().toISOString() }],
      myReports: [{ job_id: ID(3), job_title: 'Event host', reason: 'misleading', details: 'Pay unclear', status: 'open', created_at: new Date().toISOString() }] });
    await stubMap(ctx, log); const p = await ctx.newPage();
    await p.goto(E + '/login?next=/account'); await login(p); await p.waitForSelector('.account-data-btn');
    ok((await txt(p, '.account-data')).includes('saved searches, companies you follow, the jobs you opened'), 'student: says what the file holds');
    const { name, data } = await downloadJson(p, () => p.click('.account-data-btn'));
    ok(/^gigome-my-data-\d{4}-\d\d-\d\d\.json$/.test(name), 'file name: ' + name);
    ok(data.account.email === 'ana@studbocconi.it' && data.profile.full_name === 'Ana Rossi' && data.profile.university === 'Bocconi University', 'account and profile');
    ok(['saved_jobs', 'saved_searches', 'companies_followed', 'apply_clicks', 'jobs_opened', 'feedback_sent', 'jobs_reported'].every((k) => Array.isArray(data[k])), 'every student list is there: ' + Object.keys(data).join(','));
    ok(data.feedback_sent[0].message === 'Nice map' && data.jobs_reported[0].details === 'Pay unclear' && data.apply_clicks.length === 1 && data.jobs_opened.length === 1, 'their feedback, reports, clicks and opened jobs');
    ok(!('company' in data) && !('jobs' in data), 'no company section for a student');
    ok((await txt(p, '.account-data .account-saved')) === 'Your file has been downloaded.', 'confirmation');
    // what the site keeps in the browser, after login, a map and the Metro toggle
    await p.goto(E + '/jobs?view=map'); await p.waitForSelector('.jobs-map[data-state=ready]'); await p.click('.metro-toggle-btn'); await p.waitForTimeout(400);
    const kept = await p.evaluate(async () => ({ cookies: document.cookie, local: Object.keys(localStorage), session: Object.keys(sessionStorage),
      caches: 'caches' in window ? await caches.keys() : [], idb: indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : [] }));
    const cookies = await ctx.cookies();
    ok(kept.cookies === '' && cookies.length === 0, 'no cookies: ' + JSON.stringify(cookies));
    ok(kept.local.length === 1 && /^sb-testproj-auth-token$/.test(kept.local[0]), 'localStorage: only the login session: ' + kept.local);
    ok(kept.session.every((k) => ['gigome.metro', 'gigome.login.pending', 'gigome.login.pending.employer'].includes(k)), 'sessionStorage: per-tab only: ' + kept.session);
    ok(kept.caches.length === 0 && kept.idb.length === 0, 'no Cache Storage, no IndexedDB: ' + JSON.stringify(kept));
    await ctx.close(); }

  // ---- Company: download, expiry, "Extend by 60 days", the 60-day limit in the form
  { const ctx = await b.newContext(desk);
    const { log } = await emock(ctx, { company: { name: 'Nebbia', status: 'approved', website: 'https://nebbia.it' },
      jobs: [{ title: 'Barista', job_type: 'part_time', hours_per_week: 10, status: 'published', expires_at: new Date(Date.now() + 5 * day + 3600e3).toISOString() },
             { title: 'Host', job_type: 'gig', hours_per_week: 5, status: 'published', expires_at: new Date(Date.now() + 40 * day + 3600e3).toISOString() },
             { title: 'Draft one', job_type: 'gig', hours_per_week: 5, status: 'draft' },
             { title: 'Recently expired', job_type: 'gig', hours_per_week: 5, status: 'published', expires_at: new Date(Date.now() - 5 * day).toISOString() },
             { title: 'Long expired', job_type: 'gig', hours_per_week: 5, status: 'published', expires_at: new Date(Date.now() - 30 * day).toISOString() }] });
    const p = await ctx.newPage(); await employerLogin(p, E); await p.goto(E + '/dashboard'); await p.waitForSelector('.dash-job');
    const row = (t) => p.locator('.dash-job', { hasText: t });
    ok((await row('Barista').locator('.dash-expiry').innerText()) === 'Expires in 5 days' && await row('Barista').locator('.dash-expiry-soon').count() === 1, 'live job: "Expires in 5 days", highlighted in its last week');
    ok((await row('Host').locator('.dash-expiry').innerText()) === 'Expires in 40 days' && await row('Host').locator('.dash-expiry-soon').count() === 0, '"Expires in 40 days", not highlighted');
    ok(await row('Draft one').locator('.dash-expiry').count() === 0 && await row('Draft one').locator('text=Extend by 60 days').count() === 0, 'a draft has neither');
    await row('Barista').locator('button:has-text("Extend by 60 days")').click(); await p.waitForTimeout(800);
    ok(log.req.some((x) => x.path === '/rest/v1/rpc/extend_my_job'), 'calls extend_my_job');
    ok(/^"Barista" is now shown until \d+ \w+ \d{4}\.$/.test(await txt(p, '.dash-action-done')), 'confirmation: ' + await txt(p, '.dash-action-done'));
    ok(/^Expires in (59|60) days$/.test(await row('Barista').locator('.dash-expiry').innerText()), 'now about 60 days: ' + await row('Barista').locator('.dash-expiry').innerText());
    ok((await row('Barista').innerText()).includes('Live'), 'still live, no new review');
    // Expired at most 14 days ago: still "Extend by 60 days"; longer ago: back to review.
    ok((await row('Recently expired').innerText()).includes('You can still extend it until') && await row('Recently expired').locator('button:has-text("Extend by 60 days")').count() === 1,
      'expired 5 days ago: can still be extended, with the last day shown');
    const old = await row('Long expired').innerText();
    ok(await row('Long expired').locator('button:has-text("Extend by 60 days")').count() === 0 && old.includes("It expired more than 14 days ago, so it can't be extended any more.") && old.includes('submit it for review'),
      'expired 30 days ago: no Extend button, a clear message: ' + JSON.stringify(old));
    ok(await row('Long expired').locator('a:has-text("Edit")').count() === 1, 'expired 30 days ago: Edit is there to resubmit it');
    await row('Recently expired').locator('button:has-text("Extend by 60 days")').click(); await p.waitForTimeout(800);
    ok(/^Expires in (59|60) days$/.test(await row('Recently expired').locator('.dash-expiry').first().innerText()) && (await row('Recently expired').innerText()).includes('Live'), 'the recently expired job is live again for 60 days');
    await p.goto(E + '/dashboard/jobs/new'); await p.waitForSelector('input[name=expires_at]');
    ok(await p.getAttribute('input[name=expires_at]', 'max') === isoDate(Date.now() + 60 * day), 'job form: "Show until" at most 60 days ahead: ' + await p.getAttribute('input[name=expires_at]', 'max'));
    await p.goto(E + '/account'); await p.waitForSelector('.account-data-btn');
    ok((await txt(p, '.account-data')).includes('your company, its jobs with how to apply'), 'company: says what the file holds');
    const { data } = await downloadJson(p, () => p.click('.account-data-btn'));
    ok(data.company && data.company.name === 'Nebbia' && data.company.contact_email === 'owner@cafe.it', 'company with its contact email');
    ok(Array.isArray(data.jobs) && data.jobs.length === 5 && 'how_to_apply' in data.jobs[0] && 'apply_clicks' in data.jobs[0] && data.followers === 3, 'its jobs with how to apply, clicks, followers');
    ok(!('saved_jobs' in data), 'no student lists for a company');
    await ctx.close(); }

  // ---- Admin numbers
  { const ctx = await b.newContext(desk); const { log } = await amock(ctx, { admin: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/admin'); await p.waitForSelector('.admin-stats-list');
    await p.waitForTimeout(400);
    const stats = await p.$$eval('.admin-stats-list > div', (d) => d.map((x) => x.innerText.replace(/\n+/g, ': ')));
    ok(stats.join(' | ') === 'Students registered: 41 | Companies approved: 7 | Companies with a live job: 5 | Live jobs: 12 | Apply clicks this week: 33 | Students who clicked this week: 19', 'the six numbers: ' + stats.join(' | '));
    ok(log.rpcs.some(([n]) => n === 'admin_stats'), 'read through admin_stats()');
    await ctx.close(); }
  { const ctx = await b.newContext(devices['iPhone 13']); await amock(ctx, { admin: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/admin'); await p.waitForSelector('.admin-stats-list');
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: numbers fit the width');
    await ctx.close(); }

  // ---- A page that fails: the error page, with the header and feedback still working
  { const ctx = await b.newContext(desk); await mock(ctx, {}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await ctx.route(/\/assets\/JobsMap-[^/]*\.js$/, (r) => r.abort());
    await p.goto(E + '/jobs?view=map'); await p.waitForSelector('.error-page', { timeout: 8000 }).catch(() => {});
    ok((await txt(p, '.error-page h1')) === 'Something went wrong', 'error page instead of a blank screen');
    ok(await p.locator('.site-header').isVisible() && await p.locator('.error-page button:has-text("Reload the page")').isVisible(), 'header and "Reload the page" shown');
    await p.click('.error-page button:has-text("tell us what you were doing")'); await p.waitForTimeout(300);
    ok(await p.locator('dialog[open]').count() === 1, 'the feedback form opens from the error page');
    await p.keyboard.press('Escape');
    await p.click('.site-header a[href="/jobs"]'); await p.waitForTimeout(800);
    ok(await p.locator('.error-page').count() === 0 && await p.locator('.job-list .role-row').count() > 0, 'another page works again');
    await ctx.close(); }

  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
})();
