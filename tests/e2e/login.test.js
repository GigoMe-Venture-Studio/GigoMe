const { OUT } = require('./lib/browser.js');
const { chromium, devices } = require('./lib/browser.js');
const ENV = 'http://127.0.0.1:4302', NOENV = 'http://127.0.0.1:4301', SB = 'https://testproj.supabase.co';
const SHOTS = require('./lib/browser.js').OUT + '/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

// A fake Supabase: universities, OTP send/verify, profiles, logout.
async function mockSupabase(ctx, opts = {}) {
  const log = { otp: [], verify: [], patch: [], logout: [], universities: 0 };
  const profile = { full_name: opts.fullName ?? null, degree_level: null, graduation_year: null, account_type: 'student' };
  await ctx.route(SB + '/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
    const json = (status, body, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: body === null ? '' : JSON.stringify(body) });
    if (path === '/rest/v1/universities') { log.universities++; return json(200, [{ id: 'u1', name: 'Bocconi University', email_domains: ['studbocconi.it'] }]); }
    if (path === '/auth/v1/otp') {
      const body = req.postDataJSON(); log.otp.push(body);
      if (body.email.startsWith('ratelimit')) return json(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'Email rate limit exceeded' });
      return json(200, {});
    }
    if (path === '/auth/v1/verify') {
      const body = req.postDataJSON(); log.verify.push(body);
      if (body.token === '999999') return json(429, { code: 429, error_code: 'over_request_rate_limit', msg: 'Request rate limit reached' });
      if (body.token !== '123456') return json(403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const user = { id: 'uid-1', aud: 'authenticated', role: 'authenticated', email: body.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() };
      return json(200, { access_token: b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'uid-1', role: 'authenticated', exp, email: body.email }) + '.sig', token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-1', user });
    }
    if (path === '/rest/v1/profiles' && method === 'GET') {
      const single = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
      return json(200, single ? profile : [profile]);
    }
    if (path === '/rest/v1/profiles' && method === 'PATCH') { const body = req.postDataJSON(); log.patch.push({ query: url.search, body }); Object.assign(profile, body); return route.fulfill({ status: 204, body: '' }); }
    if (path === '/auth/v1/logout') { log.logout.push(url.search); return route.fulfill({ status: 204, body: '' }); }
    if (path === '/auth/v1/user') return json(200, { id: 'uid-1', email: 'x' });
    return json(404, { msg: 'unmocked ' + method + ' ' + path });
  });
  return log;
}

(async () => {
  const b = await chromium.launch(); const errs = [];
  const phone = { ...devices['iPhone 13'], reducedMotion: 'reduce' };
  const newPage = async (ctxOpts = phone, mockOpts) => {
    const ctx = await b.newContext(ctxOpts); const log = await mockSupabase(ctx, mockOpts); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|Missing VITE_SUPABASE|Failed to load resource/.test(m.text())) errs.push(m.text()); });
    return { ctx, p, log };
  };
  const txt = async (p, s) => ((await p.textContent(s)) || '').replace(/\s+/g, ' ').trim();

  // 1. Build without the variables: clear message, home still works
  { const { ctx, p } = await newPage();
    await p.goto(NOENV + '/login'); await p.waitForTimeout(300);
    ok((await txt(p, 'main')).includes("Logging in isn't available right now") && (await txt(p, 'main')).includes('VITE_SUPABASE_URL'), 'missing variables: /login shows a clear message, not a blank page');
    await p.goto(NOENV + '/'); await p.waitForTimeout(400);
    ok(await p.isVisible('.hero') && (await txt(p, '.site-header')).includes('Log in'), 'missing variables: the home page and header still work');
    await p.goto(NOENV + '/welcome'); await p.waitForTimeout(200);
    ok((await txt(p, 'main')).includes("isn't available"), 'missing variables: /welcome shows the same message');
    await ctx.close(); }

  // 2. Header buttons on the home page go to /login
  { const { ctx, p } = await newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(ENV + '/'); await p.waitForTimeout(400);
    const hrefs = await p.$$eval('.site-header .header-actions a', as => as.map(a => a.textContent + '->' + a.getAttribute('href')));
    ok(hrefs.join(',') === 'Log in->/login', 'desktop header: ' + hrefs.join(', '));
    await p.click('.site-header >> text=Log in'); await p.waitForTimeout(400);
    ok(new URL(p.url()).pathname === '/login' && (await txt(p, 'h1')) === 'Log in or sign up', 'header Log in opens /login');
    await ctx.close(); }
  { const { ctx, p } = await newPage();
    await p.goto(ENV + '/'); await p.waitForTimeout(400); await p.click('#menu-btn');
    ok((await p.$$eval('#menu-panel a, #menu-panel button', els => els.map(e => e.textContent.trim()).join(', '))) === 'Jobs, For employers', 'phone menu when logged out: Jobs, For employers');
    await p.click('#menu-btn'); await p.click('.site-header >> text=Log in'); await p.waitForTimeout(400);
    ok(new URL(p.url()).pathname === '/login', 'phone: Log in button opens /login');
    await ctx.close(); }

  // 3. Email step
  const { ctx, p, log } = await newPage();
  await p.goto(ENV + '/login'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.name === 'email'), 'email field is focused');
  ok((await p.getAttribute('input[name=email]', 'inputmode')) === 'email' && (await p.getAttribute('input[name=email]', 'autocapitalize')) === 'none', 'email field: email keyboard, no auto-capitals');
  ok((await txt(p, '#login-privacy')) === "We use your email to log you in and to check it's from a university on GigoMe. See our Privacy Notice." && (await p.getAttribute('#login-privacy a', 'href')) === '/privacy', 'privacy line under the email field: what the email is used for, links to /privacy (nothing to "agree" to)');
  ok((await txt(p, '.login-disclaimer')) === 'GigoMe is an independent student project, not affiliated with or endorsed by any university.' && !/bocconi/i.test(await txt(p, 'main')) && log.universities === 0, 'student login: the independence line, no university named, universities not read on load');
  await p.fill('input[name=email]', 'not-an-email'); await p.click('text=Send me a code'); await p.waitForTimeout(200);
  ok((await txt(p, '.err')).includes('full university email') && log.otp.length === 0 && log.universities === 0, 'invalid email: message, nothing sent, universities not read');
  for (const bad of ['someone@gmail.com', 'x@notstudbocconi.it', 'x@studbocconi.it.evil.com', 'x@sub.studbocconi.it']) {
    await p.fill('input[name=email]', bad); await p.click('text=Send me a code'); await p.waitForTimeout(250);
    const n = await txt(p, '.auth-notice');
    ok(n.includes('Use your university email. GigoMe is open to students of:') && (await txt(p, '.uni-list')) === 'Bocconi University (@studbocconi.it)' && (await txt(p, '.login-disclaimer')).includes('not affiliated with or endorsed by any university') && n.includes('Is your university missing? Email hello@gigome.org') && n.includes('Are you an employer? Log in on the employers page.') && log.otp.length === 0, 'not a listed university (' + bad + '): the universities with their domains, "missing?" and employer lines, no code sent: ' + n);
  }
  ok((await p.getAttribute('.auth-notice a:has-text("Email hello@gigome.org")', 'href')) === 'mailto:hello@gigome.org?subject=Add%20my%20university%20to%20GigoMe', '"Is your university missing?" is a mailto link with a subject');
  await p.fill('input[name=email]', '  Name.Surname@StudBocconi.IT '); await p.click('text=Send me a code'); await p.waitForTimeout(400);
  ok(log.otp.length === 1 && log.otp[0].email === 'name.surname@studbocconi.it' && log.otp[0].create_user === true, 'listed university: code requested for the lowercased email, create_user true (' + JSON.stringify(log.otp[0] && { email: log.otp[0].email, create_user: log.otp[0].create_user }) + ')');
  ok(!('options' in (log.otp[0] || {})) && !JSON.stringify(log.otp[0]).includes('redirect'), 'no magic-link redirect in the request');
  ok((await txt(p, 'h1')) === 'Check your email' && (await txt(p, '.lead')).includes('name.surname@studbocconi.it'), 'code step shows the email');
  ok((await txt(p, '#code-hint')).includes('spam'), 'spam folder hint shown');
  const resend = p.locator('text=/Send a new code/');
  ok(await resend.isDisabled() && /\(\d+s\)/.test(await resend.textContent()), 'resend disabled with countdown: ' + (await resend.textContent()));
  ok((await p.getAttribute('input[name=code]', 'inputmode')) === 'numeric' && (await p.getAttribute('input[name=code]', 'autocomplete')) === 'one-time-code', 'code field: number keyboard, one-time-code autofill');
  await p.screenshot({ path: SHOTS + 'phone-code.png' });
  await p.reload(); await p.waitForTimeout(400);
  ok((await txt(p, 'h1')) === 'Check your email', 'after a reload (back from the mail app) the code step is still there');
  await p.fill('input[name=code]', '000000'); await p.waitForTimeout(400);
  ok(log.verify.length === 1 && log.verify[0].type === 'email' && log.verify[0].token === '000000', 'six digits submit automatically with type "email"');
  ok((await txt(p, '.err')) === "That code isn't right. Check the 6 digits in the latest email we sent you." && (await p.inputValue('input[name=code]')) === '', 'wrong code: friendly message, field cleared');
  await p.fill('input[name=code]', '999999'); await p.waitForTimeout(400);
  ok((await txt(p, '.err')).startsWith('Too many attempts.'), 'too many attempts: ' + await txt(p, '.err'));
  await p.click('text=Use a different email'); await p.waitForTimeout(200);
  ok((await txt(p, 'h1')) === 'Log in or sign up' && (await p.inputValue('input[name=email]')) === 'name.surname@studbocconi.it', 'use a different email: back to step one, email kept');
  await p.click('text=Send me a code'); await p.waitForTimeout(400);
  // paste with a space, then success -> /welcome
  await p.locator('input[name=code]').fill('123 456'); await p.waitForTimeout(800);
  ok(log.verify.at(-1).token === '123456', 'pasted "123 456" is cleaned to 123456');
  ok(new URL(p.url()).pathname === '/welcome', 'new student goes to /welcome');
  ok((await txt(p, 'main')).includes('Logged in as name.surname@studbocconi.it'), 'welcome page shows who is logged in');
  ok((await txt(p, '.header-user')) === 'name.surname@studbocconi.it', 'header shows the email until a name is saved');
  const degreeOptions = await p.$$eval('select[name=degree_level] option', os => os.map(o => o.value).filter(Boolean));
  ok(degreeOptions.join(',') === 'bachelor,master,single_cycle,phd,exchange,other', 'degree levels match the database: ' + degreeOptions.join(','));
  await p.click('text=Save and continue'); await p.waitForTimeout(200);
  ok((await p.locator('.field .err').count()) === 3 && log.patch.length === 0, 'empty form: three field errors, nothing saved');
  await p.screenshot({ path: SHOTS + 'phone-welcome.png', fullPage: true });
  await p.fill('input[name=full_name]', '  Ana   Rossi '); await p.selectOption('select[name=degree_level]', 'master');
  const year = String(new Date().getFullYear() + 2); await p.selectOption('select[name=graduation_year]', year);
  await p.click('text=Save and continue'); await p.waitForTimeout(700);
  ok(log.patch.length === 1 && log.patch[0].query.includes('id=eq.uid-1') && JSON.stringify(log.patch[0].body) === JSON.stringify({ full_name: 'Ana Rossi', degree_level: 'master', graduation_year: Number(year) }), 'saves only the three fields, on the own row: ' + JSON.stringify(log.patch[0]));
  ok(new URL(p.url()).pathname === '/' && await p.isVisible('.hero'), 'then goes to the home page');
  ok((await txt(p, '.header-user')) === 'Ana Rossi' && !(await txt(p, '.site-header')).includes('Log in'), 'header shows the saved name: ' + await txt(p, '.header-user'));
  await p.goto(ENV + '/login'); await p.waitForTimeout(300);
  ok((await txt(p, 'h1')) === "You're logged in", '/login while logged in offers "Go to GigoMe" and "Log out"');
  await p.goto(ENV + '/'); await p.waitForTimeout(400);
  await p.click('#menu-btn'); ok((await p.$$eval('#menu-panel a, #menu-panel button', els => els.map(e => e.textContent.trim()).join(', '))) === 'Jobs, Saved jobs, Ana Rossi, Log out', 'phone menu when logged in: Jobs, Saved jobs, name, Log out');
  await p.click('#menu-panel >> text=Log out'); await p.waitForTimeout(400);
  ok(log.logout.length === 1 && log.logout[0].includes('scope=local') && (await txt(p, '.site-header')).includes('Log in') && await p.locator('.header-user').count() === 0, 'log out from the phone menu: this device only, header back to Log in');
  await p.goto(ENV + '/welcome'); await p.waitForTimeout(300);
  ok(new URL(p.url()).pathname === '/login', '/welcome when logged out redirects to /login');
  await ctx.close();

  // 4. Returning student with a name goes straight home
  { const { ctx, p } = await newPage(phone, { fullName: 'Ana Rossi' });
    await p.goto(ENV + '/login'); await p.waitForTimeout(300);
    await p.fill('input[name=email]', 'ana@studbocconi.it'); await p.click('text=Send me a code'); await p.waitForTimeout(400);
    await p.fill('input[name=code]', '123456'); await p.waitForTimeout(800);
    ok(new URL(p.url()).pathname === '/', 'returning student with a name skips /welcome');
    await ctx.close(); }

  // 5. Expired code and resend timer (fake clock)
  { const { ctx, p, log } = await newPage();
    await p.clock.install();
    await p.goto(ENV + '/login'); await p.waitForTimeout(300);
    await p.fill('input[name=email]', 'late@studbocconi.it'); await p.click('text=Send me a code'); await p.waitForTimeout(400);
    await p.clock.fastForward(30_000); await p.waitForTimeout(100);
    ok(await p.locator('text=/Send a new code/').isDisabled(), 'resend still disabled after 30 seconds');
    await p.clock.fastForward(31_000); await p.waitForTimeout(200);
    const rb = p.locator('text=/Send a new code/');
    ok(!(await rb.isDisabled()) && (await rb.textContent()).trim() === 'Send a new code', 'resend enabled after 60 seconds');
    await rb.click(); await p.waitForTimeout(300);
    ok(log.otp.length === 2 && (await txt(p, '[role=status]')).includes('Only the newest code works') && await p.locator('text=/Send a new code/').isDisabled(), 'resend sends a new code and restarts the timer');
    await p.clock.fastForward(61 * 60_000); await p.waitForTimeout(100);
    await p.fill('input[name=code]', '000000'); await p.waitForTimeout(400);
    ok((await txt(p, '.err')) === 'This code has expired. Ask for a new one below.', 'code older than an hour: "expired" message');
    await ctx.close(); }

  // 6. Sending too many emails
  { const { ctx, p } = await newPage();
    await p.goto(ENV + '/login'); await p.waitForTimeout(300);
    await p.fill('input[name=email]', 'ratelimit@studbocconi.it'); await p.click('text=Send me a code'); await p.waitForTimeout(400);
    ok((await txt(p, '.err')).includes('try again in a few minutes') && (await txt(p, 'h1')) === 'Log in or sign up', 'email rate limit: friendly message, stays on step one');
    await p.screenshot({ path: SHOTS + 'phone-email.png' });
    await ctx.close(); }

  // 7. Privacy page, 404 still works, no sideways scroll on phones
  { const { ctx, p } = await newPage();
    for (const path of ['/login', '/welcome', '/privacy', '/nope']) {
      await p.goto(ENV + path); await p.waitForTimeout(300);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(over <= 0, 'no sideways scroll on phone: ' + path);
    }
    await p.goto(ENV + '/privacy'); await p.waitForTimeout(200);
    ok((await txt(p, 'h1')) === 'Privacy notice', '/privacy page');
    await p.screenshot({ path: SHOTS + 'phone-privacy.png' });
    await p.goto(ENV + '/nope'); await p.waitForTimeout(200);
    ok((await txt(p, 'h1')) === 'Page not found', '404 still works');
    await ctx.close(); }

  ok(errs.length === 0, 'no JS errors: ' + errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'LOGIN ALL PASSED'); await b.close();
})();
