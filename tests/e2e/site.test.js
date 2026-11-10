const { chromium, devices } = require('./lib/browser.js');
const { mock, login, ID } = require('./lib/mock.js');
const ENV = 'http://127.0.0.1:4302', NOENV = 'http://127.0.0.1:4301';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async (opts = {}, dev = devices['iPhone 13']) => { const ctx = await b.newContext({ ...dev, reducedMotion: 'reduce' }); const log = await mock(ctx, opts); const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource|Missing VITE/.test(m.text())) errs.push(m.text()); }); return { ctx, p, log }; };
  const txt = async (p, s) => ((await p.textContent(s)) || '').replace(/\s+/g, ' ').trim();
  const titles = (p) => p.$$eval('.job-list .role-title', (els) => els.map((e) => e.textContent));

  // Home page
  { const { ctx, p, log } = await mk({}, { viewport: { width: 1280, height: 900 } });
    await p.goto(ENV + '/'); await p.waitForTimeout(700);
    const page = await txt(p, 'body');
    ok(await p.locator('.protobar, #map-stage, #jump, #reset-demo, .map-pin').count() === 0 && !/Demo\. Sample data|Jump to|Reset|on the map|★/.test(page), 'no demo bar, map, Jump to, Reset or ratings');
    ok((await txt(p, 'h1')) === 'Part-time work and internships in Milan, in English.' && (await txt(p, '.hero-lead')) === "For international students who don't speak fluent Italian. Free for students, always.", 'hero headline and subline unchanged');
    ok(await p.locator('.hero select#home-area').count() === 1 && await p.isChecked('.hero input[type=checkbox]') && (await txt(p, '.hero button')) === 'Search jobs', 'hero: keyword, area, "No Italian needed" (on), "Search jobs"');
    ok((await titles(p)).join('|') === 'Weekend barista|Finance intern|Event host|Remote researcher|English tutor' && log.jobs.some((q) => q.includes('limit=5')), 'Newest jobs: the 5 newest live jobs, asked for with limit=5');
    ok(await p.locator('.job-list .role-row[href^="/jobs/"]').count() === 5 && (await p.getAttribute('.see-all', 'href')) === '/jobs' && (await txt(p, '.see-all')) === 'See all jobs', 'same cards as /jobs, plus "See all jobs"');
    const how = await txt(p, '.how');
    ok(['Browse jobs', 'university email', '6-digit code', 'Apply directly with the employer', 'Want to list a job? Write to hello@gigome.org.'].every((w) => how.includes(w)), 'How it works matches what GigoMe does');
    ok(!/profile|rating|review|through GigoMe|dashboard|Create an account|Post a role|accept|reject/i.test(how), 'How it works: nothing about profiles, applying through GigoMe, ratings or employer accounts');
    ok((await p.getAttribute('.how a[href^="mailto:"]', 'href')) === 'mailto:hello@gigome.org', 'employer line links to hello@gigome.org');
    await p.fill('#home-q', 'barista'); await p.click('text=Search jobs'); await p.waitForTimeout(800);
    const u = new URL(p.url());
    ok(u.pathname === '/jobs' && u.searchParams.get('q') === 'barista' && u.searchParams.get('italian') === 'none', 'hero search opens /jobs?q=barista&italian=none');
    ok((await p.inputValue('input[name=q]')) === 'barista' && (await p.inputValue('select[name=italian]')) === 'none', '/jobs shows the keyword and Italian filter filled in');
    ok((await titles(p)).join('|') === 'Weekend barista|Social media helper', 'keyword matches title or description, ignoring case: ' + (await titles(p)).join(', '));
    await p.goto(ENV + '/'); await p.waitForTimeout(500); await p.uncheck('.hero input[type=checkbox]'); await p.click('text=Search jobs'); await p.waitForTimeout(600);
    ok(new URL(p.url()).pathname === '/jobs' && new URL(p.url()).search === '', 'empty search without the checkbox opens plain /jobs');
    await ctx.close(); }
  { const { ctx, p } = await mk({ noJobs: true });
    await p.goto(ENV + '/'); await p.waitForTimeout(600);
    ok((await txt(p, '.home-newest')).includes('No jobs yet') && await p.locator('.see-all').count() === 0, 'no jobs: friendly empty state');
    await ctx.close(); }
  { const { ctx, p } = await mk({ jobsFail: true });
    await p.goto(ENV + '/'); await p.waitForTimeout(600);
    ok((await txt(p, '.home-newest')).includes("Jobs can't be shown right now"), 'load error: friendly message');
    await ctx.close(); }
  // A request that never answers (stalled connection): the list gives up
  // after about 15 seconds and offers "Try again", instead of loading for ever.
  { const { ctx, p } = await mk();
    await ctx.route('https://testproj.supabase.co/rest/v1/jobs**', () => {}); // never answered
    const t0 = Date.now(); await p.goto(ENV + '/jobs');
    await p.waitForSelector('.empty-state:has-text("We couldn\'t load the jobs")', { timeout: 25000 }).catch(() => {});
    const waited = (Date.now() - t0) / 1000, msg = await txt(p, 'main');
    ok(msg.includes("We couldn't load the jobs") && waited > 13 && waited < 20 && await p.locator('.empty-state button:has-text("Try again")').count() === 1, `stalled request: the error and "Try again" after ${waited.toFixed(1)}s`);
    await ctx.close(); }
  // Small text buttons: a tap up to 21px above or below the middle still
  // counts (a 44px-tall tap area), on a phone.
  { const { ctx, p } = await mk();
    const tall = (sel) => p.$eval(sel, (el) => { el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2;
      return [-21, 21].every((dy) => { const hit = document.elementFromPoint(x, y + dy); return hit === el || el.contains(hit); }); });
    await p.goto(ENV + '/jobs?q=zzzz'); await p.waitForTimeout(500);
    ok(await tall('.jobs-status button:has-text("Clear filters")') && await tall('.empty-state button:has-text("Clear the keyword")'), '"Clear filters" and the empty state\'s button: 44px tap area');
    await p.goto(ENV + '/login'); await p.fill('input[name=email]', 'ana@studbocconi.it'); await p.click('text=Send me a code'); await p.waitForTimeout(400);
    ok(await tall('button:has-text("Use a different email")'), '"Use a different email": 44px tap area');
    await p.fill('input[name=code]', '123456'); await p.waitForTimeout(900);
    await p.goto(ENV + '/jobs/' + ID(3)); await p.waitForSelector('.report-job button'); // no map on this one
    ok(await tall('.report-job button'), '"Report this job": 44px tap area');
    await ctx.close(); }
  { const { ctx, p } = await mk();
    await p.goto(NOENV + '/'); await p.waitForTimeout(500);
    ok(await p.isVisible('.hero') && await p.isVisible('.how') && (await txt(p, '.home-newest')).includes("can't be shown"), 'no Supabase settings: home still shows hero and How it works');
    await ctx.close(); }

  // Keyword filter on /jobs
  { const { ctx, p, log } = await mk({}, { viewport: { width: 1280, height: 900 } });
    await p.goto(ENV + '/jobs'); await p.waitForTimeout(500);
    await p.locator('input[name=q]').pressSequentially('tutor', { delay: 40 }); await p.waitForTimeout(150);
    ok(new URL(p.url()).searchParams.get('q') === null, 'keyword waits for typing to stop');
    await p.waitForTimeout(500);
    ok(new URL(p.url()).searchParams.get('q') === 'tutor' && (await titles(p)).join('|') === 'English tutor', 'keyword applied after a pause, kept in the URL');
    await p.fill('input[name=q]', ''); await p.locator('input[name=q]').pressSequentially('weekend ', { delay: 40 }); await p.waitForTimeout(600);
    ok((await p.inputValue('input[name=q]')) === 'weekend ' && new URL(p.url()).searchParams.get('q') === 'weekend', 'a trailing space is not eaten while typing');
    await p.fill('input[name=q]', 'researcher'); await p.press('input[name=q]', 'Enter'); await p.waitForTimeout(250);
    ok((await titles(p)).join('|') === 'Remote researcher', 'Enter applies the keyword at once');
    await p.fill('input[name=q]', 'x,title.eq.y)'); await p.press('input[name=q]', 'Enter'); await p.waitForTimeout(400);
    const lastOr = new URLSearchParams(log.jobs.at(-1)).get('or');
    ok(!log.badQuery && lastOr === '(title.ilike."*x title eq y*",description.ilike."*x title eq y*")', 'characters that could change the query are dropped: ' + lastOr);
    const empty = await txt(p, '.empty-state');
    ok(empty.includes('No jobs match “x title eq y”.') && empty.includes('Check the spelling') && !empty.includes('filter'), 'keyword only, no match: advice about the keyword, nothing about filters: ' + empty);
    await p.click('.empty-state >> text=Clear the keyword'); await p.waitForTimeout(400);
    ok((await p.inputValue('input[name=q]')) === '' && (await titles(p)).length === 6, '"Clear the keyword" shows every job again');
    await p.goto(ENV + '/jobs?q=barista&type=internship&minpay=20'); await p.waitForTimeout(500);
    ok((await txt(p, '.empty-state strong')) === 'No jobs match “barista” with these filters.' && (await txt(p, '.empty-state .muted')) === 'Try another keyword, or remove a filter: type of job or minimum pay.', 'keyword and filters, no match: names the filters that are set: ' + await txt(p, '.empty-state'));
    await p.goto(ENV + '/jobs?type=internship&remote=no'); await p.waitForTimeout(500);
    ok((await txt(p, '.empty-state strong')) === 'No jobs match these filters.' && (await txt(p, '.empty-state .muted')) === 'Try removing one: type of job or remote.', 'filters only: names them: ' + await txt(p, '.empty-state'));
    await p.goto(ENV + '/jobs?minpay=30'); await p.waitForTimeout(500);
    ok((await txt(p, '.empty-state')).includes('Try removing the minimum pay filter.'), 'one filter: names it: ' + await txt(p, '.empty-state'));
    await p.goto(ENV + '/jobs?q=' + encodeURIComponent('caffè')); await p.waitForTimeout(400);
    ok((await p.inputValue('input[name=q]')) === 'caffè', 'accented keywords are kept');
    await ctx.close(); }

  // No About page; /about redirects home; footer with Privacy notice and Terms
  { const { ctx, p } = await mk({}, { viewport: { width: 1280, height: 900 } });
    await p.goto(ENV + '/jobs'); await p.waitForTimeout(400);
    ok(await p.locator('a[href="/about"]').count() === 0 && !(await txt(p, '.site-header')).includes('About'), 'no About link in the header');
    await p.goto(ENV + '/about'); await p.waitForTimeout(400);
    ok(new URL(p.url()).pathname === '/' && await p.isVisible('.hero'), '/about redirects to the home page');
    for (const path of ['/', '/jobs', '/jobs/' + ID(1), '/login', '/privacy', '/terms', '/nope']) {
      await p.goto(ENV + path); await p.waitForTimeout(350);
      const f = await txt(p, '.site-footer');
      const fine = await p.locator('.site-footer').count() === 1 && f.includes('A student project in Milan. Free for students.') && !/About/.test(f) && f.includes('Privacy notice') && f.includes('Terms') && f.includes('Questions or need help? hello@gigome.org') && f.includes('Give feedback');
      ok(fine, 'footer on ' + path + ': Privacy notice and Terms, no About');
      // Area names in the dropdowns (e.g. "Porta Romana / Bocconi") are neighbourhoods, not claims of affiliation.
      const all = await p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('select').forEach((x) => x.remove()); return c.innerText; });
      ok(!/bocconi/i.test(all) && !/about us|our team|founder|biograph/i.test(all), 'no Bocconi, team or biography text on ' + path);
    }
    for (const [path, title] of [['/privacy', 'Privacy notice'], ['/terms', 'Terms of use']]) {
      await p.goto(ENV + '/'); await p.waitForTimeout(300);
      await p.click('.site-footer a:has-text("' + (path === '/terms' ? 'Terms' : 'Privacy notice') + '")'); await p.waitForTimeout(400);
      const t = await txt(p, 'main');
      ok(new URL(p.url()).pathname === path && t.includes(title) && t.includes('Who operates GigoMe') && (await p.locator('main .placeholder-text').allInnerTexts()).includes('[Who operates GigoMe: to be filled in]'), path + ': opened from the footer, with the marked "Who operates GigoMe" placeholder');
    }
    await p.goto(ENV + '/#jobs'); await p.waitForTimeout(400);
    ok(await p.isVisible('.hero'), 'old /#jobs links land on the home page');
    await ctx.close(); }
  { const { ctx, p } = await mk();
    await p.goto(ENV + '/terms'); await p.waitForTimeout(400); await p.click('#menu-btn');
    const items = await p.$$eval('#menu-panel a, #menu-panel button', (els) => els.map((e) => e.textContent.trim()).join(', '));
    ok(items === 'Jobs, For employers', 'phone menu: Jobs, For employers');
    for (const path of ['/', '/terms', '/privacy', '/jobs']) { await p.goto(ENV + path); await p.waitForTimeout(400); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll on phone: ' + path); }
    await ctx.close(); }

  ok(errs.length === 0, 'no JS errors: ' + errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'SITE ALL PASSED'); await b.close();
})();
