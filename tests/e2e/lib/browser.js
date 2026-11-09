// Playwright's Chromium for the browser tests, with two additions:
//   * every page reports Content-Security-Policy violations; a suite that
//     caused any prints "FAIL CSP ..." when it closes the browser and exits
//     with an error, so the CSP in public/_headers is tested on every page
//     the suites open;
//   * OUT: where screenshots go (tests/e2e/.out, not committed).
const { chromium, devices } = require('playwright');
const { mkdirSync } = require('fs');
const { join } = require('path');

const OUT = process.env.E2E_OUT || join(__dirname, '..', '.out');
mkdirSync(OUT, { recursive: true });

const violations = new Set();

function watch(ctx) {
  ctx.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI || '(inline)'}`);
    });
  });
  ctx.on('console', (m) => {
    const t = m.text();
    if (/CSP violation|Content Security Policy/.test(t)) violations.add(`${t} (on ${m.page() ? m.page().url() : '?'})`);
  });
  return ctx;
}

async function launch(options) {
  const browser = await chromium.launch(options);
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => watch(await newContext(o));
  browser.newPage = async (o) => (await browser.newContext(o)).newPage();
  const close = browser.close.bind(browser);
  browser.close = async () => {
    await close();
    if (violations.size) {
      console.log('FAIL CSP: the page broke its Content-Security-Policy:\n  ' + [...violations].join('\n  '));
      process.exitCode = 1;
    }
  };
  return browser;
}

module.exports = { chromium: { launch }, devices, OUT };
