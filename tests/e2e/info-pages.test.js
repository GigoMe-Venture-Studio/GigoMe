// /how-it-works, /safety, the safety line on on-site job pages, which login
// is which, and job descriptions with headings and lists.
const { chromium } = require('./lib/browser.js');
const { mock, login, ID, JOBS } = require('./lib/mock.js');
const { emock, employerLogin } = require('./lib/emock.js');
const { stubMap } = require('./lib/stub.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const url = (p) => new URL(p.url());
const desk = { viewport: { width: 1280, height: 900 } };
const phoneAt = (width, height = 640) => ({ viewport: { width, height }, isMobile: true, hasTouch: true });
const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const cutOff = (p, sel) => p.$$eval(sel, (els) => els.filter((e) => e.offsetParent !== null).filter((e) => {
  const r = e.getBoundingClientRect(); return e.scrollWidth > e.clientWidth + 1 || r.left < -0.5 || r.right > innerWidth + 0.5;
}).map((e) => e.tagName + ' ' + e.textContent.trim().slice(0, 40)));
const STUDENT_QS = ['How do I find jobs?', 'Why do I need a university email?', 'What happens when I press "Apply"?', 'What does GigoMe see, and what doesn\'t it?', 'How do I delete my account?'];
const EMPLOYER_QS = ['How do I sign up?', 'How does the company review work?', 'How do I post a job?', 'Is every job reviewed before it\'s published?', 'How do students contact me?'];
const STRUCTURED = "What you'll do:\n- Make coffee\n- Run the till\n\nWho we're looking for:\nSomeone friendly.\nNo experience needed.\n\nPractical details:\n1. Saturdays\n2. Sundays";

(async () => {
  const b = await chromium.launch();

  // ---- /how-it-works
  { const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(E + '/'); await p.waitForSelector('.how');
    ok(await p.getAttribute('.how a:has-text("More about how GigoMe works")', 'href') === '/how-it-works' && await p.getAttribute('.how a:has-text("Staying safe")', 'href') === '/safety', 'home "How it works": links to /how-it-works and /safety');
    ok(await p.getAttribute('.site-footer a:has-text("How it works")', 'href') === '/how-it-works' && await p.getAttribute('.site-footer a:has-text("Staying safe")', 'href') === '/safety', 'footer links to both pages');
    await p.click('.site-footer a:has-text("How it works")'); await p.waitForSelector('.info h1');
    ok(url(p).pathname === '/how-it-works' && (await txt(p, 'h1')) === 'How GigoMe works', '/how-it-works opens');
    ok((await p.title()) === 'How GigoMe works | GigoMe' && await p.getAttribute('link[rel=canonical]', 'href') === 'https://gigome.org/how-it-works', 'title and canonical link');
    const sections = await p.$$eval('.info section', (ss) => ss.map((s) => [s.querySelector('h2').textContent, [...s.querySelectorAll('summary')].map((x) => x.textContent)]));
    ok(JSON.stringify(sections) === JSON.stringify([['For students', STUDENT_QS], ['For employers', EMPLOYER_QS]]), 'students and employers, the questions asked for: ' + JSON.stringify(sections));
    ok(await p.$$eval('details.faq', (ds) => ds.every((d) => !d.open)), 'every answer starts closed');
    await p.click('summary:has-text("What happens when I press")');
    const a = await txt(p, '#apply .faq-answer');
    ok(a.includes('You then contact the employer directly, outside GigoMe') && a.includes("pressing Apply isn't an application") && a.includes('never by whom'), 'Apply: shows the contact, you contact them directly, employers never see who');
    await p.keyboard.press('Tab'); await p.focus('#delete-account summary'); await p.keyboard.press('Enter');
    ok(await p.$eval('#delete-account', (d) => d.open), 'a question opens with the keyboard');
    ok((await txt(p, '#delete-account .faq-answer')).includes('Delete my account') && await p.locator('#delete-account a[href="/account"]').count() === 1, 'how to delete the account, with a link to /account');
    const all = await p.evaluate(() => { document.querySelectorAll('details.faq').forEach((d) => { d.open = true; }); return document.querySelector('.info').innerText; });
    ok(!/\bverified\b|\bguarantee|\bsafe job|jobs are safe|safe to\b/i.test(all), 'no promises: never "verified", "guarantee" or "safe"');
    ok(all.includes('usually within 2 working days') && all.includes("We don't email you when it changes") && all.includes('up to 60 days'), 'employer answers match the review flow');
    ok(await p.locator('.info a[href="/safety"]').count() >= 1, 'links to /safety');
    ok(await p.getAttribute('#students-contact a', 'href') === '/terms#section-13', 'Terms sections 9 to 11 link to clause 9');
    ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await ctx.close(); }

  // ---- /safety
  { const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/safety'); await p.waitForSelector('.info h1');
    ok((await txt(p, 'h1')) === 'Staying safe' && (await p.title()) === 'Staying safe | GigoMe', '/safety opens, with its title');
    const t = await txt(p, '.info');
    ok(t.includes('Every company is reviewed by a person') && t.includes('Every job is reviewed by a person'), 'what GigoMe checks: a person reviews every company and job');
    ok(t.includes("It can't verify every employer") && t.includes("It doesn't supervise any job"), "just as clearly, what it can't");
    ok(!/\bverified\b|\bguarantee[sd]?\b(?! pay)|\bare safe\b|\bis safe\b|safe jobs?/i.test(t), 'never says employers are verified or jobs are safe');
    for (const tip of ['Never pay to get a job.', 'Look the business up before you go', 'Tell someone where you\'re going', 'opening hours', 'Get the essential terms in writing before you start', 'Unpaid "trial shifts" doing real work are a red flag.', 'Never share passwords or login codes.', 'Keep your bank details to yourself until you have the written terms of a real job.', 'never needs your card number or PIN', 'From outside the EU?'])
      ok(t.includes(tip), 'tip: ' + tip);
    ok(t.includes('Report this job') && t.includes('hello@gigome.org') && t.includes('In an emergency, call 112.'), 'if something is wrong: report, email, 112');
    const permit = p.locator('a:has-text("portal for migrants")');
    ok(await permit.getAttribute('href') === 'https://www.integrazionemigranti.gov.it/' && await permit.getAttribute('target') === '_blank' && (await permit.getAttribute('rel')).includes('noopener'), 'permit: an official link only, in a new tab');
    ok(await p.getAttribute('.info a[href^="mailto:"]', 'href') === 'mailto:hello@gigome.org', 'hello@gigome.org is a mail link');
    // The Terms links land on the right clauses.
    for (const [href, clause] of [['/terms#section-21', '15. Reports and moderation'], ['/terms#section-26', '19. No guarantee of third-party outcomes'], ['/terms#section-11', '8. Employment and personal safety']]) {
      ok(await p.locator(`.info a[href="${href}"]`).count() === 1, 'links to ' + href);
      await p.goto(E + href); await p.waitForTimeout(700);
      ok((await p.$eval(href.split('#')[1].replace(/^/, '#'), (e) => e.textContent).catch(() => '')).includes(clause), `${href} is "${clause}"`);
      await p.goto(E + '/safety'); await p.waitForSelector('.info h1');
    }
    ok(await p.getAttribute('.info-more a', 'href') === '/how-it-works', 'links back to /how-it-works');
    await ctx.close(); }

  // ---- Job pages: the safety line on on-site jobs only, below Apply
  { const ctx = await b.newContext(phoneAt(375, 667)); await mock(ctx); await stubMap(ctx, {}); const p = await ctx.newPage();
    await p.goto(E + '/login?next=' + encodeURIComponent('/jobs/' + ID(1))); await login(p);
    await p.waitForSelector('.apply button:has-text("Apply")');
    const line = p.locator('.apply .apply-safety');
    ok((await line.innerText()) === 'Meeting an employer in person? Read our safety tips.' && await line.locator('a').getAttribute('href') === '/safety', 'on-site job: the line, linking to /safety');
    const [btn, ln] = [await p.locator('.apply button:has-text("Apply")').boundingBox(), await line.boundingBox()];
    ok(ln.y >= btn.y + btn.height, 'the line is under Apply: it never pushes it down');
    await p.goto(E + '/jobs/' + ID(2)); await p.waitForSelector('.apply button:has-text("Apply")');
    ok(await p.locator('.apply-safety').count() === 0, 'remote job: no line');
    await ctx.close(); }
  { const ctx = await b.newContext(phoneAt(320, 568)); await mock(ctx); await stubMap(ctx, {}); const p = await ctx.newPage();
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.apply-safety');
    const cut = await cutOff(p, '.apply, .apply *');
    ok(cut.length === 0 && !(await sideways(p)), '320px job page: the box and its line not cut off: ' + cut.join(', '));
    await ctx.close(); }

  // ---- Job descriptions: headings, lists, line breaks
  { const ctx = await b.newContext(desk); await mock(ctx, { jobs: [{ ...JOBS[0], description: STRUCTURED }].concat(JOBS.slice(1)) }); await stubMap(ctx, {}); const p = await ctx.newPage();
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.detail .desc');
    const d = await p.$eval('.detail .prose-role .desc', (el) => [...el.children].map((c) => c.tagName + ':' + c.textContent.replace(/\s+/g, ' ').trim()));
    ok(JSON.stringify(d) === JSON.stringify(["H3:What you'll do", 'UL:Make coffeeRun the till', "H3:Who we're looking for", 'P:Someone friendly.No experience needed.', 'H3:Practical details', 'OL:SaturdaysSundays']), 'description: headings, lists and paragraphs: ' + JSON.stringify(d));
    ok(await p.locator('.detail .desc p br').count() === 1, 'a line break inside a paragraph is kept');
    ok(await p.$eval('.detail .desc ul', (u) => getComputedStyle(u).paddingLeft !== '0px') && await p.$eval('.detail .desc h3', (h) => parseFloat(getComputedStyle(h).fontSize) === 16), 'lists indented, headings 16px');
    await ctx.close(); }

  // ---- The job form suggests the structure
  { const ctx = await b.newContext(desk); await emock(ctx, { company: { name: 'Nebbia', status: 'approved' } }); await stubMap(ctx, {}); const p = await ctx.newPage();
    await employerLogin(p, E); await p.goto(E + '/dashboard/jobs/new'); await p.waitForSelector('textarea[name=description]');
    const hint = await txt(p, '#description-hint');
    ok(hint.includes("What you'll do") && hint.includes("Who we're looking for") && hint.includes('Practical details'), 'job form: the three parts, as a hint');
    ok((await p.getAttribute('textarea[name=description]', 'placeholder')).startsWith("What you'll do:\n- "), 'job form: placeholder in the same structure');
    ok(await p.getAttribute('textarea[name=description]', 'aria-describedby') === 'description-hint', 'the hint describes the field');
    await ctx.close(); }

  // ---- Which login is which
  { const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/'); await p.waitForTimeout(400);
    ok((await txt(p, '.site-header .header-actions a')) === 'Student login', 'header: "Student login"');
    await p.goto(E + '/login'); await p.waitForSelector('input[name=email]');
    ok((await txt(p, '.login-switch')) === 'Hiring? Use the employer login' && await p.getAttribute('.login-switch a', 'href') === '/employers', '/login: "Hiring? Use the employer login"');
    await p.click('.login-switch a'); await p.waitForTimeout(500);
    const pitch = await txt(p, '.employers-intro');
    ok(pitch.includes('A person reviews every job before it goes live') && !/\b(real|verified|genuine|safe)\b/i.test(pitch), '/employers: no claim stronger than /safety: ' + (pitch.match(/.{0,30}\b(real|verified|genuine|safe)\b.{0,30}/i) || [''])[0]);
    ok(url(p).pathname === '/employers' && (await txt(p, '.login-switch')) === 'Looking for work? Student login' && await p.getAttribute('.login-switch a', 'href') === '/login', '/employers: "Looking for work? Student login"');
    await ctx.close(); }

  // ---- 320px and 375px: nothing cut off, no sideways scroll
  for (const width of [320, 375]) {
    const ctx = await b.newContext(phoneAt(width)); await mock(ctx); const p = await ctx.newPage();
    for (const path of ['/how-it-works', '/safety']) {
      await p.goto(E + path); await p.waitForSelector('.info h1');
      await p.evaluate(() => document.querySelectorAll('details.faq').forEach((d) => { d.open = true; }));
      const cut = await cutOff(p, '.info, .info *');
      ok(cut.length === 0 && !(await sideways(p)), `${width}px ${path}: nothing cut off, no sideways scroll: ${cut.join(', ')}`);
      ok(await p.$$eval('summary', (ss) => ss.every((s) => s.getBoundingClientRect().height >= 44)), `${width}px ${path}: questions at least 44px tall`);
    }
    await p.goto(E + '/'); await p.waitForTimeout(400);
    const h = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const a = r('.site-header .header-actions a'), m = r('#menu-btn'), l = r('.site-logo'); return { a, m, l, w: innerWidth }; });
    ok(h.a.left >= h.l.right && h.a.right <= h.m.left && h.m.right <= h.w && !(await sideways(p)), `${width}px header: logo, "Student login" and Menu side by side`);
    ok((await cutOff(p, '.site-header a, .site-header button')).length === 0, `${width}px header: nothing cut off`);
    for (const path of ['/login', '/employers']) {
      await p.goto(E + path); await p.waitForSelector('.login-switch');
      ok((await cutOff(p, '.login-switch, .login-switch *')).length === 0 && !(await sideways(p)), `${width}px ${path}: the switch line fits`);
    }
    ok((await cutOff(p, '.employers-intro, .employers-intro *')).length === 0, `${width}px /employers: the review steps are not cut off`);
    await ctx.close();
  }

  // ---- Sitemap
  // (fetched, not opened: Chromium's XML viewer uses inline styles, which the CSP blocks)
  { const ctx = await b.newContext(desk);
    const s = await (await ctx.request.get(E + '/sitemap.xml')).text();
    ok(s.includes('https://gigome.org/how-it-works') && s.includes('https://gigome.org/safety'), 'both pages in the sitemap');
    await ctx.close(); }

  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
