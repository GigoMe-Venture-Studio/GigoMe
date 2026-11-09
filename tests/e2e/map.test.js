const { OUT } = require('./lib/browser.js');
const { chromium, devices } = require('./lib/browser.js');
const { mock } = require('./lib/mock.js');
const { emock, employerLogin } = require('./lib/emock.js');
const { stubMap } = require('./lib/stub.js');
const E = 'http://127.0.0.1:4402';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const desk = { viewport: { width: 1280, height: 900 } };
const txt = (p, s) => p.innerText(s).catch(() => '');
const ready = (p, sel = '.jobs-map') => p.waitForFunction((s) => { const el = document.querySelector(s); return el && el.dataset.state === 'ready'; }, sel, { timeout: 15000 }).then(() => true).catch(() => false);

(async () => {
  const b = await chromium.launch();
  // ---- /jobs: List | Map on desktop
  { const ctx = await b.newContext(desk); const log = await mock(ctx); await stubMap(ctx, log); const p = await ctx.newPage();
    const reqs = []; p.on('request', (r) => reqs.push(r.url()));
    await p.goto(E + '/jobs'); await p.waitForTimeout(700);
    ok(reqs.filter((u) => /JobsMap|maplibre|tiles\.openfreemap/.test(u)).length === 0, 'list view: no map code or tiles downloaded');
    const areaOpts = await p.$$eval('select[name=area] option', (o) => o.map((x) => x.textContent));
    ok(areaOpts[0] === 'All areas' && areaOpts.includes('Porta Venezia') && areaOpts.includes('Elsewhere in Milan'), 'area filter lists the areas');
    await p.click('.view-toggle button:has-text("Map")');
    ok(await ready(p), 'map view: the map loads');
    ok(new URL(p.url()).searchParams.get('view') === 'map', 'view=map in the URL');
    ok(await p.locator('.jobs-list-col').isVisible() && await p.locator('.jobs-map').isVisible(), 'desktop: list and map side by side');
    const lb = await p.locator('.jobs-list-col').boundingBox(), mb = await p.locator('.jobs-map').boundingBox();
    ok(mb.x > lb.x + lb.width - 1, 'desktop: the map is to the right of the list');
    ok(await p.getAttribute('.jobs-map', 'data-points') === '2', 'map shows the 2 on-site jobs with coordinates (remote and unlocated ones left out)');
    ok((await txt(p, '.jobs-map-aside')).includes('4 of these jobs are remote or without a place on the map'), 'says how many jobs are list-only');
    ok((await txt(p, '.maplibregl-ctrl-attrib')).match(/OpenStreetMap/i) || (await p.locator('.maplibregl-ctrl-attrib').count()) > 0, 'attribution control is there');
    // filters apply to both
    await p.selectOption('select[name=area]', '3'); await p.waitForTimeout(900);
    ok(new URL(p.url()).searchParams.get('area') === '3' && new URL(p.url()).searchParams.get('view') === 'map', 'area filter in the URL, view kept');
    ok(await p.locator('.job-list li').count() === 1 && await p.getAttribute('.jobs-map', 'data-points') === '1', 'area filter: list and map both show 1 job');
    // marker -> card -> job page
    await p.waitForTimeout(600);
    await p.waitForSelector('.job-marker'); await p.click('.job-marker'); await p.waitForTimeout(500);
    ok((await txt(p, '.maplibregl-popup')).includes('Weekend barista') && (await txt(p, '.maplibregl-popup')).includes('Nebbia Coffee Bar'), 'tapping the marker shows the job card');
    await p.click('.maplibregl-popup a.map-card-title'); await p.waitForTimeout(700);
    ok(new URL(p.url()).pathname.startsWith('/jobs/0000'), 'the card links to the job page: ' + p.url());
    await p.goBack(); await p.waitForTimeout(800);
    // clustering when zoomed out
    await p.selectOption('select[name=area]', ''); await p.waitForTimeout(900); await ready(p);
    for (let i = 0; i < 4; i++) { await p.click('.maplibregl-ctrl-zoom-out'); await p.waitForTimeout(350); }
    await p.waitForTimeout(800);
    ok(Number(await p.getAttribute('.jobs-map', 'data-clusters')) >= 1, 'zoomed out: markers cluster (' + await p.getAttribute('.jobs-map', 'data-clusters') + ')');
    await p.screenshot({ path: OUT + '/desk-map.png' });
    await p.click('.view-toggle button:has-text("List")'); await p.waitForTimeout(300);
    ok(await p.locator('.jobs-map').count() === 0 && !new URL(p.url()).searchParams.get('view'), 'back to List');
    await ctx.close(); }

  // ---- phone
  { const ctx = await b.newContext(devices['iPhone 13']); const log = await mock(ctx); await stubMap(ctx, log); const p = await ctx.newPage();
    await p.goto(E + '/jobs'); await p.waitForTimeout(600);
    ok(await p.locator('.job-list').isVisible() && await p.locator('.jobs-map').count() === 0, 'phone: list by default');
    await p.click('.view-toggle button:has-text("Map")'); ok(await ready(p), 'phone: map loads');
    ok(!(await p.locator('.jobs-list-col').isVisible()) && await p.locator('.jobs-map').isVisible(), 'phone: map instead of the list');
    ok(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'phone: no sideways scroll');
    await p.screenshot({ path: OUT + '/phone-map.png' });
    await ctx.close(); }

  // ---- home: area dropdown
  { const ctx = await b.newContext(desk); await mock(ctx); const p = await ctx.newPage();
    await p.goto(E + '/'); await p.waitForTimeout(600);
    await p.selectOption('#home-area', '3'); await p.fill('#home-q', 'barista'); await p.click('button:has-text("Search jobs")'); await p.waitForTimeout(600);
    const u = new URL(p.url());
    ok(u.pathname === '/jobs' && u.searchParams.get('area') === '3' && u.searchParams.get('q') === 'barista' && u.searchParams.get('italian') === 'none', 'hero: area dropdown opens /jobs with the filter: ' + u.search);
    ok(await p.inputValue('select[name=area]') === '3', '/jobs shows the chosen area');
    await ctx.close(); }

  // ---- job form: area, pin, Find address, area only
  { const ctx = await b.newContext(desk); const { log, db } = await emock(ctx, { company: { name: 'Nebbia', status: 'approved' } }); await stubMap(ctx, log);
    const p = await ctx.newPage(); const reqs = []; p.on('request', (r) => reqs.push(r.url()));
    await employerLogin(p, E); await p.goto(E + '/dashboard/jobs/new'); await p.waitForTimeout(600);
    ok(reqs.filter((u) => /LocationPicker|tiles\.openfreemap/.test(u)).length === 0, 'form: no map until an area is chosen');
    await p.fill('input[name=title]', 'Barista'); await p.selectOption('select[name=job_type]', 'part_time'); await p.fill('input[name=hours_per_week]', '10');
    await p.fill('input[name=apply_url]', 'nebbia.it/jobs');
    await p.selectOption('select[name=category]', 'hospitality');
    await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(300);
    ok((await txt(p, 'main')).includes('Choose the area'), 'submit needs an area for on-site jobs');
    await p.selectOption('select[name=area_id]', '3'); ok(await ready(p, '.picker-map'), 'choosing an area shows the pin map'); await p.waitForTimeout(1200);
    await p.locator('.picker-map').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); const pb = await p.locator('.picker-map canvas').boundingBox();
    await p.mouse.click(pb.x + pb.width / 2 + 30, pb.y + pb.height / 2 - 20); await p.waitForTimeout(400);
    const pin1 = await p.getAttribute('.picker-map', 'data-pin');
    ok(/^45\.4\d+,9\.2\d+$/.test(pin1), 'tapping the map places the pin: ' + pin1);
    await p.fill('input[name=location]', 'Via Lazzaretto 10');
    ok(log.nominatim.length === 0, 'typing an address sends nothing (no autocomplete)');
    await p.click('button:has-text("Find address")'); await p.waitForTimeout(600);
    ok(log.nominatim.length === 1 && log.nominatim[0].q === 'Via Lazzaretto 10, Milano' && log.nominatim[0].bounded === '1' && log.nominatim[0].limit === '1' && log.nominatim[0].countrycodes === 'it', 'Find address: one Nominatim request, bounded to Milan: ' + JSON.stringify(log.nominatim[0]));
    ok(await p.getAttribute('.picker-map', 'data-pin') === '45.47801,9.20555', 'Find address moves the pin');
    ok((await txt(p, 'main')).includes('Nominatim, © OpenStreetMap contributors'), 'Nominatim attribution on the form');
    await p.check('input[name=schedule][value=weekends]');
    await p.selectOption('select[name=pay_unit]', 'hour'); await p.fill('input[name=pay_min]', '11');
    await p.click('button:has-text("Submit for review")'); await p.waitForTimeout(900);
    const post = log.req.find((x) => x.method === 'POST' && x.path === '/rest/v1/jobs');
    ok(post && post.body.area_id === 3 && post.body.show_exact_location === true && post.body.latitude === 45.47801 && post.body.longitude === 9.20555, 'exact spot saved: ' + JSON.stringify(post && { a: post.body.area_id, e: post.body.show_exact_location, lat: post.body.latitude }));
    // area only
    await p.goto(E + '/dashboard/jobs/new'); await p.waitForTimeout(600);
    await p.fill('input[name=title]', 'Babysitter'); await p.selectOption('select[name=job_type]', 'other'); await p.fill('input[name=hours_per_week]', '6');
    await p.selectOption('select[name=area_id]', '2'); await ready(p, '.picker-map');
    await p.locator('.picker-map').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); const pb2 = await p.locator('.picker-map canvas').boundingBox(); await p.mouse.click(pb2.x + 50, pb2.y + 50); await p.waitForTimeout(300);
    await p.check('input[name=only_area]'); await p.waitForTimeout(200);
    ok(await p.locator('.picker-map').count() === 0 && (await txt(p, 'main')).includes('We store its centre, never the address.'), 'area only: no pin map, explained');
    await p.click('button:has-text("Save as draft")'); await p.waitForTimeout(800);
    const post2 = log.req.filter((x) => x.method === 'POST' && x.path === '/rest/v1/jobs').pop();
    ok(post2 && post2.body.show_exact_location === false && post2.body.latitude === null && post2.body.longitude === null && post2.body.area_id === 2, 'area only: no point is sent at all');
    await p.goto(E + '/dashboard/jobs/new'); await p.waitForTimeout(500); await p.selectOption('select[name=area_id]', '3'); await ready(p, '.picker-map');
    await p.fill('input[name=location]', 'nowhere at all'); await p.click('button:has-text("Find address")'); await p.waitForTimeout(1500);
    ok((await txt(p, 'main')).includes("We couldn't find that address in Milan"), 'address not found: explained');
    await p.screenshot({ path: OUT + '/form.png', fullPage: true });
    await ctx.close(); }
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`);
})();
