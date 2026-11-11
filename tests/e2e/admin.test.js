const { OUT } = require('./lib/browser.js');
const { chromium, devices } = require('./lib/browser.js');
const { amock, login, ID } = require('./lib/amock.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const frames = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const SEL = "main a:not(.role-row),main button,main input,main select,main textarea,.site-footer a,.site-footer button:not(.footer-link-btn),.menu-panel a,.menu-panel button,.maplibregl-ctrl-attrib";
const probe = (sel) => { const b = document.querySelector('.feedback-fab'); const r = b.getBoundingClientRect(); const shown = !b.hasAttribute('data-away'); const hits = [];
  for (const el of document.querySelectorAll(sel)) { const q = el.getBoundingClientRect(); if (q.width && q.height && q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top) hits.push((el.textContent || el.name || '').trim().slice(0, 20)); }
  return { shown, hits }; };

(async () => {
  const b = await chromium.launch();

  // ---- report this job
  { const ctx = await b.newContext(desk); const { log } = await amock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForTimeout(500);
    const out = p.locator('.report-job-out a');
    ok(await out.getAttribute('href') === '/login?next=%2Fjobs%2F' + ID(1), 'logged out: "Log in to report it" back to this job');
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs/' + ID(1)); await p.waitForTimeout(500);
    await p.click('button:has-text("Report this job")');
    const reasons = await p.$$eval('.report-reasons label', (els) => els.map((e) => e.textContent.trim()));
    ok(reasons.join('|') === 'Scam, or payment demanded from students|Illegal or unsafe|Misleading pay or hours|Discriminatory|Something else', 'five reasons: ' + reasons.join('|'));
    await p.click('button:has-text("Send report")'); await p.waitForTimeout(200);
    ok((await txt(p, '.report-form')).includes('Choose a reason.') && !log.reportPosts, 'reason required, nothing sent');
    await p.check('input[name=reason][value=scam]'); await p.fill('textarea[name=details]', '  They want €50 first.  ');
    await p.screenshot({ path: OUT + '/report-form.png', fullPage: true });
    await p.click('button:has-text("Send report")'); await p.waitForTimeout(500);
    ok(JSON.stringify(log.reportPosts[0]) === JSON.stringify({ job_id: ID(1), reason: 'scam', details: 'They want €50 first.' }), 'report sent with job, reason, trimmed details: ' + JSON.stringify(log.reportPosts[0]));
    ok((await txt(p, 'main')).includes("Thanks for telling us. We'll look into it."), 'thanks shown');
    await p.reload(); await p.waitForTimeout(500);
    await p.click('button:has-text("Report this job")'); await p.check('input[name=reason][value=other]'); await p.click('button:has-text("Send report")'); await p.waitForTimeout(500);
    ok((await txt(p, 'main')).includes("You've already reported this job."), 'second report: already reported');
    await ctx.close(); }
  { const ctx = await b.newContext(desk); await amock(ctx, { reportFail: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/jobs/' + ID(1)); await p.waitForTimeout(500);
    await p.click('button:has-text("Report this job")'); await p.check('input[name=reason][value=misleading]'); await p.click('button:has-text("Send report")'); await p.waitForTimeout(500);
    ok((await txt(p, '.report-form')).includes("We couldn't send your report"), 'report error shown, form kept');
    await ctx.close(); }

  // ---- /admin is a 404 for everyone but admins
  { const ctx = await b.newContext(desk); const { log } = await amock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/admin'); await p.waitForTimeout(500);
    ok((await txt(p, 'main')).includes('Page not found'), 'logged out /admin: 404 page');
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/admin'); await p.waitForTimeout(500);
    ok((await txt(p, 'main')).includes('Page not found') && log.rpcs.some((x) => x[0] === 'is_admin'), 'logged-in non-admin /admin: 404 page (after asking is_admin)');
    ok(!log.rpcs.some((x) => x[0].startsWith('admin_')), 'non-admin: no admin data requested');
    await ctx.close(); }

  // ---- admin
  { const ctx = await b.newContext(desk); const { log, db } = await amock(ctx, { admin: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/admin'); await p.waitForTimeout(800);
    const t = await txt(p, 'main');
    ok(t.includes('Moderation') && t.includes('2 companies, 2 jobs and 1 open report waiting.'), 'admin: summary of the queue');
    const c1 = p.locator('.admin-item', { hasText: 'Nebbia Coffee Bar' }).first();
    const c1t = await c1.innerText();
    ok(c1t.includes('hiring@nebbia.it') && c1t.includes('owner@nebbia.it') && c1t.includes('nebbia.it') && c1t.includes('Specialty coffee.'), 'company: website, description, contact and login email');
    await c1.locator('button:has-text("Approve")').click(); await p.waitForTimeout(600);
    ok(JSON.stringify(log.rpcs.filter((x) => x[0] === 'admin_set_company_status').pop()[1]) === JSON.stringify({ p_company_id: 'c1', p_status: 'approved' }), 'approve company');
    ok(!(await txt(p, '#admin-companies')).includes('Nebbia Coffee Bar') && (await txt(p, 'main')).includes('1 company,'), 'approved company leaves the queue');
    p.once('dialog', (d) => d.accept());
    await p.locator('.admin-item', { hasText: 'Fintra' }).locator('button:has-text("Reject")').click(); await p.waitForTimeout(600);
    ok(db.companies.find((c) => c.id === 'c2').status === 'rejected', 'reject company');

    const j1 = p.locator('#admin-jobs .admin-item', { hasText: 'Weekend barista' });
    const j1t = await j1.innerText();
    ok(j1t.includes('Approved Co') && j1t.includes('€11/h') && j1t.includes('https://nebbia.it/jobs') && j1t.includes('Serve coffee.'), 'job: company, pay, how to apply, description');
    ok((await j1.locator('.admin-checklist label').count()) === 5, 'job: five-item review checklist');
    const pub = j1.locator('button:has-text("Publish")');
    ok(await pub.isDisabled(), 'Publish disabled until the checklist is ticked');
    for (const box of await j1.locator('.admin-checklist input').all()) await box.check();
    ok(!(await pub.isDisabled()), 'all ticked: Publish enabled');
    const j2 = p.locator('#admin-jobs .admin-item', { hasText: 'Promoter' });
    ok((await j2.innerText()).includes('25 h/week (over 20)') && (await j2.innerText()).includes('Not stated') && (await j2.innerText()).includes('Earlier note: "Add pay."'), 'job 2: hours over 20 flagged, pay not stated, earlier note');
    const before = log.rpcs.length;
    await j2.locator('button:has-text("Request changes")').click(); await p.waitForTimeout(200);
    ok((await j2.innerText()).includes('Write a note for the employer first') && log.rpcs.length === before, 'request changes needs a note (no call)');
    await j2.locator('textarea').fill('Remove the joining fee and state the pay.');
    await p.screenshot({ path: OUT + '/admin.png', fullPage: true });
    await j2.locator('button:has-text("Request changes")').click(); await p.waitForTimeout(600);
    ok(JSON.stringify(log.rpcs.filter((x) => x[0] === 'admin_review_job').pop()[1]) === JSON.stringify({ p_job_id: 'pj2', p_status: 'changes_requested', p_note: 'Remove the joining fee and state the pay.' }), 'request changes with the note');
    await pub.click(); await p.waitForTimeout(600);
    ok(JSON.stringify(log.rpcs.filter((x) => x[0] === 'admin_review_job').pop()[1]) === JSON.stringify({ p_job_id: 'pj1', p_status: 'published', p_note: null }), 'publish');
    ok((await txt(p, '#admin-jobs')).includes('None.'), 'job queue empty');

    const r1 = p.locator('#admin-reports .admin-item').first();
    const r1t = await r1.innerText();
    ok(r1t.includes('Scam, or payment demanded from students') && r1t.includes('They asked me for a €50 fee.') && r1t.includes('Marco Bianchi (student)') && r1t.includes('Weekend barista (live)') && r1t.includes('https://nebbia.it/apply'), 'report: reason, details, reporter, job and its contact');
    await r1.locator('button:has-text("Resolve the report")').click(); await p.waitForTimeout(200);
    ok((await r1.innerText()).includes('Write a note first'), 'resolve needs a note');
    await r1.locator('textarea').fill('Asked for a fee: unpublished.');
    p.once('dialog', (d) => d.accept());
    await r1.locator('button:has-text("Unpublish the job")').click(); await p.waitForTimeout(700);
    ok(db.jobs.find((x) => x.id === ID(1)).status === 'closed' && JSON.stringify(log.rpcs.filter((x) => x[0] === 'admin_review_job').pop()[1]) === JSON.stringify({ p_job_id: ID(1), p_status: 'closed', p_note: 'Asked for a fee: unpublished.' }), 'unpublish = admin_review_job closed with the note');
    const r1b = p.locator('#admin-reports .admin-item').first();
    ok(await r1b.locator('button:has-text("Unpublish the job")').count() === 0 && (await r1b.innerText()).includes('Closed'), 'after unpublishing: job shown as Closed, report still open');
    ok(await r1b.locator('textarea').inputValue() === 'Asked for a fee: unpublished.' && !(await r1b.locator('button:has-text("Resolve the report")').isDisabled()), 'note kept, Resolve still usable');
    p.once('dialog', (d) => { log.rejectDialog = d.message(); d.accept(); });
    await r1b.locator('button:has-text("Reject the company")').click(); await p.waitForTimeout(700);
    ok(JSON.stringify(log.rpcs.filter((x) => x[0] === 'admin_set_company_status').pop()[1]) === JSON.stringify({ p_company_id: 'c3', p_status: 'rejected' }) && /All its jobs disappear/.test(log.rejectDialog || ''), 'report: "Reject the company" rejects the company of the job (logged function), after a warning');
    const r1c = p.locator('#admin-reports .admin-item').first();
    ok(await r1c.locator('button:has-text("Reject the company")').count() === 0, 'company already rejected: button gone');
    await r1c.locator('button:has-text("Resolve the report")').click(); await p.waitForTimeout(700);
    ok(JSON.stringify(log.rpcs.filter((x) => x[0] === 'admin_resolve_report').pop()[1]) === JSON.stringify({ p_report_id: 'r1', p_note: 'Asked for a fee: unpublished.' }), 'resolve the report with the note');
    const lg = await txt(p, '.admin-log');
    ok(['Company approved', 'Company rejected', 'Changes requested', 'Job published', 'Job unpublished', 'Report resolved'].every((w) => lg.includes(w)) && lg.includes('Ana Rossi') && /\d{1,2} \w{3} \d{4}/.test(lg), 'recent decisions: every decision with who and when');
    ok(lg.includes('"Asked for a fee: unpublished."'), 'log shows notes');
    await ctx.close(); }

  // ---- phones
  for (const [name, dev] of [['iPhone SE', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['iPhone 13', devices['iPhone 13']]]) {
    const ctx = await b.newContext(dev); await amock(ctx, { admin: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p);
    for (const [u, open] of [['/admin', false], ['/jobs/' + ID(1), true]]) {
      await p.goto(E + u); await p.waitForTimeout(800);
      if (open) await p.click('button:has-text("Report this job")');
      ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${name} ${u}: no sideways scroll`);
      const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); let bad = 0;
      for (let y = 0; y <= max + 30; y += 31) { await p.evaluate((yy) => scrollTo(0, yy), y); await frames(p); const r = await p.evaluate(probe, SEL); if (r.shown && r.hits.length) { bad++; if (bad < 3) console.log('  overlap', u, y, r.hits); } }
      ok(bad === 0, `${name} ${u}: feedback button never covers a control`);
      if (name === 'iPhone 13' && u === '/admin') await p.screenshot({ path: OUT + '/phone-admin.png', fullPage: true });
    }
    await ctx.close();
  }

  // ---- a report whose job was deleted: kept, with the job title and company name only
  { const ctx = await b.newContext(desk); await amock(ctx, { admin: true, goneReport: true }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/admin'); await p.waitForTimeout(800);
    const r2 = p.locator('#admin-reports .admin-item', { hasText: 'Pay was half.' });
    const t2 = await r2.innerText().catch(() => '');
    ok(t2.includes('The job no longer exists: "Night shift" at Gone Ltd.') && t2.includes('A deleted account'), 'report on a deleted job: its kept title and company, reporter deleted: ' + t2.slice(0, 200));
    ok(await r2.locator('button:has-text("Unpublish the job")').count() === 0 && await r2.locator('button:has-text("Reject the company")').count() === 0
       && await r2.locator('button:has-text("Resolve the report")').count() === 1, 'only "Resolve the report" is offered for it');
    await ctx.close();
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
})();
