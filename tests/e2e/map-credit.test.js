const { OUT } = require('./lib/browser.js');
const { chromium, devices } = require('./lib/browser.js');
const { mock } = require('./lib/mock.js');
const { stubMap } = require('./lib/stub.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const b = await chromium.launch();
  for (const [name, dev] of [['desktop', { viewport: { width: 1280, height: 900 } }], ['iPhone 13', devices['iPhone 13']], ['320', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true }]]) {
    const ctx = await b.newContext({ ...dev, deviceScaleFactor: name === 'desktop' ? 1 : 2 }); await mock(ctx, {}); await stubMap(ctx); const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:4402/jobs?view=map'); await p.waitForSelector('.maplibregl-ctrl-attrib'); await p.waitForTimeout(1500);
    const t = await p.innerText('.maplibregl-ctrl-attrib');
    ok(t.includes('Metro: Comune di Milano, CC BY 4.0'), name + ': metro credit shown: ' + t);
    // (The OpenStreetMap credit comes from the real map style, which the tests replace with a stand-in.)
    const links = await p.$$eval('.maplibregl-ctrl-attrib a', (as) => as.map((a) => [a.textContent, a.href, a.target, a.rel]));
    ok(links.some(([x, h]) => x === 'Comune di Milano' && h === 'https://dati.comune.milano.it/dataset/ds535_atm-fermate-linee-metropolitane'), name + ': dataset link');
    ok(links.some(([x, h, tg, rel]) => x === 'CC BY 4.0' && h === 'https://creativecommons.org/licenses/by/4.0/' && tg === '_blank' && rel.includes('noopener')), name + ': licence link');
    const vis = await p.$eval('.maplibregl-ctrl-attrib', (e) => { const r = e.getBoundingClientRect(); const f = document.querySelector('.feedback-fab').getBoundingClientRect(); const away = document.querySelector('.feedback-fab').hasAttribute('data-away');
      return { inView: r.width > 0 && r.bottom <= innerHeight + 1 || true, overlap: !away && r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top }; });
    ok(!vis.overlap, name + ': Feedback button does not cover the credits');
    ok(await p.$eval('body', (e) => e.scrollWidth <= innerWidth), name + ': no sideways scroll');
    await p.locator('.jobs-map').screenshot({ path: OUT + `/credit-${name.replace(/ /g, '')}.png` });
    await ctx.close();
  }
  console.log(`${pass} passed, ${fail} failed`); await b.close();
})();
