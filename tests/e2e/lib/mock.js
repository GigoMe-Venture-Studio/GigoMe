// Mock Supabase for the new React site (same answers as the real API).
const SB = 'https://testproj.supabase.co';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();
const ID = (n) => '00000000-0000-4000-8000-0000000000' + String(n).padStart(2, '0');
const NEBBIA = { id: 'c0000000-0000-4000-8000-000000000001', name: 'Nebbia Coffee Bar', status: 'approved', website: 'nebbia-example.it', description: 'Specialty coffee bar.' };
const FINTRA = { id: 'c0000000-0000-4000-8000-000000000002', name: 'Fintra', status: 'approved', website: 'https://fintra.example/', description: null };
const JOBS = [
  { id: ID(1), title: 'Weekend barista', job_type: 'part_time', location: 'Porta Venezia', remote: false, hours_per_week: 12, pay: '€11/h', italian_level: 'none', start_date: '2026-12-01', created_at: ago(3), description: 'Serve coffee and learn latte art.', companies: NEBBIA, area_id: 3, latitude: 45.47612, longitude: 9.20734, show_exact_location: true },
  { id: ID(2), title: 'Finance intern', job_type: 'internship', location: 'Porta Romana', remote: true, hours_per_week: 20, pay: null, italian_level: 'basic', start_date: null, created_at: ago(6), description: 'Spreadsheets and reporting.', companies: FINTRA, area_id: 11, latitude: 45.4505, longitude: 9.196, show_exact_location: true },
  { id: ID(3), title: 'Event host', job_type: 'gig', location: null, remote: false, hours_per_week: 8, pay: '€90/day', italian_level: 'fluent', start_date: null, created_at: ago(2.5), description: 'Welcome guests at a gallery opening.', companies: NEBBIA },
  { id: ID(4), title: 'Remote researcher', job_type: 'other', location: null, remote: true, hours_per_week: 40, pay: '€500', italian_level: 'none', start_date: null, created_at: ago(12), description: 'Desk research on cafés.', companies: FINTRA },
  { id: ID(5), title: 'English tutor', job_type: 'part_time', location: 'Brera', remote: false, hours_per_week: 6, pay: '€15/h', italian_level: 'none', start_date: null, created_at: ago(4.5), description: 'Conversation classes.', companies: NEBBIA, area_id: 2, latitude: 45.4721, longitude: 9.1871, show_exact_location: true },
  { id: ID(6), title: 'Social media helper', job_type: 'gig', location: 'Isola', remote: true, hours_per_week: 10, pay: '€300', italian_level: 'none', start_date: null, created_at: ago(7), description: 'One week of posts for a BARISTA training brand.', companies: FINTRA, area_id: 6, latitude: 45.4885, longitude: 9.1895, show_exact_location: false }
];
const AREAS = [
  { id: 1, name: 'Duomo / Centro', latitude: 45.4642, longitude: 9.19, sort_order: 10 },
  { id: 2, name: 'Brera', latitude: 45.472, longitude: 9.1868, sort_order: 20 },
  { id: 3, name: 'Porta Venezia', latitude: 45.4745, longitude: 9.205, sort_order: 30 },
  { id: 6, name: 'Isola', latitude: 45.4885, longitude: 9.1895, sort_order: 60 },
  { id: 11, name: 'Porta Romana / Bocconi', latitude: 45.4505, longitude: 9.196, sort_order: 110 },
  { id: 16, name: 'Elsewhere in Milan', latitude: null, longitude: null, sort_order: 900 }
];
const EXTRA = {
  'Weekend barista': { category: 'hospitality', published_at: ago(0.5), nearest_station_m: 201, metro_stations: { name: 'Porta Venezia', lines: ['M1'], latitude: 45.474419, longitude: 9.205046 } },
  'Finance intern': { category: 'office_admin', published_at: ago(5), nearest_station_m: 1400, metro_stations: { name: 'Lodi T.I.B.B.', lines: ['M3'], latitude: 45.446763, longitude: 9.210816 } },
  'Event host': { category: 'events', published_at: ago(2) },
  'Remote researcher': { category: 'other', published_at: ago(10) },
  'English tutor': { category: 'tutoring_education', published_at: ago(4), nearest_station_m: 350, metro_stations: { name: 'Lanza', lines: ['M2'], latitude: 45.472229, longitude: 9.182548 } },
  'Social media helper': { category: 'marketing_social', published_at: ago(6), nearest_station_m: 500, metro_stations: { name: 'Isola', lines: ['M5'], latitude: 45.487608, longitude: 9.191263 } }
};
const WHEN = {
  'Weekend barista': [['weekends'], ['en', 'it']],
  'Finance intern': [['weekday_afternoons', 'weekday_mornings'], ['en']],
  'Event host': [['weekday_evenings'], []],
  'Remote researcher': [['flexible'], ['en', 'es']],
  'English tutor': [['weekday_evenings', 'weekends'], ['en']]
  // 'Social media helper': published before schedules existed (none)
};
const PAY = {
  'Weekend barista': ['hour', 11, null, '+ tips'],
  'Event host': ['project', 90, null, null],
  'Remote researcher': ['month', 500, null, null],
  'English tutor': ['hour', 15, 18, null],
  'Social media helper': ['project', 300, null, null]
  // 'Finance intern': from before structured pay (none)
};
const hourly = (j) => (j.pay_unit === 'hour' ? j.pay_min : j.pay_unit === 'month' ? Math.round((j.pay_min / (j.hours_per_week * 52 / 12)) * 100) / 100 : null);
for (const j of JOBS) { const pp = PAY[j.title]; if (pp) Object.assign(j, { pay_unit: pp[0], pay_min: pp[1], pay_max: pp[2], pay: pp[3] }); else Object.assign(j, { pay_unit: null, pay_min: null, pay_max: null }); j.pay_hourly = hourly(j); }
for (const j of JOBS) { Object.assign(j, { category: 'other', published_at: null, nearest_station_m: null, metro_stations: null }, EXTRA[j.title] || {}); j.company_id = j.companies.id; j.schedule = (WHEN[j.title] || [[]])[0]; j.languages = (WHEN[j.title] || [[], ['en', 'it']])[1]; }
for (const j of JOBS) { j.area_id = j.area_id || null; j.latitude = j.latitude ?? null; j.longitude = j.longitude ?? null; if (j.show_exact_location === undefined) j.show_exact_location = true; const a = AREAS.find((x) => x.id === j.area_id); j.areas = a ? { name: a.name } : null; }
const CONTACT = { [ID(1)]: { apply_url: 'https://nebbia-example.it/jobs', apply_email: 'jobs@nebbia-example.it' } };

// Sorts rows the way PostgREST does for ?order=col.desc.nullslast,col2.desc
// (desc puts nulls first unless nullslast; asc puts them last).
function sortByOrder(rows, order) {
  const keys = String(order || '').split(',').filter(Boolean).map((k) => {
    const [col, dir, nulls] = k.split('.');
    const desc = dir === 'desc';
    return { col, desc, nullsLast: nulls ? nulls === 'nullslast' : !desc };
  });
  if (!keys.length) return rows;
  return rows.slice().sort((a, b) => {
    for (const { col, desc, nullsLast } of keys) {
      const x = a[col], y = b[col];
      if (x == null && y == null) continue;
      if (x == null) return nullsLast ? 1 : -1;
      if (y == null) return nullsLast ? -1 : 1;
      const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y));
      if (c) return desc ? -c : c;
    }
    return 0;
  });
}

function apply(url, rows) {
  const p = url.searchParams; let out = rows.slice();
  const f = (k, fn) => { for (const v of p.getAll(k)) out = out.filter((r) => fn(v, r)); };
  f('status', (v) => v === 'eq.published'); f('companies.status', (v, r) => v === 'eq.approved' && r.companies.status === 'approved');
  f('expires_at', (v) => v.startsWith('gt.'));
  f('id', (v, r) => (v.startsWith('in.') ? v.slice(4, -1).split(',').includes(r.id) : r.id === v.slice(3))); f('job_type', (v, r) => r.job_type === v.slice(3)); f('remote', (v, r) => String(r.remote) === v.slice(3));
  f('italian_level', (v, r) => (v.startsWith('in.') ? v.slice(4, -1).split(',').includes(r.italian_level) : r.italian_level === v.slice(3)));
  f('hours_per_week', (v, r) => r.hours_per_week <= Number(v.slice(4)));
  f('area_id', (v, r) => String(r.area_id) === v.slice(3));
  f('category', (v, r) => r.category === v.slice(3));
  f('company_id', (v, r) => (v.startsWith('in.') ? v.slice(4, -1).split(',').includes(r.company_id) : r.company_id === v.slice(3)));
  const ov = (v, list) => { if (!v.startsWith('ov.{')) throw new Error('unexpected array filter: ' + v); const want = v.slice(4, -1).split(','); return list.some((x) => want.includes(x)); };
  f('schedule', (v, r) => ov(v, r.schedule)); f('languages', (v, r) => ov(v, r.languages));
  f('pay_hourly', (v, r) => { if (v === 'is.null') return r.pay_hourly == null; if (!v.startsWith('gte.')) throw new Error('unexpected pay filter: ' + v); return r.pay_hourly != null && r.pay_hourly >= Number(v.slice(4)); });
  f('pay_unit', (v, r) => r.pay_unit === v.slice(3));
  for (const v of p.getAll('or')) {
    const pm = v.match(/^\(pay_hourly\.gte\.(\d+),pay_hourly\.is\.null\)$/);
    if (pm) { out = out.filter((r) => r.pay_hourly == null || r.pay_hourly >= Number(pm[1])); continue; }
    // or=(title.ilike."*kw*",description.ilike."*kw*")
    const m = v.match(/^\(title\.ilike\."\*(.*)\*",description\.ilike\."\*(.*)\*"\)$/);
    if (!m) throw new Error('unexpected or filter: ' + v);
    const kw = m[1].toLowerCase();
    out = out.filter((r) => r.title.toLowerCase().includes(kw) || (r.description || '').toLowerCase().includes(kw));
  }
  out = sortByOrder(out, p.get('order'));
  if (p.get('limit')) out = out.slice(0, Number(p.get('limit')));
  return out;
}

async function mock(ctx, opts = {}) {
  const log = { rpc: [], jobs: [], otp: [] };
  const profile = { full_name: opts.fullName === undefined ? 'Ana Rossi' : opts.fullName, degree_level: 'master', graduation_year: 2028, account_type: opts.accountType || 'student' };
  await ctx.route(SB + '/**', async (r) => {
    const req = r.request(), url = new URL(req.url()), path = url.pathname, method = req.method();
    const j = (s, b) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    if (path === '/rest/v1/jobs') {
      log.jobs.push(url.search);
      if (opts.jobsFail) return j(500, { message: 'boom' });
      let rows; try { rows = apply(url, opts.noJobs ? [] : JOBS); } catch (e) { log.badQuery = e.message; return j(400, { message: e.message }); }
      if (method === 'HEAD') { log.counts = (log.counts || []).concat(url.search); return r.fulfill({ status: 200, headers: { 'content-range': `*/${rows.length}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: '' }); }
      const single = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
      return j(200, single ? rows[0] || null : rows);
    }
    if (path === '/rest/v1/rpc/reveal_job_contact') { log.rpc.push(req.postDataJSON()); if (profile.account_type !== 'student') return j(403, { code: '42501', message: 'x' }); return j(200, CONTACT[req.postDataJSON().p_job_id] ? [CONTACT[req.postDataJSON().p_job_id]] : []); }
    if (path === '/rest/v1/companies' && method === 'GET' && url.searchParams.get('status') === 'eq.approved' && url.searchParams.get('id')) {
      const id = url.searchParams.get('id').slice(3); const c = [NEBBIA, FINTRA].find((x) => x.id === id && x.status === 'approved');
      const row = c ? { id: c.id, name: c.name, website: c.website, description: c.description, status: c.status } : null;
      const single = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
      log.companyReads = (log.companyReads || []).concat(url.searchParams.get('select'));
      return single ? (row ? j(200, row) : j(406, { code: 'PGRST116' })) : j(200, row ? [row] : []);
    }
    if (path === '/rest/v1/saved_jobs') {
      log.saved = log.saved || new Set(opts.saved || []); log.savedReq = log.savedReq || [];
      log.savedReq.push({ method, search: url.search, body: method === 'POST' ? req.postDataJSON() : null });
      if (profile.account_type !== 'student' && method === 'POST') return j(403, { code: '42501', message: 'new row violates row-level security policy for table "saved_jobs"' });
      if (opts.saveFail && method !== 'GET') return j(500, { message: 'boom' });
      if (opts.saveLimit && method === 'POST') return j(400, { code: '54000', message: 'Daily limit reached: you can save jobs or searches and follow companies up to 50 times a day. Try again tomorrow.' });
      if (method === 'GET') return j(200, [...log.saved].map((id) => ({ job_id: id })));
      if (method === 'POST') { const id = req.postDataJSON().job_id; if (log.saved.has(id)) return j(409, { code: '23505', message: 'duplicate' }); log.saved.add(id); return r.fulfill({ status: 201, body: '' }); }
      if (method === 'DELETE') { log.saved.delete(url.searchParams.get('job_id').slice(3)); return r.fulfill({ status: 204, body: '' }); }
    }
    if (path === '/rest/v1/rpc/my_saved_jobs') {
      log.saved = log.saved || new Set(opts.saved || []);
      return j(200, [...log.saved].map((id) => { const jb = JOBS.find((x) => x.id === id); return jb ? { job_id: id, saved_at: ago(1), title: jb.title, company_name: jb.companies.name, live: true } : { job_id: id, saved_at: ago(2), title: 'Closed cafe job', company_name: 'Old Cafe', live: false }; }));
    }
    // ---- saved searches, follows, opened jobs (students)
    if (path === '/rest/v1/saved_searches') {
      log.searches = log.searches || (opts.searches || []).map((x) => ({ ...x })); log.searchReq = log.searchReq || [];
      const body = method === 'POST' || method === 'PATCH' ? req.postDataJSON() : null;
      log.searchReq.push({ method, search: url.search, body });
      if (method === 'GET') return j(200, log.searches);
      if (method === 'POST') { if (opts.searchFail) return j(400, { code: 'P0001', message: opts.searchFail }); log.searches.unshift({ id: 'ss' + (log.searches.length + 1), created_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), ...body }); return r.fulfill({ status: 201, body: '' }); }
      if (method === 'PATCH') { const id = url.searchParams.get('id').slice(3); const row = log.searches.find((x) => x.id === id); if (row) row.last_seen_at = new Date().toISOString(); return r.fulfill({ status: 204, body: '' }); }
      if (method === 'DELETE') { const id = url.searchParams.get('id').slice(3); log.searches = log.searches.filter((x) => x.id !== id); return r.fulfill({ status: 204, body: '' }); }
    }
    if (path === '/rest/v1/company_follows') {
      log.follows = log.follows || (opts.follows || []).map((x) => ({ ...x })); log.followReq = log.followReq || [];
      const body = method === 'POST' ? req.postDataJSON() : null;
      log.followReq.push({ method, search: url.search, body });
      const co = (id) => [NEBBIA, FINTRA].find((c) => c.id === id);
      if (method === 'GET') {
        let rows = log.follows; const eq = url.searchParams.get('company_id'); if (eq) rows = rows.filter((x) => x.company_id === eq.slice(3));
        rows = rows.map((x) => ({ company_id: x.company_id, created_at: x.created_at, companies: co(x.company_id) ? { id: x.company_id, name: co(x.company_id).name } : null }));
        const single = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
        return single ? (rows[0] ? j(200, rows[0]) : j(406, { code: 'PGRST116' })) : j(200, rows);
      }
      if (method === 'POST') { if (profile.account_type !== 'student') return j(403, { code: '42501', message: 'rls' }); log.follows.push({ company_id: body.company_id, created_at: new Date().toISOString() }); return r.fulfill({ status: 201, body: '' }); }
      if (method === 'DELETE') { const id = url.searchParams.get('company_id').slice(3); log.follows = log.follows.filter((x) => x.company_id !== id); return r.fulfill({ status: 204, body: '' }); }
    }
    if (path === '/rest/v1/job_clicks') return j(200, opts.clicks || []);
    if (path === '/rest/v1/rpc/my_feedback') return j(200, opts.myFeedback || []);
    if (path === '/rest/v1/rpc/my_reports') return j(200, opts.myReports || []);
    if (path === '/rest/v1/rpc/my_opened_jobs') { log.openedCalls = (log.openedCalls || 0) + 1; return j(200, opts.opened || []); }
    if (path === '/rest/v1/areas') { log.areas = (log.areas || 0) + 1; return j(200, AREAS); }
    if (path === '/rest/v1/universities') return j(200, [{ id: 'u', name: 'Bocconi University', email_domains: ['studbocconi.it'] }]);
    if (path === '/auth/v1/otp') { const b = req.postDataJSON(); log.otp.push(b); if (b.email.startsWith('ratelimit')) return j(429, { code: 429, error_code: 'over_email_send_rate_limit', msg: 'x' }); return j(200, {}); }
    if (path === '/auth/v1/verify') { const b = req.postDataJSON(); if (b.token !== '123456') return j(403, { code: 403, error_code: 'otp_expired', msg: 'x' }); const exp = Math.floor(Date.now() / 1000) + 3600; return j(200, { access_token: b64({ alg: 'HS256' }) + '.' + b64({ sub: 'u1', exp }) + '.s', token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r', user: { id: 'u1', aud: 'authenticated', email: b.email, app_metadata: {}, user_metadata: {} } }); }
    if (path === '/rest/v1/profiles' && method === 'GET') {
      log.profileSelects = (log.profileSelects || []).concat(url.searchParams.get('select'));
      if (opts.accountFail && /universities/.test(url.searchParams.get('select') || '')) return j(500, { message: 'boom' });
      const row = { ...profile };
      if (/universities/.test(url.searchParams.get('select') || '')) row.universities = profile.account_type === 'student' ? { name: 'Bocconi University' } : null;
      const single = /vnd\.pgrst\.object/.test(req.headers()['accept'] || ''); return j(200, single ? row : [row]);
    }
    if (path === '/rest/v1/rpc/delete_my_account') { log.deleted = (log.deleted || 0) + 1; log.deleteMethod = method; if (opts.deleteFail) return j(500, { message: 'boom' }); log.userGone = true; return r.fulfill({ status: 204, body: '' }); }
    if (path === '/rest/v1/profiles' && method === 'PATCH') { log.patches = (log.patches || []).concat([{ body: req.postDataJSON(), search: url.search }]); if (opts.saveFail) return j(500, { message: 'boom' }); Object.assign(profile, req.postDataJSON()); return r.fulfill({ status: 204, body: '' }); }
    if (path === '/rest/v1/feedback') { log.feedback = log.feedback || []; log.feedback.push({ method, body: req.postDataJSON(), prefer: req.headers()['prefer'] || '', search: url.search }); if (opts.feedbackFail) return j(500, { message: 'boom' });
      if (opts.feedbackLimit) return j(400, { code: '54000', message: 'Daily limit reached: you can send feedback up to 20 times a day. Try again tomorrow.' }); return r.fulfill({ status: 201, body: '' }); }
    if (path === '/auth/v1/logout') { log.logout = (log.logout || 0) + 1; if (log.userGone) return j(403, { code: 403, error_code: 'session_not_found', msg: 'Session from session_id claim in JWT does not exist' }); return r.fulfill({ status: 204, body: '' }); }
    return r.fulfill({ status: 204, body: '' });
  });
  return log;
}
async function login(p, email = 'ana@studbocconi.it') {
  await p.fill('input[name=email]', email); await p.click('text=Send me a code'); await p.waitForTimeout(300);
  await p.fill('input[name=code]', '123456'); await p.waitForTimeout(900);
}
module.exports = { sortByOrder, mock, login, ID, JOBS, AREAS, NEBBIA, FINTRA, ago };
