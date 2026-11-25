// Passwords (CodeLogin.jsx, PasswordFields.jsx, src/lib/password.js): the
// email code is needed once, at sign-up; afterwards email and password, with
// "Email me a code instead" as the fallback and "Forgot your password?" as a
// code login followed by a new password. Accounts without a password are
// asked after each code login ("Not now" skips it). Nothing but the login
// code is ever emailed. Turnstile on the password login: turnstile.test.js.
const { chromium } = require('./lib/browser.js');
const { mock, login, passwordLogin } = require('./lib/mock.js');
const { emock, employerLogin } = require('./lib/emock.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const desk = { viewport: { width: 1280, height: 900 } };
const phone = { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true };
const path = (p) => new URL(p.url()).pathname;
const PW = 'correct horse battery';
const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const cutOff = (p, sel) => p.$$eval(sel, (els) => els.filter((e) => e.offsetParent !== null).filter((e) => {
  const r = e.getBoundingClientRect(); return e.scrollWidth > e.clientWidth + 1 || r.left < -0.5 || r.right > innerWidth + 0.5;
}).map((e) => e.tagName + ' ' + e.textContent.trim().slice(0, 30)));
async function fillNew(p, a, b = a) { await p.fill('input[name=new-password]', a); await p.fill('input[name=confirm-password]', b); }

(async () => {
  const b = await chromium.launch();

  // ---- The student login: password first, the code as the fallback
  { const ctx = await b.newContext(desk); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login?next=/saved'); await p.waitForTimeout(300);
    ok(await p.getAttribute('input[name=password]', 'type') === 'password' && await p.getAttribute('input[name=password]', 'autocomplete') === 'current-password', 'password field, for password managers');
    ok(await p.getAttribute('input[name=email]', 'autocomplete') === 'username', 'the email is the username');
    ok((await txt(p, 'form button[type=submit]')) === 'Log in' && await p.locator('button:has-text("Email me a code instead")').count() === 1 && await p.locator('button:has-text("Forgot your password?")').count() === 1, 'Log in, Email me a code instead, Forgot your password?');
    ok((await txt(p, '.login-code-option')).includes('New to GigoMe, or no password yet? We\'ll email you a 6-digit code.'), 'how to sign up is said next to the code button');
    await p.fill('input[name=email]', 'ana@studbocconi.it'); await p.click('form button[type=submit]'); await p.waitForTimeout(200);
    ok((await txt(p, '.err')) === 'Enter your password, or press "Email me a code instead".' && !log.passwordLogins && log.otp.length === 0, 'no password typed: a message, nothing sent');
    await p.fill('input[name=password]', 'wrong password'); await p.click('form button[type=submit]'); await p.waitForTimeout(400);
    ok((await txt(p, '.err')).startsWith("That email and password don't match.") && log.passwordLogins.length === 1 && path(p) === '/login', 'wrong password: says so, points to the code, stays');
    await p.check('input[name=show-password]'); ok(await p.getAttribute('input[name=password]', 'type') === 'text', 'Show password shows it');
    await p.fill('input[name=password]', PW); await p.click('form button[type=submit]'); await p.waitForTimeout(900);
    ok(path(p) === '/saved' && log.passwordLogins[1].email === 'ana@studbocconi.it' && log.otp.length === 0, 'right password: logged in, on to ?next=, no email sent: ' + p.url());
    ok(!log.hasPasswordCalls, 'a password login never asks to set a password');
    await ctx.close(); }

  // ---- A company account on the student login: one email, one role, as with the code
  { const ctx = await b.newContext(desk); await mock(ctx, { accountType: 'company' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await passwordLogin(p, 'owner@cafe.it');
    ok((await txt(p, 'h1')) === 'This email has an employer account', 'company account on the student login is told so');
    await ctx.close(); }

  // ---- An account without a password, after a code login: asked, can skip
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { hasPassword: false }); const p = await ctx.newPage();
    await p.goto(E + '/login?next=/saved'); await login(p);
    ok((await txt(p, 'h1')) === 'Set a password' && path(p) === '/login', 'asked to set a password after the code');
    ok((await txt(p, '.lead')).includes('ana@studbocconi.it') && (await txt(p, '.password-rules')).startsWith('At least 10 characters.'), 'the email and the rules, as visible text');
    ok(await p.evaluate(() => document.activeElement && document.activeElement.tagName === 'H1'), 'the heading takes the focus');
    ok((await txt(p, 'main')).includes("Not now? We'll ask again the next time you log in with a code."), 'says it asks again');
    await p.click('button:has-text("Not now")'); await p.waitForTimeout(400);
    ok(path(p) === '/saved' && !log.passwordUpdates, 'Not now: on to ?next=, nothing set');
    await ctx.close(); }

  // ---- ... and sets one: the rules, then saved without any other email
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { hasPassword: false }); const p = await ctx.newPage();
    await p.goto(E + '/login?next=/saved'); await login(p);
    await p.click('button:has-text("Save password")'); await p.waitForTimeout(200);
    ok((await txt(p, '.password-fields .err')) === 'Choose a password.', 'nothing typed');
    await fillNew(p, 'short'); await p.click('button:has-text("Save password")'); await p.waitForTimeout(200);
    ok((await txt(p, '.password-fields .err')) === 'Use at least 10 characters.', 'too short');
    await fillNew(p, 'ana@studbocconi.it'); await p.click('button:has-text("Save password")'); await p.waitForTimeout(200);
    ok((await txt(p, '.password-fields .err')) === "Don't use your email address as your password.", 'not the email');
    await fillNew(p, PW, PW + '!'); await p.click('button:has-text("Save password")'); await p.waitForTimeout(200);
    ok((await txt(p, '.password-fields .err')) === "The two passwords don't match." && !log.passwordUpdates, 'typed twice differently; nothing sent so far');
    await fillNew(p, PW); await p.click('button:has-text("Save password")'); await p.waitForTimeout(600);
    ok(path(p) === '/saved' && JSON.stringify(log.passwordUpdates) === JSON.stringify([PW]), 'saved, then on to ?next=');
    ok(log.otp.length === 1 && !log.otherEmails, 'one email in all: the login code (no reauthentication or reset email)');
    await ctx.close(); }

  // ---- Supabase refuses: a leaked password, a login too old
  { const ctx = await b.newContext(desk); await mock(ctx, { hasPassword: false, passwordError: 'pwned' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await fillNew(p, PW); await p.click('button:has-text("Save password")'); await p.waitForTimeout(500);
    ok((await txt(p, '.password-fields .err')).startsWith('This password has appeared in a data leak') && (await txt(p, 'h1')) === 'Set a password', 'leaked password: says so, stays');
    await ctx.close(); }
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { hasPassword: false, passwordError: 'reauth' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await fillNew(p, PW); await p.click('button:has-text("Save password")'); await p.waitForTimeout(500);
    ok((await txt(p, '.password-fields .err')).startsWith('For your security, a password can only be set soon after logging in with an email code.') && !log.otherEmails, 'reauthentication needed: explained, no email asked for');
    await ctx.close(); }

  // ---- Forgot your password?: a code, then a new password (even with one)
  { const ctx = await b.newContext(desk); const log = await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/login?next=/saved'); await p.click('button:has-text("Forgot your password?")'); await p.waitForTimeout(200);
    ok((await txt(p, '.err')) === 'Enter your full email address, like name@university.it.' && log.otp.length === 0, 'needs the email first');
    await p.fill('input[name=email]', 'ana@studbocconi.it'); await p.click('button:has-text("Forgot your password?")'); await p.waitForTimeout(400);
    ok(log.otp.length === 1 && log.otp[0].data && log.otp[0].data.signup_as === 'student' && (await txt(p, 'h1')) === 'Check your email', 'sends the login code (the same email as always)');
    await p.reload(); await p.waitForTimeout(400);
    await p.fill('input[name=code]', '123456'); await p.waitForTimeout(900);
    ok((await txt(p, 'h1')) === 'Choose a new password' && !(await txt(p, 'main')).includes('Not now?'), 'after the code (even after a reload): Choose a new password');
    await fillNew(p, 'a new long passphrase'); await p.click('button:has-text("Save password")'); await p.waitForTimeout(600);
    ok(path(p) === '/saved' && JSON.stringify(log.passwordUpdates) === '["a new long passphrase"]' && !log.otherEmails, 'set, then on to ?next=; no reset link');
    await ctx.close(); }

  // ---- A new student: no prompt after the code; /welcome asks for the password
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { fullName: null, hasPassword: false, termsVersion: null }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p, 'new@studbocconi.it');
    ok(path(p) === '/welcome' && (await txt(p, 'h1')) === 'Welcome to GigoMe', 'straight to /welcome: ' + p.url());
    ok(await p.locator('input[name=new-password]').count() === 1, '/welcome asks for a password');
    await p.fill('input[name=full_name]', 'Nuova Studentessa'); await p.selectOption('select[name=degree_level]', 'master'); await p.selectOption('select[name=graduation_year]', { index: 2 });
    await p.check('input[name=accept_terms]'); await p.click('button:has-text("Save and continue")'); await p.waitForTimeout(300);
    ok((await txt(p, '.password-fields .err')) === 'Choose a password.' && !log.patches, 'required: nothing saved without it');
    await fillNew(p, PW); await p.click('button:has-text("Save and continue")'); await p.waitForTimeout(800);
    ok(JSON.stringify(log.passwordUpdates) === JSON.stringify([PW]) && log.patches && log.patches.length === 1 && log.acceptTerms, 'password, then details and Terms');
    ok((await txt(p, 'main')).includes('Next time, log in on the login page with this email and your password.'), 'the confirmation says how to log in next time');
    ok(log.otp.length === 1 && !log.otherEmails, 'one email in all');
    await ctx.close(); }

  // ---- /welcome when Supabase wants a fresher login: the sign-up still completes
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { fullName: null, hasPassword: false, termsVersion: null, passwordError: 'reauth' }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p, 'new@studbocconi.it');
    await p.fill('input[name=full_name]', 'Nuova Studentessa'); await p.selectOption('select[name=degree_level]', 'master'); await p.selectOption('select[name=graduation_year]', { index: 2 });
    await fillNew(p, PW); await p.check('input[name=accept_terms]'); await p.click('button:has-text("Save and continue")'); await p.waitForTimeout(800);
    ok(log.patches && log.patches.length === 1 && (await txt(p, 'main')).includes("we'll send you a new 6-digit code. You can set a password after that login."), 'saved anyway; next login by code, which offers the password');
    await ctx.close(); }

  // ---- Employers: password login, and the setup asks for a password
  { const ctx = await b.newContext(desk); const { log } = await emock(ctx, { company: { name: 'Cafe', status: 'approved' } }); const p = await ctx.newPage();
    await p.goto(E + '/employers'); await passwordLogin(p, 'owner@cafe.it');
    ok(path(p) === '/dashboard' && log.passwordLogins.length === 1 && log.otp.length === 0, 'employer password login: on to the dashboard, no email');
    await ctx.close(); }
  { const ctx = await b.newContext(desk); const { log, db } = await emock(ctx, { hasPassword: false, termsVersion: null }); const p = await ctx.newPage();
    await employerLogin(p, E);
    ok(path(p) === '/employers/setup' && await p.locator('input[name=new-password]').count() === 1, 'a new company account: no prompt, the setup asks for a password');
    await p.fill('input[name=company_name]', 'Cafe Navigli'); await p.check('input[name=accept_terms]'); await p.click('button:has-text("Save company")'); await p.waitForTimeout(400);
    ok((await txt(p, '.password-fields .err')) === 'Choose a password.' && !db.company, 'required: no company created without it');
    await fillNew(p, PW); await p.click('button:has-text("Save company")'); await p.waitForTimeout(900);
    ok(JSON.stringify(log.passwordUpdates) === JSON.stringify([PW]) && db.company && (await txt(p, 'main')).includes('Next time, log in on the For employers page with this email and your password.'), 'password set, company created, how to log in next time');
    ok(log.otp.length === 1 && !log.otherEmails, 'one email in all');
    await ctx.close(); }
  { const ctx = await b.newContext(desk); const { log } = await emock(ctx, { hasPassword: false, company: { name: 'Cafe', status: 'approved' } }); const p = await ctx.newPage();
    await employerLogin(p, E);
    ok((await txt(p, '.set-password h1')) === 'Set a password', 'an existing company account without a password is asked after the code');
    await p.click('button:has-text("Not now")'); await p.waitForTimeout(500);
    ok(path(p) === '/dashboard' && !log.passwordUpdates, 'Not now: the dashboard');
    await ctx.close(); }

  // ---- /account: Password
  { const ctx = await b.newContext(desk); const log = await mock(ctx, { hasPassword: false }); const p = await ctx.newPage();
    await p.goto(E + '/login'); await login(p); await p.click('button:has-text("Not now")'); await p.waitForTimeout(300);
    await p.goto(E + '/account'); await p.waitForSelector('.account-password');
    ok((await txt(p, '.account-password')).includes("You don't have a password yet") && await p.locator('.account-password input').count() === 0, '/account: no password yet, the form is folded');
    await p.click('.account-password button:has-text("Set a password")'); await fillNew(p, PW); await p.click('.account-password button:has-text("Save password")'); await p.waitForTimeout(500);
    ok((await txt(p, '.account-password')).includes('Your password is saved.') && (await txt(p, '.account-password')).includes('You log in with your email and password.') && (await txt(p, '.account-password button')) === 'Change password', 'saved: status and Change password');
    await ctx.close(); }

  // ---- Phones at 320px: nothing cut off or sideways, English and Italian
  for (const lang of ['en', 'it']) {
    const ctx = await b.newContext(phone); await ctx.addInitScript((l) => { try { localStorage.setItem('gigome-lang', l); } catch {} }, lang);
    await mock(ctx, { hasPassword: false }); const p = await ctx.newPage();
    for (const page of ['/login', '/employers']) {
      await p.goto(E + page); await p.waitForTimeout(500);
      ok(!(await sideways(p)) && (await cutOff(p, '.auth-card button, .auth-card label, .auth-card a')).length === 0, `${lang} ${page} at 320px: nothing sideways or cut off: ` + JSON.stringify(await cutOff(p, '.auth-card button, .auth-card label, .auth-card a')));
    }
    await p.goto(E + '/login'); await login(p); await p.waitForTimeout(300);
    ok(!(await sideways(p)) && (await cutOff(p, '.auth-card button, .auth-card label')).length === 0, `${lang} Set a password at 320px: nothing sideways or cut off`);
    if (lang === 'it') ok((await txt(p, 'h1')) === 'Imposta una password' && await p.locator('button:has-text("Non ora")').count() === 1, 'Italian: Imposta una password, Non ora');
    await ctx.close();
  }

  await b.close();
  console.log(`${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
})();
