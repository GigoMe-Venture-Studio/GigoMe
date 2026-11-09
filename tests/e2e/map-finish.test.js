const { chromium, devices } = require('./lib/browser.js');
const { mock, ID } = require('./lib/mock.js');
const { amock, login } = require('./lib/amock.js');
const { stubMap } = require('./lib/stub.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const PV = { latitude: 45.4752, longitude: 9.2071 }; // near Porta Venezia
const ready = (p) => p.waitForSelector('.jobs-map[data-state=ready]', { timeout: 15000 }).then(() => true, () => false);
const ds = (p, k) => p.$eval('.jobs-map', (e, k) => e.dataset[k], k);
const status = (p) => p.innerText('.jobs-status span.muted');
const titles = (p) => p.$$eval('.jobs-list-col > .job-list .role-title', (e) => e.map((x) => x.textContent));
async function drag(p, dx, dy) {
  const b = await p.locator('.jobs-map canvas').boundingBox();
  const x = b.x + b.width * 0.75, y = b.y + 140;
  await p.mouse.move(x, y); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10); await p.waitForTimeout(16); } await p.mouse.up();
  await p.waitForTimeout(800);
}
async function newPage(b, opts = {}, mockOpts = {}) {
  const ctx = await b.newContext({ ...desk, ...opts }); const log = await mock(ctx, mockOpts); await stubMap(ctx, log);
  const reqs = []; ctx.on('request', (r) => reqs.push({ url: r.url(), body: r.postData() || '' }));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  return { ctx, p, reqs, errs, log };
}

(async () => {
  const b = await chromium.launch();

  // ---- 1. Metro lines, toggle, credit (desktop)
  { const { ctx, p, errs } = await newPage(b);
    await p.goto(E + '/jobs?view=map&map=14.0/45.4700/9.1950'); ok(await ready(p), 'map loads at the shared position');
    await p.waitForTimeout(1500);
    ok(Number(await ds(p, 'metro')) > 5, 'metro lines and stations drawn: ' + await ds(p, 'metro'));
    const t = p.locator('.metro-toggle-btn');
    ok(await t.getAttribute('aria-pressed') === 'true' && (await t.innerText()) === 'Metro', 'Metro toggle shown, on');
    ok((await p.innerText('.maplibregl-ctrl-attrib')).includes('Metro: Comune di Milano, CC BY 4.0'), 'credit');
    await t.click(); await p.waitForTimeout(800);
    ok(await t.getAttribute('aria-pressed') === 'false' && (await ds(p, 'metro')) === '0', 'Metro off: nothing drawn');
    await p.reload(); await ready(p); await p.waitForTimeout(1200);
    ok(await p.getAttribute('.metro-toggle-btn', 'aria-pressed') === 'false' && (await ds(p, 'metro')) === '0', 'the choice is kept in this tab');
    ok(await p.evaluate(() => localStorage.getItem('gigome.metro') === null && sessionStorage.getItem('gigome.metro') === 'off'), 'kept in sessionStorage only (per tab), never localStorage');
    await p.click('.metro-toggle-btn'); await p.waitForTimeout(800);
    ok(Number(await ds(p, 'metro')) > 5, 'Metro back on');
    const geo = await (await p.request.get(E + '/metro/milan-metro.geojson')).json();
    const lines = new Set(geo.features.filter((f) => f.properties.kind === 'line').map((f) => f.properties.line));
    ok([...lines].sort().join() === 'M1,M2,M3,M4,M5' && geo.features.filter((f) => f.properties.kind === 'station').length === 125, 'the file has M1-M5 and 125 stations');
    ok(errs.length === 0, 'no page errors: ' + errs.join('; '));
    await ctx.close(); }

  // ---- 2. Search as I move the map (desktop), map position in the URL
  { const { ctx, p } = await newPage(b);
    await p.goto(E + '/jobs?view=map'); await ready(p); await p.waitForTimeout(1200);
    ok(await p.isChecked('.map-follow input'), 'desktop: "Search as I move the map" on by default');
    ok((await status(p)).startsWith('2 jobs in this map area · 4 remote or without a location'), 'list limited to the map: ' + await status(p));
    ok((await titles(p)).join('|') === 'Weekend barista|English tutor', 'the 2 jobs on the map: ' + (await titles(p)).join('|'));
    ok(await p.locator('.jobs-elsewhere .role-title').count() === 4 && (await p.innerText('.jobs-elsewhere h2')) === 'Remote / no location', 'the 4 others in "Remote / no location"');
    ok(!new URL(p.url()).searchParams.get('map'), 'no position in the URL before the map is moved');
    // zoom to Porta Venezia via moving the map
    await p.goto(E + '/jobs?view=map&map=15.0/45.4740/9.2040'); await ready(p); await p.waitForTimeout(1200);
    ok((await titles(p)).join('|') === 'Weekend barista', 'shared position: map there, list limited to it');
    await drag(p, -400, 0); await drag(p, -400, 0);
    const moved = new URL(p.url()).searchParams.get('map');
    ok(moved && moved !== '15.0/45.4740/9.2040', 'moving the map updates ?map= : ' + moved);
    ok((await ds(p, 'view')) === moved, 'URL matches the map');
    ok((await titles(p)).length === 0 && (await p.innerText('.jobs-list-col')).includes('No jobs in this part of the map.'), 'moved away: no jobs here, says so');
    ok(await p.locator('.jobs-elsewhere .role-title').count() === 4, 'remote ones still listed below');
    await p.uncheck('.map-follow input'); await p.waitForTimeout(400);
    ok((await titles(p)).length === 6 && await p.locator('.jobs-elsewhere').count() === 0 && (await status(p)) === '6 jobs', 'option off: every job, no group');
    await p.check('.map-follow input'); await p.waitForTimeout(400);
    ok((await titles(p)).length === 0, 'option on again: limited again');
    // filters don't move a map the person chose
    const before = await ds(p, 'view');
    await p.selectOption('select[name=type]', 'part_time'); await p.waitForTimeout(900);
    ok((await ds(p, 'view')) === before && new URL(p.url()).searchParams.get('map') === moved, 'changing a filter keeps the map where it is');
    ok(new URL(p.url()).searchParams.get('type') === 'part_time', 'filter and position both in the URL');
    await p.click('.view-toggle button:has-text("List")'); await p.waitForTimeout(400);
    ok((await titles(p)).length === 2 && new URL(p.url()).searchParams.get('map') === moved, 'List view: not limited; position kept in the URL');
    await ctx.close(); }

  // ---- 5. Markers: pay when zoomed in, clusters with counts, popup (desktop)
  { const { ctx, p } = await newPage(b);
    await p.goto(E + '/jobs?view=map&map=15.0/45.4740/9.2040'); await ready(p); await p.waitForTimeout(1200);
    ok(await p.$eval('.jobs-map', (e) => e.classList.contains('show-pay')), 'zoomed in: pay shown');
    ok((await p.innerText('.job-marker')).trim() === '€11/h' && (await p.getAttribute('.job-marker', 'aria-label')) === 'Weekend barista, Nebbia Coffee Bar, €11/h', 'marker shows €11/h, named for screen readers');
    await p.focus('.job-marker'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
    ok((await p.innerText('.maplibregl-popup')).includes('Weekend barista') && (await p.innerText('.maplibregl-popup')).includes('M1 Porta Venezia'), 'Enter on a marker opens its card (with the metro)');
    await p.goto(E + '/jobs?view=map&map=10.0/45.4700/9.1900'); await ready(p); await p.waitForTimeout(1500);
    ok(!(await p.$eval('.jobs-map', (e) => e.classList.contains('show-pay'))), 'zoomed out: no pay');
    ok(Number(await ds(p, 'clusters')) >= 1 && (await ds(p, 'markers')) === '0', 'zoomed out: a cluster, no single markers: clusters ' + await ds(p, 'clusters'));
    await ctx.close(); }

  // ---- 3. Use my location: centre, dot, sort, never stored or sent
  { const { ctx, p, reqs } = await newPage(b, { geolocation: PV, permissions: ['geolocation'] });
    await p.goto(E + '/jobs?view=map&map=12.0/45.4600/9.1800'); await ready(p); await p.waitForTimeout(1000);
    ok((await p.innerText('.locate-row')).includes('Stays on your device: never sent to GigoMe or saved.'), 'the promise is next to the button');
    ok(await p.locator('.you-dot').count() === 0, 'nothing asked before the press');
    const urlBefore = p.url(); const nReq = reqs.length;
    await p.click('button:has-text("Use my location")'); await p.waitForTimeout(1500);
    ok(await p.locator('.you-dot').count() === 1 && (await p.getAttribute('.you-dot', 'aria-label')) === 'You are here', '"You are here" dot');
    const v = (await ds(p, 'view')).split('/');
    ok(Math.abs(Number(v[1]) - PV.latitude) < 0.002 && Math.abs(Number(v[2]) - PV.longitude) < 0.002 && Number(v[0]) >= 14, 'map centred on the person: ' + v.join('/'));
    ok(p.url() === urlBefore, 'the URL did not change (no position saved): ' + p.url());
    await p.check('.locate-sort input'); await p.waitForTimeout(300);
    await p.uncheck('.map-follow input'); await p.waitForTimeout(400);
    const t = await titles(p);
    ok(t[0] === 'Weekend barista' && t[1] === 'English tutor', 'sorted by distance: nearest first: ' + t.join('|'));
    ok((await p.innerText('.job-list li:first-child .job-distance')).match(/^\d+ m away$/), 'distance on the card: ' + await p.innerText('.job-list li:first-child .job-distance'));
    await drag(p, 200, 100);
    ok(p.url() === urlBefore, 'moving the map while located still saves nothing');
    const leak = reqs.slice(nReq).filter((r) => /45\.475|9\.207/.test(r.url + r.body));
    ok(leak.length === 0, 'no request carried the location: ' + leak.map((r) => r.url).join(' '));
    const stored = await p.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    ok(!/45\.47|9\.20/.test(stored), 'nothing stored: ' + stored);
    await p.click('button:has-text("Stop using my location")'); await p.waitForTimeout(400);
    ok(await p.locator('.you-dot').count() === 0 && await p.locator('.job-distance').count() === 0, 'stop: dot and distances gone');
    await ctx.close(); }
  { const { ctx, p } = await newPage(b, {});
    await p.goto(E + '/jobs?view=map'); await ready(p);
    await p.click('button:has-text("Use my location")'); await p.waitForTimeout(1500);
    ok((await p.innerText('.locate-row')).match(/turned off for this site|couldn't find your location/), 'no permission: says so: ' + await p.innerText('.locate-row'));
    await ctx.close(); }

  // ---- phones: "Search this area", bottom card
  { const { ctx, p } = await newPage(b, devices['iPhone 13']);
    await p.goto(E + '/jobs?view=map'); await ready(p); await p.waitForTimeout(1200);
    ok(await p.locator('.map-follow').count() === 0 && await p.locator('.map-search-area').count() === 0, 'phone: no follow option, no button before moving');
    ok((await status(p)) === '6 jobs', 'phone: not limited until asked');
    await p.click('.maplibregl-ctrl-zoom-in'); await p.waitForTimeout(700);
    ok(await p.locator('.map-search-area').isVisible(), 'phone: "Search this area" after moving the map');
    await p.click('.map-search-area'); await p.waitForTimeout(400);
    ok(/in this map area/.test(await status(p)) && !(await p.locator('.map-search-area').count()), 'phone: searched this area: ' + await status(p));
    await p.click('.view-toggle button:has-text("List")'); await p.waitForTimeout(400);
    ok(await p.locator('.jobs-elsewhere').isVisible(), 'phone list: limited, with the "Remote / no location" group');
    await p.click('button:has-text("Show all jobs")'); await p.waitForTimeout(300);
    ok((await status(p)) === '6 jobs', 'Show all jobs');
    await p.click('.view-toggle button:has-text("Map")'); await ready(p);
    await p.goto(E + '/jobs?view=map&map=15.0/45.4761/9.2073'); await ready(p); await p.waitForTimeout(1200);
    await p.tap('.job-marker'); await p.waitForTimeout(500);
    ok(await p.locator('.map-sheet').isVisible() && (await p.innerText('.map-sheet')).includes('Weekend barista') && await p.locator('.maplibregl-popup').count() === 0, 'phone: tapping a marker opens the bottom card');
    const sb = await p.locator('.map-sheet').boundingBox(), mb = await p.locator('.jobs-map').boundingBox();
    ok(Math.abs(sb.y + sb.height - (mb.y + mb.height)) < 12, 'card sits at the bottom of the map');
    await p.click('.map-sheet a.map-card-title'); await p.waitForTimeout(700);
    ok(new URL(p.url()).pathname === '/jobs/' + ID(1), 'card opens the job');
    await p.goBack(); await ready(p); await p.waitForTimeout(1000);
    await p.tap('.job-marker'); await p.waitForTimeout(400); await p.click('.map-sheet-close'); await p.waitForTimeout(300);
    ok(await p.locator('.map-sheet').count() === 0, 'card closes');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone: no sideways scroll');
    await ctx.close(); }

  // ---- 4. Job page map
  { const { ctx, p, reqs } = await newPage(b, devices['iPhone 13']);
    await p.goto(E + '/jobs/' + ID(1)); await p.waitForSelector('.detail'); await p.waitForTimeout(800);
    const farBelow = await p.$eval('.job-place', (e) => e.getBoundingClientRect().top > innerHeight + 300);
    ok(farBelow === !reqs.some((r) => /\/assets\/map-.*\.js/.test(r.url)), 'job page: map code loaded only when the map is within 300 px of the screen (far below: ' + farBelow + ')');
    await p.setViewportSize({ width: 390, height: 300 }); await p.reload(); await p.waitForSelector('.detail'); await p.waitForTimeout(800);
    const n0 = reqs.filter((r) => /\/assets\/map-.*\.js/.test(r.url)).length;
    const far2 = await p.$eval('.job-place', (e) => e.getBoundingClientRect().top > innerHeight + 300);
    ok(far2, 'short screen: the map is far below');
    await p.waitForTimeout(500);
    ok(reqs.filter((r) => /\/assets\/map-.*\.js/.test(r.url)).length === n0 || !far2, 'short screen: no map code before scrolling');
    await p.setViewportSize({ width: 390, height: 844 });
    ok(!reqs.some((r) => /google\./.test(r.url)), 'nothing sent to Google on load');
    const link = p.locator('.job-place-link a');
    ok((await link.innerText()) === 'Open in Google Maps' && (await link.getAttribute('href')) === 'https://www.google.com/maps/search/?api=1&query=45.47612,9.20734'
       && (await link.getAttribute('target')) === '_blank' && (await link.getAttribute('rel')) === 'noopener noreferrer', 'Google Maps link: plain link, new tab, no referrer');
    await p.locator('.job-place').scrollIntoViewIfNeeded(); await p.waitForSelector('.job-map[data-state=ready]', { timeout: 15000 }); await p.waitForTimeout(800);
    ok(reqs.some((r) => /\/assets\/map-.*\.js/.test(r.url)), 'map code loaded once scrolled near');
    ok(await p.getAttribute('.job-map', 'data-exact') === 'true' && await p.locator('.job-map .job-marker').count() === 1, 'exact location: a pin');
    ok((await p.innerText('.station-marker')) === 'M1 Porta Venezia', 'nearest station shown');
    ok(!reqs.some((r) => /google\./.test(r.url)), 'still nothing sent to Google');
    await p.goto(E + '/jobs/' + ID(6)); await p.locator('.job-place').scrollIntoViewIfNeeded(); await p.waitForSelector('.job-map[data-state=ready]', { timeout: 15000 });
    ok(await p.getAttribute('.job-map', 'data-exact') === 'false' && await p.locator('.job-map .job-marker').count() === 0 && await p.locator('.station-marker').count() === 0, 'area-only: no pin, no station');
    ok((await p.innerText('.job-place-note')).includes('shows only the area') && (await p.innerText('.job-place-link')) === 'Open the area in Google Maps', 'area-only: says so');
    await p.goto(E + '/jobs/' + ID(3)); await p.waitForSelector('.detail'); await p.waitForTimeout(500);
    ok(await p.locator('.job-place').count() === 0, 'no location: no map, no link');
    await ctx.close(); }

  // ---- 7. /jobs list view: no map code at all
  { const { ctx, p, reqs } = await newPage(b, devices['iPhone 13']);
    await p.goto(E + '/jobs'); await p.waitForSelector('.job-list'); await p.waitForTimeout(800);
    ok(!reqs.some((r) => /\/assets\/(map|JobsMap)-.*\.js|milan-metro|openfreemap/.test(r.url)), 'list view loads no map code, tiles or metro file');
    await ctx.close(); }

  // ---- 6. /admin: flags
  { const ctx = await b.newContext(desk);
    const { log } = await amock(ctx, { admin: true, noAreaLive: [{ id: ID(9), title: 'Old cashier job', created_at: new Date(Date.now() - 864e5 * 20).toISOString(), companies: { name: 'Old Shop', status: 'approved' } }],
      extraJobs: [{ id: 'pj9', title: 'On-site, no area', description: 'x', job_type: 'gig', location: 'Navigli', remote: false, hours_per_week: 5, pay: '€10/h', italian_level: 'none', start_date: null, expires_at: new Date(Date.now() + 864e5 * 30).toISOString(), status: 'pending', created_at: new Date().toISOString(), review_note: null, reviewed_at: null, company_id: 'c3', area_id: null, schedule: ['weekends'], pay_unit: 'hour', pay_min: 10 }] });
    const p = await ctx.newPage(); await p.goto(E + '/login'); await login(p); await p.goto(E + '/admin'); await p.waitForSelector('#admin-no-area');
    ok((await p.innerText('#admin-no-area')).includes('Old cashier job') && (await p.innerText('#admin-no-area')).includes('Old Shop'), 'live job without an area listed');
    ok((await p.innerText('.admin-summary')).includes('1 live job is missing an area, a schedule or structured pay'), 'summary mentions it');
    const q = new URLSearchParams(log.noAreaQuery);
    ok(q.get('or') === '(and(remote.eq.false,area_id.is.null),schedule.eq.{},pay_unit.is.null)' && q.get('status') === 'eq.published' && q.get('companies.status') === 'eq.approved' && (q.get('expires_at') || '').startsWith('gt.'), 'asks for live jobs missing an area (on-site) or a schedule: ' + log.noAreaQuery);
    const item = p.locator('.admin-item', { hasText: 'On-site, no area' });
    ok((await item.innerText()).includes('No area.'), 'pending job without an area flagged');
    const ns = p.locator('.admin-item', { hasText: 'Weekend barista' }).first();
    for (const c of await item.locator('.admin-checklist input').all()) await c.check();
    ok(await item.locator('button:has-text("Publish")').isDisabled(), 'its Publish stays off even with the checklist ticked');
    const other = p.locator('.admin-item', { hasText: 'Weekend barista' }).first();
    ok(!(await other.innerText()).includes('No area.'), 'a job with an area is not flagged');
    await ctx.close(); }

  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
