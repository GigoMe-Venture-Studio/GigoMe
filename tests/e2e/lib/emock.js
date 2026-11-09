// Employer-side fake Supabase, layered over ../home/mock.js. Keeps state and
// applies the same rules as the database (owner policies, review fields).
const { mock, login } = require('./mock.js');
const SB = 'https://testproj.supabase.co';

async function emock(ctx, opts = {}) {
  const log = await mock(ctx, { accountType: 'company', fullName: opts.fullName === undefined ? null : opts.fullName, ...opts });
  const db = {
    company: opts.company === undefined ? null : { id: 'c1', owner_id: 'u1', contact_email: 'owner@cafe.it', ...opts.company },
    jobs: (opts.jobs || []).map((j, i) => ({ id: 'j' + (i + 1), company_id: 'c1', description: null, location: null, remote: false, pay: null, schedule: ['weekends'], languages: [], pay_unit: 'hour', pay_min: 11, pay_max: null,
      italian_level: 'none', start_date: null, expires_at: new Date(Date.now() + 30 * 864e5).toISOString(), created_at: new Date(Date.now() - i * 864e5).toISOString(),
      review_note: null, reviewed_at: null, ...j })),
    contacts: opts.contacts || {},
    clicks: opts.clicks || {},
    seq: 100
  };
  log.req = [];
  const rls = (r) => r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'new row violates row-level security policy for table "jobs"' }) });
  await ctx.route(SB + '/rest/v1/**', async (r) => {
    const req = r.request(), url = new URL(req.url()), path = url.pathname, method = req.method(), p = url.searchParams;
    const single = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
    const j = (s, b) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    const eq = (k) => (p.get(k) || '').replace(/^eq\./, '');
    const body = () => { try { return req.postDataJSON(); } catch { return null; } };
    const pick = (row) => { const cols = (p.get('select') || '*').split(',').map((c) => c.trim()); if (cols[0] === '*') return row; return Object.fromEntries(cols.map((c) => [c, row[c]])); };
    if (path === '/rest/v1/companies') {
      log.req.push({ method, path, search: url.search, body: body() });
      if (method === 'GET') {
        if (/contact_email/.test(p.get('select') || '')) return j(403, { code: '42501', message: 'permission denied for column contact_email' });
        const rows = db.company && (!p.get('owner_id') || eq('owner_id') === db.company.owner_id) ? [pick(db.company)] : [];
        return single ? (rows[0] ? j(200, rows[0]) : j(406, { code: 'PGRST116' })) : j(200, rows);
      }
      if (method === 'POST') {
        const b = body();
        if (b.status || b.owner_id) return j(403, { code: '42501', message: 'permission denied' });
        if (!b.terms_accepted_at) return j(403, { code: '42501', message: 'new row violates row-level security policy for table "companies"' });
        if (opts.companyFail) return j(500, { message: 'boom' });
        db.company = { id: 'c1', owner_id: 'u1', status: 'pending', ...b };
        return single ? j(201, pick(db.company)) : j(201, [pick(db.company)]);
      }
      if (method === 'PATCH') {
        const b = body();
        if (b.status) return j(403, { code: '42501', message: 'permission denied' });
        if (db.company.status === 'approved' && (('name' in b && b.name !== db.company.name) || ('website' in b && b.website !== db.company.website)))
          return j(403, { code: '42501', message: 'Once a company is approved, only GigoMe can change its name and website.' });
        Object.assign(db.company, b);
        return single ? j(200, pick(db.company)) : j(200, [pick(db.company)]);
      }
    }
    if (path === '/rest/v1/rpc/get_company_contact_email') { log.req.push({ method, path, body: body() }); return j(200, db.company ? db.company.contact_email : null); }
    if (path === '/rest/v1/rpc/my_company_follower_count') { log.req.push({ method, path }); return j(200, opts.followers ?? 3); }
    if (path === '/rest/v1/rpc/my_job_stats') { log.req.push({ method, path }); return j(200, db.jobs.map((x) => ({ job_id: x.id, apply_clicks: db.clicks[x.id] || 0 }))); }
    if (path === '/rest/v1/rpc/extend_my_job') {
      const id = body().p_job_id; log.req.push({ method, path, body: body() });
      const x = db.jobs.find((y) => y.id === id);
      if (!x || x.status !== 'published' || !db.company || db.company.status !== 'approved') return j(403, { code: '42501', message: 'Only a published job of your own approved company can be extended.' });
      if (new Date(x.expires_at).getTime() < Date.now() - 14 * 864e5) return j(403, { code: '42501', message: 'This job expired more than 14 days ago. Edit it and submit it again for review.' });
      x.expires_at = new Date(Date.now() + 60 * 864e5).toISOString(); return j(200, x.expires_at);
    }
    if (path === '/rest/v1/rpc/get_own_job_contact') { const id = body().p_job_id; const c = db.contacts[id]; return j(200, c ? [{ apply_url: c.url, apply_email: c.email }] : []); }
    if (path === '/rest/v1/rpc/set_job_contact') {
      const b = body(); log.req.push({ method, path, body: b });
      if (opts.contactFail) return j(500, { message: 'boom' });
      if (!b.p_apply_url && !b.p_apply_email) delete db.contacts[b.p_job_id]; else db.contacts[b.p_job_id] = { url: b.p_apply_url, email: b.p_apply_email };
      return r.fulfill({ status: 204, body: '' });
    }
    if (path === '/rest/v1/jobs' && p.get('company_id') && method === 'GET') {
      log.req.push({ method, path, search: url.search });
      if (/reviewed_by/.test(p.get('select') || '')) return j(403, { code: '42501', message: 'permission denied for column reviewed_by' });
      let rows = db.jobs.filter((x) => x.company_id === eq('company_id'));
      if (p.get('id')) rows = rows.filter((x) => x.id === eq('id'));
      rows = rows.map(pick);
      return single ? (rows[0] ? j(200, rows[0]) : j(406, { code: 'PGRST116' })) : j(200, rows);
    }
    if (path === '/rest/v1/jobs' && method === 'POST') {
      const b = body(); log.req.push({ method, path, body: b });
      if (['review_note', 'reviewed_by', 'reviewed_at'].some((k) => k in b)) return j(403, { code: '42501', message: 'permission denied' });
      if (!(b.status === 'draft' || (b.status === 'pending' && db.company.status === 'approved'))) return rls(r);
      const row = { id: 'j' + db.seq++, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60 * 864e5).toISOString(), review_note: null, reviewed_at: null, ...b };
      db.jobs.unshift(row);
      return single ? j(201, pick(row)) : j(201, [pick(row)]);
    }
    if (path === '/rest/v1/jobs' && method === 'PATCH') {
      const b = body(); log.req.push({ method, path, search: url.search, body: b });
      if (['review_note', 'reviewed_by', 'reviewed_at'].some((k) => k in b)) return j(403, { code: '42501', message: 'permission denied' });
      const row = db.jobs.find((x) => x.id === eq('id'));
      if (!row || row.status === 'rejected') return r.fulfill({ status: 204, body: '' });
      const next = { ...row, ...b };
      if (!(['draft', 'closed'].includes(next.status) || (next.status === 'pending' && db.company.status === 'approved'))) return rls(r);
      Object.assign(row, b);
      return r.fulfill({ status: 204, body: '' });
    }
    if (path === '/rest/v1/jobs' && method === 'DELETE') {
      log.req.push({ method, path, search: url.search });
      const i = db.jobs.findIndex((x) => x.id === eq('id') && x.status === 'draft' && (!p.get('status') || eq('status') === 'draft'));
      if (i >= 0) db.jobs.splice(i, 1);
      return r.fulfill({ status: 204, headers: { 'content-range': `*/${i >= 0 ? 1 : 0}` }, body: '' });
    }
    return r.fallback();
  });
  return { log, db };
}

async function employerLogin(p, base, email = 'owner@cafe.it') {
  await p.goto(base + '/employers'); await p.waitForTimeout(300);
  await p.fill('input[name=email]', email); await p.click('text=Send me a code'); await p.waitForTimeout(300);
  await p.fill('input[name=code]', '123456'); await p.waitForTimeout(900);
}
module.exports = { emock, employerLogin, login };
