const { OUT } = require('./lib/browser.js');
const { chromium, devices } = require('./lib/browser.js');
const ENV = 'http://127.0.0.1:4302', NOENV = 'http://127.0.0.1:4301', SB = 'https://testproj.supabase.co';
const SHOTS = require('./lib/browser.js').OUT + '/';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

// The universities table as the migrations set it (by name, as the site asks).
const UNIVERSITIES = [
  ['Bocconi University', 'studbocconi.it'], ['Humanitas University', 'st.hunimed.eu'], ['IULM University', 'studenti.iulm.it'],
  ['Politecnico di Milano', 'mail.polimi.it'], ['University of Milan (La Statale)', 'studenti.unimi.it'],
  ['University of Milano-Bicocca', 'campus.unimib.it'], ['Università Cattolica del Sacro Cuore', 'icatt.it'],
  ['Vita-Salute San Raffaele University', 'studenti.unisr.it']
].map(([name, domain], i) => ({ id: 'u' + i, name, email_domains: [domain] }));
const UNI_LIST_TEXT = UNIVERSITIES.map((u) => u.name + ' (@' + u.email_domains[0] + ')').join('\n');

// A fake Supabase: universities, OTP send/verify, profiles, logout.
async function mockSupabase(ctx, opts = {}) {
  const log = { otp: [], verify: [], patch: [], logout: [], universities: 0, declare: [], deleted: 0 };
  const accountType = opts.accountType || 'student';
  const profile = {
    full_name: opts.fullName ?? null, degree_level: null, graduation_year: null, account_type: accountType,
    student_verification: accountType === 'student' ? opts.verification || 'university_email' : null, student_declared_at: opts.declaredAt ?? null,
    terms_version: opts.fullName ? '2.2' : null, terms_accepted_at: opts.fullName ? '2026-11-01T10:00:00Z' : null
  };
  await ctx.route(SB + '/**', async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
    const json = (status, body, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: body === null ? '' : JSON.stringify(body) });
    if (path === '/rest/v1/universities') { log.universities++; return json(200, UNIVERSITIES); }
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
      log.user = user;
      return json(200, { access_token: b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'uid-1', role: 'authenticated', exp, email: body.email }) + '.sig', token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh-1', user });
    }
    if (path === '/rest/v1/profiles' && method === 'GET') {
      const single = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
      return json(200, single ? profile : [profile]);
    }
    if (path === '/rest/v1/profiles' && method === 'PATCH') { const body = req.postDataJSON(); log.patch.push({ query: url.search, body }); Object.assign(profile, body); return route.fulfill({ status: 204, body: '' }); }
    if (path === '/rest/v1/rpc/accept_terms') { log.accept = (log.accept || []).concat([req.postDataJSON()]); profile.terms_version = req.postDataJSON().p_version; profile.terms_accepted_at = new Date().toISOString(); return json(200, profile.terms_accepted_at); }
    if (path === '/rest/v1/rpc/declare_student') { log.declare.push(req.postDataJSON()); profile.student_declared_at = new Date().toISOString(); return route.fulfill({ status: 204, body: '' }); }
    if (path === '/rest/v1/rpc/delete_my_account') { log.deleted++; return route.fulfill({ status: 204, body: '' }); }
    if (path === '/auth/v1/logout') { log.logout.push(url.search); return route.fulfill({ status: 204, body: '' }); }
    // updateUser({ data }) (the login email's language): the logged-in user
    // with the keys merged into its metadata, as Supabase answers.
    if (path === '/auth/v1/user' && method === 'PUT' && log.user) { const body = req.postDataJSON(); log.userUpdates = (log.userUpdates || []).concat([body]); log.user = { ...log.user, user_metadata: { ...log.user.user_metadata, ...(body.data || {}) } }; return json(200, log.user); }
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
  const items = async (p, s) => (await p.locator(s + ' li').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim()).join('\n');

  // 1. Build without the variables: clear message, home still works
  { const { ctx, p } = await newPage();
    await p.goto(NOENV + '/login'); await p.waitForTimeout(300);
    ok((await txt(p, 'main')).includes("Logging in isn't available right now") && (await txt(p, 'main')).includes('VITE_SUPABASE_URL'), 'missing variables: /login shows a clear message, not a blank page');
    await p.goto(NOENV + '/'); await p.waitForTimeout(400);
    ok(await p.isVisible('.hero') && (await txt(p, '.site-header')).includes('Student login'), 'missing variables: the home page and header still work');
    await p.goto(NOENV + '/welcome'); await p.waitForTimeout(200);
    ok((await txt(p, 'main')).includes("isn't available"), 'missing variables: /welcome shows the same message');
    await ctx.close(); }

  // 2. Header buttons on the home page go to /login
  { const { ctx, p } = await newPage({ viewport: { width: 1280, height: 900 } });
    await p.goto(ENV + '/'); await p.waitForTimeout(400);
    const hrefs = await p.$$eval('.site-header .header-actions a', as => as.map(a => a.textContent + '->' + a.getAttribute('href')));
    ok(hrefs.join(',') === 'Student login->/login', 'desktop header: ' + hrefs.join(', '));
    await p.click('.site-header >> text=Student login'); await p.waitForTimeout(400);
    ok(new URL(p.url()).pathname === '/login' && (await txt(p, 'h1')) === 'Log in or sign up', 'header Student login opens /login');
    await ctx.close(); }
  { const { ctx, p } = await newPage();
    await p.goto(ENV + '/'); await p.waitForTimeout(400); await p.click('#menu-btn');
    ok((await p.$$eval('#menu-panel a, #menu-panel button:not(.lang-switch button)', els => els.map(e => e.textContent.trim()).join(', '))) === 'Jobs, For employers', 'phone menu when logged out: Jobs, For employers');
    await p.click('#menu-btn'); await p.click('.site-header >> text=Student login'); await p.waitForTimeout(400);
    ok(new URL(p.url()).pathname === '/login', 'phone: Student login button opens /login');
    await ctx.close(); }

  // 3. Email step
  const { ctx, p, log } = await newPage();
  await p.goto(ENV + '/login'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.name === 'email'), 'email field is focused');
  ok((await p.getAttribute('input[name=email]', 'inputmode')) === 'email' && (await p.getAttribute('input[name=email]', 'autocapitalize')) === 'none', 'email field: email keyboard, no auto-capitals');
  ok((await txt(p, '.lead')) === "Use any email. A university email verifies that you're a student." && (await txt(p, 'label.field')).startsWith('Email'), 'student login: any email works, a university email verifies');
  ok((await txt(p, '#login-privacy')) === "We use your email to log you in and to check whether it's a university email on our list. See our Privacy Notice." && (await p.getAttribute('#login-privacy a', 'href')) === '/privacy', 'privacy line under the email field: what the email is used for, links to /privacy (nothing to "agree" to)');
  ok((await txt(p, '.login-disclaimer')) === 'GigoMe is an independent student project, not affiliated with or endorsed by any university.' && !/bocconi/i.test(await txt(p, 'main')) && log.universities === 0, 'student login: the independence line, no university named, universities not read on load');
  await p.fill('input[name=email]', 'not-an-email'); await p.click('text=Email me a code instead'); await p.waitForTimeout(200);
  ok((await txt(p, '.err')) === 'Enter your full email address, like name@university.it.' && log.otp.length === 0 && log.universities === 0, 'invalid email: message, nothing sent, universities not read');
  // "Which emails verify you as a student?": folded, under the independence line; the list is read only when opened, once.
  ok((await p.locator('.login-disclaimer + details.uni-details').count()) === 1 && !(await p.locator('.uni-details').evaluate((d) => d.open)) && (await txt(p, '.uni-details summary')) === 'Which emails verify you as a student?', 'student login: "Which emails verify you as a student?" folded under the independence line');
  await p.click('.uni-details summary'); await p.waitForTimeout(250);
  { const d = await txt(p, '.uni-details');
    ok(log.universities === 1 && (await items(p, '.uni-details .uni-list')) === UNI_LIST_TEXT && d.includes("A student email from one of these universities verifies that you're a student:")
       && d.includes("Any other email works too: after logging in, you tell us that you're a student and at which university.") && d.includes('Is your university missing? Email hello@gigome.org'),
       'opening it reads the universities once and lists each with its student domain: ' + (await items(p, '.uni-details .uni-list'))); }
  ok((await p.getAttribute('.uni-details a:has-text("Email hello@gigome.org")', 'href')) === 'mailto:hello@gigome.org?subject=Add%20my%20university%20to%20GigoMe', '"Is your university missing?" is a mailto link with a subject');
  await p.click('.uni-details summary'); await p.click('.uni-details summary'); await p.waitForTimeout(150);
  ok(log.universities === 1, 'closing and opening it again reads nothing more');
  await p.click('.uni-details summary');
  // Any email gets a code, marked as a student sign-up; the database decides whether it's verified. Nothing is refused.
  for (const any of ['someone@gmail.com', 'x@notstudbocconi.it', 'x@polimi.it', 'ana@mail.polimi.it', 'Ana@Studenti.Unimi.IT', 'ana.rossi01@icatt.it', 'a.rossi1@campus.unimib.it', 'ana@studenti.iulm.it', 'ana@st.hunimed.eu', 'ana@studenti.unisr.it']) {
    const g = await newPage(); await g.p.goto(ENV + '/login'); await g.p.waitForTimeout(200);
    await g.p.fill('input[name=email]', any); await g.p.click('text=Email me a code instead'); await g.p.waitForTimeout(300);
    ok(g.log.otp.length === 1 && g.log.otp[0].email === any.toLowerCase() && JSON.stringify(g.log.otp[0].data) === '{"signup_as":"student","language":"en"}' && g.log.universities === 0
       && (await g.p.locator('.auth-notice').count()) === 0 && (await txt(g.p, 'h1')) === 'Check your email', 'any email (' + any + '): code sent as a student sign-up, nothing refused, nothing checked in the browser');
    await g.ctx.close();
  }
  await p.fill('input[name=email]', '  Name.Surname@StudBocconi.IT '); await p.click('text=Email me a code instead'); await p.waitForTimeout(400);
  ok(log.otp.length === 1 && log.otp[0].email === 'name.surname@studbocconi.it' && log.otp[0].create_user === true && log.otp[0].data && log.otp[0].data.signup_as === 'student', 'code requested for the lowercased email, create_user true, signup_as student (' + JSON.stringify(log.otp[0] && { email: log.otp[0].email, create_user: log.otp[0].create_user, data: log.otp[0].data }) + ')');
  ok(!('options' in (log.otp[0] || {})) && !JSON.stringify(log.otp[0]).includes('redirect'), 'no magic-link redirect in the request');
  ok((await txt(p, 'h1')) === 'Check your email' && (await txt(p, '.lead')).includes('name.surname@studbocconi.it'), 'code step shows the email');
  ok((await txt(p, '#code-hint')).includes("Can't find it? Check your Junk or Spam folder and mark it as 'Not junk', so the next one arrives in your inbox."), 'junk folder hint shown');
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
  await p.click('text=Email me a code instead'); await p.waitForTimeout(400);
  // paste with a space, then success -> /welcome
  await p.locator('input[name=code]').fill('123 456'); await p.waitForTimeout(800);
  ok(log.verify.at(-1).token === '123456', 'pasted "123 456" is cleaned to 123456');
  ok(new URL(p.url()).pathname === '/welcome', 'new student goes to /welcome');
  ok((await txt(p, 'main')).includes('Logged in as name.surname@studbocconi.it'), 'welcome page shows who is logged in');
  ok((await p.locator('.student-question, select[name=university]').count()) === 0 && log.universities === 1, 'university email: no "Are you a student?" or "Which university?" questions');
  ok((await txt(p, '.header-user')) === 'name.surname@studbocconi.it', 'header shows the email until a name is saved');
  const degreeOptions = await p.$$eval('select[name=degree_level] option', os => os.map(o => o.value).filter(Boolean));
  ok(degreeOptions.join(',') === 'bachelor,master,single_cycle,phd,exchange,other', 'degree levels match the database: ' + degreeOptions.join(','));
  ok((await txt(p, '.terms-field label')) === "I'm 18 or older and I accept the Terms" && await p.getAttribute('.terms-field label a', 'href') === '/terms'
     && await p.getAttribute('.terms-field .field-hint a', 'href') === '/privacy' && await p.getAttribute('.terms-field label a', 'target') === '_blank',
     'welcome: "I\'m 18 or older and I accept the Terms", linking to /terms and /privacy (new tab, nothing typed is lost)');
  await p.click('text=Save and continue'); await p.waitForTimeout(200);
  ok((await p.locator('.field .err').count()) === 4 && (await txt(p, '.terms-field .err')) === 'Tick this box to continue.' && log.patch.length === 0 && !log.accept,
     'empty form: three field errors and the Terms box, nothing saved');
  await p.screenshot({ path: SHOTS + 'phone-welcome.png', fullPage: true });
  await p.fill('input[name=full_name]', '  Ana   Rossi '); await p.selectOption('select[name=degree_level]', 'master');
  const year = String(new Date().getFullYear() + 2); await p.selectOption('select[name=graduation_year]', year);
  await p.click('text=Save and continue'); await p.waitForTimeout(300);
  ok(log.patch.length === 0 && !log.accept && new URL(p.url()).pathname === '/welcome', 'details filled but the Terms box not ticked: nothing saved');
  await p.check('input[name=accept_terms]');
  await p.click('text=Save and continue'); await p.waitForTimeout(700);
  ok(JSON.stringify(log.accept) === '[{"p_version":"2.2"}]', 'the Terms acceptance is recorded with the version: ' + JSON.stringify(log.accept));
  ok(log.patch.length === 1 && log.patch[0].query.includes('id=eq.uid-1') && JSON.stringify(log.patch[0].body) === JSON.stringify({ full_name: 'Ana Rossi', degree_level: 'master', graduation_year: Number(year) }), 'saves only the three fields, on the own row: ' + JSON.stringify(log.patch[0]));
  ok(new URL(p.url()).pathname === '/welcome' && (await txt(p, 'h1')) === "You're all set, Ana." && (await txt(p, 'main')).includes("You're logged in as name.surname@studbocconi.it."), 'then the confirmation (signup.test.js checks it in full)');
  await p.click('.signup-done >> text=Browse jobs'); await p.waitForTimeout(500);
  ok(new URL(p.url()).pathname === '/jobs', 'Browse jobs opens the list');
  ok((await txt(p, '.header-user')) === 'Ana Rossi' && !(await txt(p, '.site-header')).includes('Student login'), 'header shows the saved name: ' + await txt(p, '.header-user'));
  await p.goto(ENV + '/login'); await p.waitForTimeout(300);
  ok((await txt(p, 'h1')) === "You're logged in", '/login while logged in offers "Go to GigoMe" and "Log out"');
  await p.goto(ENV + '/'); await p.waitForTimeout(400);
  await p.click('#menu-btn'); ok((await p.$$eval('#menu-panel > a, #menu-panel > button', els => els.map(e => e.textContent.trim()).join(', '))) === 'Jobs, Saved jobs, Ana Rossi, Log out', 'phone menu when logged in: Jobs, Saved jobs, name, Log out');
  await p.click('#menu-panel >> text=Log out'); await p.waitForTimeout(200);
  ok(log.logout.length === 0 && await p.locator('#menu-panel dialog.logout-dialog[open]').count() === 1, 'phone menu Log out: asks first, nothing logged out yet');
  await p.click('dialog.logout-dialog[open] button:has-text("Log out")'); await p.waitForTimeout(400);
  ok(log.logout.length === 1 && log.logout[0].includes('scope=local') && (await txt(p, '.site-header')).includes('Student login') && await p.locator('.header-user').count() === 0, 'log out from the phone menu: this device only, header back to Student login');
  await p.goto(ENV + '/welcome'); await p.waitForTimeout(300);
  ok(new URL(p.url()).pathname === '/login', '/welcome when logged out redirects to /login');
  await ctx.close();

  // 4. Returning student with a name goes straight home
  { const { ctx, p } = await newPage(phone, { fullName: 'Ana Rossi' });
    await p.goto(ENV + '/login'); await p.waitForTimeout(300);
    await p.fill('input[name=email]', 'ana@studbocconi.it'); await p.click('text=Email me a code instead'); await p.waitForTimeout(400);
    await p.fill('input[name=code]', '123456'); await p.waitForTimeout(800);
    ok(new URL(p.url()).pathname === '/', 'returning student with a name skips /welcome');
    await ctx.close(); }

  // 5. Expired code and resend timer (fake clock)
  { const { ctx, p, log } = await newPage();
    await p.clock.install();
    await p.goto(ENV + '/login'); await p.waitForTimeout(300);
    await p.fill('input[name=email]', 'late@studbocconi.it'); await p.click('text=Email me a code instead'); await p.waitForTimeout(400);
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

  // 5b. Any other email: a self-declared student answers "Are you a student?" and "Which university?" once.
  const signUp = async (p, email) => {
    await p.goto(ENV + '/login'); await p.waitForTimeout(300);
    await p.fill('input[name=email]', email); await p.click('text=Email me a code instead'); await p.waitForTimeout(400);
    await p.fill('input[name=code]', '123456'); await p.waitForTimeout(900);
  };
  { const { ctx, p, log } = await newPage(phone, { verification: 'self_declared' });
    await signUp(p, 'ana.rossi@gmail.com');
    ok(new URL(p.url()).pathname === '/welcome' && (await txt(p, '.student-question legend')) === 'Are you currently a university student?'
       && (await p.locator('select[name=university]').count()) === 0, 'any other email: /welcome asks "Are you currently a university student?" first');
    await p.click('text=Save and continue'); await p.waitForTimeout(200);
    ok((await txt(p, '.student-question .err')) === 'Choose Yes or No.' && log.patch.length === 0 && log.declare.length === 0 && !log.accept, 'nothing answered: "Choose Yes or No.", nothing saved');
    await p.check('input[name=is_student][value=yes]'); await p.waitForTimeout(100);
    const opts = await p.$$eval('select[name=university] option', (os) => os.map((o) => o.textContent.trim()).filter((t) => t !== 'Choose…'));
    ok(opts.join('|') === UNIVERSITIES.map((u) => u.name).join('|') + '|Other' && log.universities === 1, 'Yes: "Which university?" lists the universities from the table, then Other: ' + opts.join('|'));
    await p.selectOption('select[name=university]', 'other');
    await p.fill('input[name=full_name]', 'Ana Rossi'); await p.selectOption('select[name=degree_level]', 'bachelor');
    await p.selectOption('select[name=graduation_year]', String(new Date().getFullYear() + 1)); await p.check('input[name=accept_terms]');
    await p.click('text=Save and continue'); await p.waitForTimeout(200);
    ok((await txt(p, 'label:has(input[name=other_university]) .err')) === "Type your university's name." && log.declare.length === 0 && log.patch.length === 0, 'Other without a name: asks for it, nothing saved');
    await p.fill('input[name=other_university]', '  Accademia   di Brera ');
    await p.screenshot({ path: SHOTS + 'phone-welcome-self-declared.png', fullPage: true });
    await p.click('text=Save and continue'); await p.waitForTimeout(700);
    ok(JSON.stringify(log.declare) === '[{"p_university_id":null,"p_other_university":"Accademia di Brera"}]' && log.patch.length === 1 && log.accept && log.accept.length === 1,
       'Other: declare_student with the tidied name, once, with the details and the Terms: ' + JSON.stringify(log.declare));
    ok((await txt(p, 'h1')) === "You're all set, Ana.", 'then the confirmation');
    await p.goto(ENV + '/jobs'); await p.waitForTimeout(500);
    ok(new URL(p.url()).pathname === '/jobs', 'answered: TermsGate lets them through');
    await ctx.close(); }

  { const { ctx, p, log } = await newPage(phone, { verification: 'self_declared' });
    await signUp(p, 'luca@outlook.example');
    await p.check('input[name=is_student][value=yes]'); await p.waitForTimeout(100);
    await p.selectOption('select[name=university]', { label: 'Politecnico di Milano' });
    ok((await p.locator('input[name=other_university]').count()) === 0, 'a listed university: no name field');
    await p.fill('input[name=full_name]', 'Luca Bianchi'); await p.selectOption('select[name=degree_level]', 'master');
    await p.selectOption('select[name=graduation_year]', String(new Date().getFullYear() + 1)); await p.check('input[name=accept_terms]');
    await p.click('text=Save and continue'); await p.waitForTimeout(700);
    ok(JSON.stringify(log.declare) === JSON.stringify([{ p_university_id: UNIVERSITIES.find((u) => u.name === 'Politecnico di Milano').id, p_other_university: null }]), 'a listed university: declare_student with its id: ' + JSON.stringify(log.declare));
    await ctx.close(); }

  // "No": no student account. The login the code created is deleted and the page explains.
  { const { ctx, p, log } = await newPage(phone, { verification: 'self_declared' });
    await signUp(p, 'boss@company.example');
    await p.check('input[name=is_student][value=no]'); await p.waitForTimeout(150);
    const n = await txt(p, '.not-student');
    ok(n.includes("GigoMe is for university students, so we won't create a student account for boss@company.example.") && n.includes('You can still browse every job without an account.')
       && (await p.getAttribute('.not-student a', 'href')) === '/employers' && (await p.locator('input[name=full_name], input[name=accept_terms], select[name=university]').count()) === 0
       && (await txt(p, 'form button[type=submit]')) === "Don't create my account", 'No: explains, links to /employers, asks nothing else');
    await p.click("text=Don't create my account"); await p.waitForTimeout(700);
    ok(log.deleted === 1 && log.declare.length === 0 && log.patch.length === 0 && !log.accept && log.logout.length === 1 && log.logout[0].includes('scope=local'), 'No: the new account is deleted, nothing saved, logged out on this device');
    ok((await txt(p, 'h1')) === 'GigoMe is for university students' && (await p.getAttribute('main a.btn-primary', 'href')) === '/jobs'
       && (await p.getAttribute('main a.btn-secondary', 'href')) === '/employers' && (await txt(p, '.site-header')).includes('Student login'), 'then: browse jobs or the employer login, logged out');
    await ctx.close(); }

  // A self-declared student who skipped the questions is sent back to /welcome.
  { const { ctx, p } = await newPage(phone, { verification: 'self_declared', fullName: 'Ana Rossi' });
    await signUp(p, 'ana@gmail.com');
    ok(new URL(p.url()).pathname === '/welcome' && (await p.locator('.student-question').count()) === 1 && (await p.locator('input[name=full_name], input[name=accept_terms]').count()) === 0, 'name and Terms done, questions not: /welcome asks only the questions');
    await p.goto(ENV + '/jobs'); await p.waitForTimeout(600);
    ok(new URL(p.url()).pathname === '/welcome', 'TermsGate: not answered yet, /jobs goes to /welcome');
    await ctx.close(); }

  // One email, one role: a company account at the student login.
  { const { ctx, p, log } = await newPage(phone, { accountType: 'company', fullName: 'Caffè Owner' });
    await signUp(p, 'owner@cafe.example');
    ok(new URL(p.url()).pathname === '/login' && (await txt(p, 'h1')) === 'This email has an employer account'
       && (await txt(p, 'main')).includes("Each email has one role on GigoMe, so it can't also be a student account.")
       && (await p.getAttribute('.wrong-role a.btn-primary', 'href')) === '/employers' && (await p.locator('.wrong-role .auth-buttons > button:has-text("Log out")').count()) === 1 && log.declare.length === 0,
       'company email at the student login: says so, points to the employer login, offers Log out');
    await p.reload(); await p.waitForTimeout(500);
    ok((await txt(p, 'h1')) === 'This email has an employer account', 'and again when /login is opened while logged in');
    await ctx.close(); }

  // 6. Sending too many emails
  { const { ctx, p } = await newPage();
    await p.goto(ENV + '/login'); await p.waitForTimeout(300);
    await p.fill('input[name=email]', 'ratelimit@studbocconi.it'); await p.click('text=Email me a code instead'); await p.waitForTimeout(400);
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
    await p.goto(ENV + '/privacy'); await p.waitForSelector('.legal-doc');
    ok((await txt(p, 'h1')) === 'GigoMe | Privacy Notice', '/privacy page');
    await p.screenshot({ path: SHOTS + 'phone-privacy.png' });
    await p.goto(ENV + '/nope'); await p.waitForTimeout(200);
    ok((await txt(p, 'h1')) === 'Page not found', '404 still works');
    await ctx.close(); }

  ok(errs.length === 0, 'no JS errors: ' + errs.join(' | '));
  console.log(fails ? fails + ' FAILED' : 'LOGIN ALL PASSED'); await b.close();
})();
