const { chromium, devices } = require('./lib/browser.js');
const { mock } = require('./lib/mock.js');
const T = 'http://127.0.0.1:4403', E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
// Stand-in for Cloudflare's script: hands out numbered tokens.
const FAKE = `window.turnstile = { n: 0, w: {}, render(el, o) { const id = 'w' + (++this.n); this.w[id] = { o, k: 1 }; (window.__ts = window.__ts || []).push({ sitekey: o.sitekey, action: o.action, appearance: o.appearance });
  setTimeout(() => o.callback('tok-' + id + '-1'), 60); return id; },
  reset(id) { const x = this.w[id]; x.k++; setTimeout(() => x.o.callback('tok-' + id + '-' + x.k), 60); }, remove(id) { delete this.w[id]; } };`;
async function setup(b, opts = {}) {
  const ctx = await b.newContext(devices['iPhone 13']); const log = await mock(ctx, opts);
  log.ts = 0; log.verify = [];
  await ctx.route('https://challenges.cloudflare.com/**', (r) => { log.ts++; return opts.blockTs ? r.abort() : r.fulfill({ contentType: 'application/javascript', body: FAKE }); });
  await ctx.route('https://testproj.supabase.co/auth/v1/verify', (r) => { log.verify.push(r.request().postDataJSON()); return r.fallback(); });
  if (opts.captchaFail) await ctx.route('https://testproj.supabase.co/auth/v1/otp', (r) => r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 400, error_code: 'captcha_failed', msg: 'captcha protection: request disallowed (timeout-or-duplicate)' }) }));
  return { ctx, log, p: await ctx.newPage() };
}
(async () => {
  const b = await chromium.launch();
  // student login with Turnstile
  { const { ctx, log, p } = await setup(b);
    await p.goto(T + '/login'); await p.waitForTimeout(400);
    const w = await p.evaluate(() => window.__ts);
    ok(log.ts === 1 && w && w[0].sitekey === '1x00000000000000000000AA' && w[0].appearance === 'interaction-only' && w[0].action === 'login', 'student login: Turnstile loaded once with the site key, invisible unless needed');
    await p.fill('input[name=email]', 'ana@studbocconi.it'); await p.click('text=Send me a code'); await p.waitForTimeout(500);
    ok(log.otp[0] && log.otp[0].gotrue_meta_security && log.otp[0].gotrue_meta_security.captcha_token === 'tok-w1-1', 'code request carries the token: ' + JSON.stringify(log.otp[0] && log.otp[0].gotrue_meta_security));
    await p.waitForTimeout(500);
    const resend = p.locator('button:has-text("Send a new code")');
    await p.evaluate(() => {}); // the resend button waits 60 s; skip ahead by checking the token flow through verify
    await p.fill('input[name=code]', '111111'); await p.waitForTimeout(500);
    ok(log.verify[0] && log.verify[0].gotrue_meta_security && /^tok-w2-/.test(log.verify[0].gotrue_meta_security.captcha_token), 'code check carries a fresh token (new widget on the code step): ' + JSON.stringify(log.verify[0] && log.verify[0].gotrue_meta_security));
    await p.waitForTimeout(300);
    await p.fill('input[name=code]', '123456'); await p.waitForTimeout(900);
    ok(log.verify[1] && log.verify[1].gotrue_meta_security.captcha_token !== log.verify[0].gotrue_meta_security.captcha_token, 'every attempt uses a new token (tokens work once)');
    ok(new URL(p.url()).pathname !== '/login', 'logged in: ' + p.url());
    await ctx.close(); }
  // employer login with Turnstile
  { const { ctx, log, p } = await setup(b, { accountType: 'company' });
    await p.goto(T + '/employers'); await p.waitForTimeout(400);
    await p.fill('input[name=email]', 'owner@cafe.it'); await p.click('text=Send me a code'); await p.waitForTimeout(500);
    ok(log.otp[0] && log.otp[0].gotrue_meta_security.captcha_token === 'tok-w1-1', 'employer login: code request carries the token');
    await ctx.close(); }
  // Turnstile blocked: clear message, no code request
  { const { ctx, log, p } = await setup(b, { blockTs: true });
    await p.goto(T + '/login'); await p.waitForTimeout(600);
    ok((await p.innerText('main')).includes("We couldn't load the check that keeps bots out.") && await p.locator('button:has-text("Send me a code")').isDisabled(), 'script blocked: message, Send disabled');
    ok(!log.otp.length, 'script blocked: nothing sent');
    await ctx.close(); }
  // Supabase refuses the token
  { const { ctx, log, p } = await setup(b, { captchaFail: true });
    await p.goto(T + '/login'); await p.waitForTimeout(400);
    await p.fill('input[name=email]', 'ana@studbocconi.it'); await p.click('text=Send me a code'); await p.waitForTimeout(600);
    ok((await p.innerText('main')).includes("We couldn't confirm you're not a bot. Please try again."), 'captcha refused: friendly message');
    await p.waitForTimeout(300);
    ok(!(await p.locator('button:has-text("Send me a code")').isDisabled()), 'captcha refused: a new token arrives, can try again');
    await ctx.close(); }
  // no site key: no Turnstile at all
  { const { ctx, log, p } = await setup(b);
    await p.goto(E + '/login'); await p.waitForTimeout(400);
    await p.fill('input[name=email]', 'ana@studbocconi.it'); await p.click('text=Send me a code'); await p.waitForTimeout(500);
    ok(log.ts === 0 && log.otp[0] && !log.otp[0].gotrue_meta_security?.captcha_token, 'no site key: script never loaded, no token sent, login works as before');
    await ctx.close(); }
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`);
})();
