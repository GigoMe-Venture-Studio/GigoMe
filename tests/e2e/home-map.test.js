// The home page's map ("Jobs on the map", under "Newest jobs"):
//   * lazy: nothing for it (its jobs, map code, tiles, metro file) is
//     downloaded until the visitor scrolls near it, or it is on the screen;
//     the first screen on phones is unchanged and the Feedback button shows;
//   * phones: one-finger swipes over it scroll the page (cooperative
//     gestures), unlike the full map on /jobs;
//   * pins: live on-site jobs with an exact location only (no pin for an
//     area-only job), a tap shows title, company and pay with a link to the
//     job; example listings are marked and never cover real jobs;
//   * failures (tiles, the map's jobs, its code) leave the rest of the page working.
const { chromium, devices } = require('./lib/browser.js');
const { mock, JOBS, EXAMPLE_JOBS, ID, login } = require('./lib/mock.js');
const { stubMap } = require('./lib/stub.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const phone = { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true };
// Anything only the map needs: its chunk, MapLibre, tiles, the metro file, its jobs query.
const MAP_REQ = /\/assets\/(JobsMap|map)-.*\.(js|css)|openfreemap|milan-metro|show_exact_location=/;
const ready = (p) => p.waitForSelector('.home-map .jobs-map[data-state=ready]', { timeout: 15000 }).then(() => true, () => false);
const ds = (p, k) => p.$eval('.home-map .jobs-map', (e, k) => e.dataset[k], k);

// An on-site job that shows only its area: the database stores the area's
// centre as its point. It must not get a pin.
const AREA_ONLY = { ...JOBS.find((j) => j.id === ID(1)), id: ID(40), title: 'Area-only shop helper', remote: false, show_exact_location: false,
  latitude: 45.4885, longitude: 9.1895, area_id: 6, areas: { name: 'Isola' }, nearest_station_m: null, metro_stations: null, published_at: new Date().toISOString() };
const WITH_AREA_ONLY = [...JOBS, AREA_ONLY];
const EXACT_REAL = WITH_AREA_ONLY.filter((j) => !j.remote && j.show_exact_location && j.latitude != null);

async function newPage(b, dev, mockOpts = {}, { stub = true } = {}) {
  const ctx = await b.newContext(dev); const log = await mock(ctx, mockOpts); if (stub) await stubMap(ctx, log);
  const reqs = []; ctx.on('request', (r) => reqs.push(r.url()));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  return { ctx, p, reqs, errs, log };
}
const mapReqs = (reqs) => reqs.filter((u) => MAP_REQ.test(u));
// Scrolls so the top of the map box sits `below` px under the bottom of the screen.
const scrollMapTo = (p, below) => p.evaluate((d) => { const t = document.querySelector('.home-map-box').getBoundingClientRect().top + scrollY; window.scrollTo(0, t - innerHeight - d); }, below);

(async () => {
  const b = await chromium.launch();

  // ---- 1. Lazy loading: nothing until the visitor scrolls near the map
  for (const [name, dev] of [['375x667', phone], ['320x568', { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true }], ['iPhone 13', devices['iPhone 13']], ['desktop', desk], ['1920x1080', { viewport: { width: 1920, height: 1080 } }]]) {
    const { ctx, p, reqs, errs } = await newPage(b, dev, { examples: true });
    await p.goto(E + '/'); await p.waitForSelector('.home-newest .job-list'); await p.waitForTimeout(1500);
    ok(mapReqs(reqs).length === 0, `${name}: first load, no scrolling: nothing for the map downloaded: ${mapReqs(reqs).join(' ')}`);
    ok(await p.locator('.home-map').count() === 1 && await p.locator('.home-map .jobs-map[data-state]').count() === 0, `${name}: the map's place is there, the map isn't`);
    const below = await p.$eval('.home-map', (e) => e.getBoundingClientRect().top >= innerHeight);
    if (dev.isMobile || name === 'iPhone 13') ok(below, `${name}: the map section starts below the first screen`);
    ok(await p.locator('.feedback-fab').isVisible() && !(await p.locator('.feedback-fab').getAttribute('data-away')), `${name}: Feedback button fully shown at first load`);
    // Order: hero, Newest jobs, the map, How it works.
    ok(await p.evaluate(() => { const y = (s) => document.querySelector(s).getBoundingClientRect().top; return y('.hero') < y('.home-newest') && y('.home-newest') < y('.home-map') && y('.home-map') < y('.how'); }), `${name}: the map comes after "Newest jobs", before "How it works"`);
    // A small scroll that keeps the map far away loads nothing.
    if (await p.evaluate(() => document.querySelector('.home-map-box').getBoundingClientRect().top > innerHeight + 700)) {
      await scrollMapTo(p, 700); await p.waitForTimeout(800);
      ok(mapReqs(reqs).length === 0, `${name}: scrolled, map still 700px away: nothing downloaded`);
    }
    // Within 300px: the jobs, the code and the map load. (Where the map is
    // already that close, the smallest scroll is enough.)
    await scrollMapTo(p, 200); if (await p.evaluate(() => scrollY) === 0) await p.evaluate(() => window.scrollTo(0, 10));
    ok(await ready(p), `${name}: within 300px of the screen: the map loads`);
    ok(reqs.some((u) => /\/assets\/JobsMap-.*\.js/.test(u)) && reqs.some((u) => /show_exact_location=eq\.true/.test(u)), `${name}: map code and its jobs fetched once near`);
    ok(errs.length === 0, `${name}: no page errors: ${errs.join(' | ')}`);
    await ctx.close();
  }
  // A screen tall enough to show the map at once loads it without a scroll.
  { const { ctx, p, reqs } = await newPage(b, { viewport: { width: 1280, height: 1700 } });
    await p.goto(E + '/');
    ok(await ready(p), 'tall screen: the map is on the first screen, so it loads');
    ok(mapReqs(reqs).length > 0, 'tall screen: map requests made');
    await ctx.close(); }
  // No jobs: no map section, nothing fetched for it.
  { const { ctx, p, reqs } = await newPage(b, phone, { noJobs: true });
    await p.goto(E + '/'); await p.waitForSelector('.home-newest .empty-state'); await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(1000);
    ok(await p.locator('.home-map').count() === 0 && mapReqs(reqs).length === 0, 'no jobs: no map section, nothing downloaded for it');
    await ctx.close(); }

  // ---- 2. Phones: one finger scrolls the page over the map; on /jobs it moves the map
  { const { ctx, p } = await newPage(b, devices['iPhone 13']);
    const cdp = await ctx.newCDPSession(p);
    // One finger, a real touch drag upwards from 70% down the element (raw touch events, as a phone sends them).
    const swipe = async (sel) => { const r = await p.locator(sel).boundingBox(); const x = Math.round(r.x + r.width / 2), y = Math.round(Math.min(r.y + r.height * 0.7, 600));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 22 }] }); await p.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(900); };
    await p.goto(E + '/'); await p.waitForSelector('.home-newest .job-list'); await scrollMapTo(p, 100); ok(await ready(p), 'phone: map ready'); await p.waitForTimeout(600);
    // Put the map in the middle of the screen, with room to scroll on.
    await p.evaluate(() => { const r = document.querySelector('.home-map .jobs-map').getBoundingClientRect(); window.scrollTo(0, r.top + scrollY - 120); }); await p.waitForTimeout(400);
    ok(await p.$eval('.home-map .maplibregl-canvas-container', (e) => e.classList.contains('maplibregl-cooperative-gestures') && getComputedStyle(e).touchAction === 'pan-x pan-y'), 'phone: cooperative gestures on (one finger pans the page)');
    ok(await p.locator('.home-map .maplibregl-cooperative-gesture-screen').count() === 1 && (await p.innerText('.home-map .maplibregl-cooperative-gesture-screen')).includes('two fingers'), 'phone: says to use two fingers to move the map');
    const y0 = await p.evaluate(() => scrollY), v0 = await ds(p, 'view');
    await swipe('.home-map .jobs-map canvas');
    const y1 = await p.evaluate(() => scrollY), v1 = await ds(p, 'view');
    ok(y1 > y0 + 100, `phone: a one-finger swipe on the map scrolls the page (${y0} -> ${y1})`);
    ok(v1 === v0, `phone: ...and doesn't move the map (${v0} -> ${v1})`);
    // The same swipe on /jobs's full map moves the map (so the check above can fail).
    await p.goto(E + '/jobs?view=map'); await p.waitForSelector('.jobs-map[data-state=ready]', { timeout: 15000 }); await p.waitForTimeout(800);
    const v2 = await p.$eval('.jobs-map', (e) => e.dataset.view);
    await swipe('.jobs-map canvas');
    ok(await p.$eval('.jobs-map', (e) => e.dataset.view) !== v2, '/jobs map (control): the same swipe moves that map');
    await ctx.close(); }

  // ---- 3. Pins, on a phone and on a desktop
  for (const [name, dev] of [['phone', devices['iPhone 13']], ['desktop', desk]]) {
    const { ctx, p, log } = await newPage(b, dev, { jobs: WITH_AREA_ONLY, examples: true });
    await p.goto(E + '/'); await p.waitForSelector('.home-newest .job-list'); await scrollMapTo(p, 100); ok(await ready(p), name + ': map ready'); await p.waitForTimeout(1200);
    const q = new URLSearchParams(log.jobs.find((s) => s.includes('show_exact_location=eq')) || '');
    ok(q.get('status') === 'eq.published' && q.get('companies.status') === 'eq.approved' && (q.get('expires_at') || '').startsWith('gt.') && q.get('remote') === 'eq.false'
       && q.get('show_exact_location') === 'eq.true' && q.get('latitude') === 'not.is.null' && q.get('order') === 'is_example.asc,published_at.desc.nullslast,created_at.desc', name + ': asks for live on-site jobs with an exact location, real first: ' + q.toString());
    ok(Number(await ds(p, 'points')) === EXACT_REAL.length + 1, `${name}: ${EXACT_REAL.length} real jobs with an exact location and 1 example on the map: ${await ds(p, 'points')}`);
    const ids = await p.$$eval('.home-map .job-marker', (e) => e.map((x) => x.dataset.id));
    ok(!ids.includes(AREA_ONLY.id) && !ids.includes(ID(6)) && !ids.includes(ID(2)), name + ': no pin for an area-only or remote job');
    ok(ids.length === EXACT_REAL.length + 1, `${name}: a marker per job (${ids.length})`);
    // The example: marked, and drawn under the real markers.
    const ex = p.locator(`.home-map .job-marker[data-id="${EXAMPLE_JOBS[0].id}"]`);
    ok(await ex.getAttribute('class') === 'job-marker job-marker-example maplibregl-marker' || (await ex.getAttribute('class')).includes('job-marker-example'), name + ': example marker styled as an example');
    ok((await ex.innerText()).includes('Example') && (await ex.getAttribute('aria-label')).startsWith('Example listing, not a real job: '), name + ': example marker says "Example"');
    ok(await p.$$eval('.home-map .job-marker', (e) => e.findIndex((x) => x.classList.contains('job-marker-example')) === 0), name + ': example markers come first, so real ones are drawn over them');
    ok(await p.$eval('.home-map .job-marker-example', (e) => { const s = getComputedStyle(e); return s.backgroundColor === 'rgb(29, 27, 46)'; }), name + ': example marker is graphite');
    // Tap a real job: title, company, pay and a link to the job.
    await p.locator(`.home-map .job-marker[data-id="${ID(1)}"]`).click(); await p.waitForTimeout(500);
    const card = name === 'phone' ? '.home-map .map-sheet' : '.home-map .maplibregl-popup';
    const t = await p.innerText(card + ' .map-card-title >> xpath=..');
    ok(t.includes('Weekend barista') && t.includes('Nebbia Coffee Bar') && t.includes('€11/h') && !t.includes('Example'), `${name}: tapping a pin shows title, company and pay: ${t.replace(/\n/g, ' / ')}`);
    ok(await p.getAttribute(card + ' a.map-card-title', 'href') === '/jobs/' + ID(1), name + ': with a link to the job');
    // Tap the example: the card says so first.
    if (name === 'phone') await p.click('.map-sheet-close'); else await p.click('.maplibregl-popup-close-button');
    await ex.click(); await p.waitForTimeout(500);
    const te = await p.innerText(card + ' .map-card-title >> xpath=..');
    ok(te.startsWith('Example listing, not a real job') && te.includes(EXAMPLE_JOBS[0].title), name + ': the example\'s card starts with the badge');
    if (name === 'phone') await p.click('.map-sheet-close'); else await p.click('.maplibregl-popup-close-button');
    await p.locator(`.home-map .job-marker[data-id="${ID(1)}"]`).click(); await p.waitForTimeout(400);
    await p.click(card + ' a.map-card-title'); await p.waitForSelector('.detail', { timeout: 10000 });
    ok(new URL(p.url()).pathname === '/jobs/' + ID(1), name + ': the link opens the job');
    await ctx.close();
  }
  // An example at the very same spot as a real job: one circle; zoomed in,
  // the real job's marker is drawn over the example's.
  { const exSame = { ...EXAMPLE_JOBS[0], latitude: JOBS[0].latitude, longitude: JOBS[0].longitude };
    const { ctx, p } = await newPage(b, devices['iPhone 13'], { jobs: [JOBS[0], exSame] });
    await p.goto(E + '/'); await p.waitForSelector('.home-newest .job-list'); await scrollMapTo(p, 100); ok(await ready(p), 'same spot: map ready'); await p.waitForTimeout(1200);
    ok(await p.locator('.home-map .job-marker').count() === 0 && Number(await ds(p, 'clusters')) === 1, 'same spot: one circle with both');
    // The fitted spot: the middle of the map inside the home map's padding (40 96 72 40).
    await p.evaluate(() => document.querySelector('.home-map .jobs-map').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
    const box = await p.locator('.home-map .jobs-map canvas').boundingBox();
    await p.mouse.click(box.x + 40 + (box.width - 136) / 2, box.y + 40 + (box.height - 112) / 2); await p.waitForTimeout(1500);
    ok(await p.locator('.home-map .job-marker').count() === 2, 'same spot: tapping the circle zooms in to both markers');
    const top = await p.evaluate((id) => { const r = document.querySelector(`.home-map .job-marker[data-id="${id}"] .job-marker-dot`).getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return el && el.closest('.job-marker') && el.closest('.job-marker').dataset.id; }, ID(1));
    ok(top === ID(1), 'same spot: the real job\'s marker is on top of the example\'s: ' + top);
    await ctx.close(); }

  // ---- 4. Failures leave the rest of the page working
  // Tiles (the map style) don't load.
  { const { ctx, p, errs } = await newPage(b, phone, {}, { stub: false });
    await ctx.route('https://tiles.openfreemap.org/**', (r) => r.abort());
    await p.goto(E + '/'); await p.waitForSelector('.home-newest .job-list'); await scrollMapTo(p, 100);
    await p.waitForSelector('.home-map .jobs-map[data-state=error]', { timeout: 15000 }).catch(() => {});
    ok(await p.locator('.home-map .jobs-map[data-state=error]').count() === 1 && (await p.innerText('.home-map .jobs-map-note')).includes('Every job is in the job list'), 'tiles fail: the map says it can\'t be shown');
    ok(await p.locator('.home-newest .job-list .role-title').count() === 5 && await p.locator('.how').isVisible() && await p.locator('.site-footer').isVisible(), 'tiles fail: newest jobs, "How it works" and the footer still there');
    await p.evaluate(() => window.scrollTo(0, 0)); await p.fill('#home-q', 'barista'); await p.click('button:has-text("Search jobs")'); await p.waitForURL(/\/jobs\?/);
    ok(new URL(p.url()).searchParams.get('q') === 'barista', 'tiles fail: the search still works');
    ok(errs.length === 0, 'tiles fail: no page errors: ' + errs.join(' | '));
    await ctx.close(); }
  // The map's jobs can't be loaded.
  { const { ctx, p } = await newPage(b, phone);
    await ctx.route((u) => u.pathname === '/rest/v1/jobs' && u.searchParams.has('show_exact_location'), (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
    await p.goto(E + '/'); await p.waitForSelector('.home-newest .job-list'); await scrollMapTo(p, 100); await p.waitForSelector('.home-map-note', { timeout: 10000 }).catch(() => {});
    ok((await p.innerText('.home-map')).includes("The map can't be shown right now.") && await p.locator('.home-newest .job-list .role-title').count() === 5, 'map jobs fail: a note, newest jobs unaffected');
    ok(!reqs_has(await p.evaluate(() => performance.getEntriesByType('resource').map((e) => e.name)), /JobsMap-/), 'map jobs fail: no map code downloaded');
    await ctx.close(); }
  // The map's code can't be downloaded.
  { const { ctx, p } = await newPage(b, phone);
    await ctx.route('**/assets/JobsMap-*.js', (r) => r.abort());
    await p.goto(E + '/'); await p.waitForSelector('.home-newest .job-list'); await scrollMapTo(p, 100); await p.waitForSelector('.home-map-note', { timeout: 10000 }).catch(() => {});
    ok((await p.innerText('.home-map')).includes("The map can't be shown right now.") && await p.locator('.how').isVisible() && await p.locator('.page-error, .error-page').count() === 0, 'map code fails: only the map shows a note, the page stays');
    await ctx.close(); }
  // Logged in as a student: same map, nothing else changes.
  { const { ctx, p } = await newPage(b, phone);
    await p.goto(E + '/login'); await login(p); await p.goto(E + '/'); await p.waitForSelector('.home-newest .job-list'); await p.waitForTimeout(700);
    ok(await p.locator('.feedback-fab').isVisible() && await p.locator('.home-map .jobs-map[data-state]').count() === 0, 'student: Feedback shown, map not loaded at first load');
    await scrollMapTo(p, 100); ok(await ready(p), 'student: map loads on scroll');
    ok(await p.locator('.home-map .save-btn').count() === 0, 'student: no Save buttons in the map');
    await ctx.close(); }

  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();

function reqs_has(list, re) { return list.some((u) => re.test(u)); }
