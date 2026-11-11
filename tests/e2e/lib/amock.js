// Admin / reports fake Supabase, layered over ../home/mock.js.
const { mock, login, ID } = require('./mock.js');
const SB = 'https://testproj.supabase.co';
const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();

async function amock(ctx, opts = {}) {
  const log = await mock(ctx, opts);
  const co = (id, name, status, extra = {}) => ({ id, name, status, website: null, description: null, created_at: ago(30), ...extra });
  const db = {
    companies: [co('c1', 'Nebbia Coffee Bar', 'pending', { website: 'nebbia.it', description: 'Specialty coffee.' }), co('c2', 'Fintra', 'pending'), co('c3', 'Approved Co', 'approved')],
    companyContact: { c1: ['hiring@nebbia.it', 'owner@nebbia.it'], c2: ['me@gmail.com', 'me@gmail.com'] },
    jobs: [
      { id: 'pj1', title: 'Weekend barista', description: 'Serve coffee.', job_type: 'part_time', location: 'Brera', remote: false, hours_per_week: 12, pay: '€11/h', italian_level: 'none', start_date: null, expires_at: ago(-24 * 30), status: 'pending', created_at: ago(5), review_note: null, reviewed_at: null, company_id: 'c3', area_id: 2, areas: { name: 'Brera' }, schedule: ['weekends'], languages: ['en'], pay_unit: 'hour', pay_min: 11, pay_max: null },
      { id: 'pj2', title: 'Promoter', description: 'Pay €30 to join.', job_type: 'gig', location: null, remote: true, hours_per_week: 25, pay: null, italian_level: 'basic', start_date: null, expires_at: ago(-24 * 30), status: 'pending', created_at: ago(4), review_note: 'Add pay.', reviewed_at: ago(10), company_id: 'c3', schedule: ['flexible'], pay_unit: 'hour', pay_min: 10, pay_max: null },
      { id: ID(1), title: 'Weekend barista (live)', description: 'Serve coffee.', job_type: 'part_time', location: 'Porta Venezia', remote: false, hours_per_week: 12, pay: '€11/h', italian_level: 'none', start_date: null, expires_at: ago(-24 * 30), status: 'published', created_at: ago(50), review_note: null, reviewed_at: null, company_id: 'c3' }
    ],
    jobContact: { pj1: ['https://nebbia.it/jobs', null], pj2: [null, 'promo@gmail.com'], [ID(1)]: ['https://nebbia.it/apply', null] },
    reports: [{ id: 'r1', reason: 'scam', details: 'They asked me for a €50 fee.', created_at: ago(2), reporter_id: 'u9', job_id: ID(1), status: 'open' },
      // A report whose job (and company) was deleted: only the kept title and name.
      ...(opts.goneReport ? [{ id: 'r2', reason: 'misleading', details: 'Pay was half.', created_at: ago(1), reporter_id: null, job_id: null, job_title: 'Night shift', company_name: 'Gone Ltd', status: 'open' }] : [])],
    profiles: { u1: { id: 'u1', full_name: 'Ana Rossi', account_type: 'student' }, u9: { id: 'u9', full_name: 'Marco Bianchi', account_type: 'student' } },
    log: [{ id: 1, created_at: ago(20), admin_id: 'u1', action: 'company_approved', note: null, company_id: 'c3', job_id: null }],
    myReports: []
  };
  log.rpcs = [];
  if (opts.extraJobs) db.jobs.push(...opts.extraJobs);
  await ctx.route(SB + '/rest/v1/**', async (r) => {
    const req = r.request(), url = new URL(req.url()), path = url.pathname, method = req.method(), p = url.searchParams;
    const j = (s, b) => r.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    const body = () => { try { return req.postDataJSON(); } catch { return null; } };
    const eq = (k) => (p.get(k) || '').replace(/^eq\./, '');
    const jobOut = (x) => ({ ...x, companies: db.companies.find((c) => c.id === x.company_id) });
    if (path === '/rest/v1/rpc/is_admin') { log.rpcs.push(['is_admin']); return j(200, Boolean(opts.admin)); }
    if (path.startsWith('/rest/v1/rpc/admin_')) {
      const b = body(); const name = path.split('/').pop(); log.rpcs.push([name, b]);
      if (!opts.admin) return j(403, { code: '42501', message: 'Only admins.' });
      if (name === 'admin_stats') return j(200, [opts.stats || { students: 41, companies_approved: 7, companies_with_live_job: 5, live_jobs: 12, apply_clicks_this_week: 33, students_clicked_this_week: 19 }]);
      if (name === 'admin_company_contact') { const c = db.companyContact[b.p_company_id] || []; return j(200, [{ contact_email: c[0], login_email: c[1] }]); }
      if (name === 'admin_job_contact') { const c = db.jobContact[b.p_job_id]; return j(200, c ? [{ apply_url: c[0], apply_email: c[1] }] : []); }
      if (name === 'admin_set_company_status') { db.companies.find((c) => c.id === b.p_company_id).status = b.p_status; db.log.unshift({ id: db.log.length + 1, created_at: new Date().toISOString(), admin_id: 'u1', action: 'company_' + b.p_status, note: null, company_id: b.p_company_id }); return r.fulfill({ status: 204, body: '' }); }
      if (name === 'admin_review_job') {
        if (['changes_requested', 'rejected'].includes(b.p_status) && !(b.p_note || '').trim()) return j(400, { code: '22023', message: 'Add a note for the employer when requesting changes or rejecting.' });
        const x = db.jobs.find((y) => y.id === b.p_job_id); x.status = b.p_status; x.review_note = b.p_note;
        db.log.unshift({ id: db.log.length + 1, created_at: new Date().toISOString(), admin_id: 'u1', action: 'job_' + b.p_status, note: b.p_note, job_id: x.id }); return r.fulfill({ status: 204, body: '' });
      }
      if (name === 'admin_resolve_report') {
        if (!(b.p_note || '').trim()) return j(400, { code: '22023', message: 'Add a note.' });
        const x = db.reports.find((y) => y.id === b.p_report_id); x.status = 'resolved';
        db.log.unshift({ id: db.log.length + 1, created_at: new Date().toISOString(), admin_id: 'u1', action: 'report_resolved', note: b.p_note, job_id: x.job_id }); return r.fulfill({ status: 204, body: '' });
      }
    }
    if (path === '/rest/v1/companies' && method === 'GET' && p.get('status') === 'eq.pending') {
      if (!opts.admin) return j(200, []);
      return j(200, db.companies.filter((c) => c.status === 'pending'));
    }
    if (path === '/rest/v1/jobs' && method === 'GET' && p.get('status') === 'eq.published' && /area_id\.is\.null/.test(p.get('or') || '')) {
      log.noAreaQuery = url.search;
      return j(200, opts.admin ? (opts.noAreaLive || []) : []);
    }
    if (path === '/rest/v1/jobs' && method === 'GET' && p.get('status') === 'eq.pending') {
      if (!opts.admin) return j(200, []);
      return j(200, db.jobs.filter((x) => x.status === 'pending').map(jobOut));
    }
    if (path === '/rest/v1/job_reports' && method === 'GET') {
      if (!opts.admin) return j(200, []);
      return j(200, db.reports.filter((x) => x.status === 'open').map((x) => { const jb = db.jobs.find((y) => y.id === x.job_id); return { ...x, jobs: jb ? jobOut(jb) : null }; }));
    }
    if (path === '/rest/v1/job_reports' && method === 'POST') {
      const b = body(); log.reportPosts = (log.reportPosts || []).concat([b]);
      if (opts.reportFail) return j(500, { message: 'boom' });
      if (db.myReports.includes(b.job_id)) return j(409, { code: '23505', message: 'duplicate key value violates unique constraint "job_reports_one_open_per_user"' });
      db.myReports.push(b.job_id); return r.fulfill({ status: 201, body: '' });
    }
    if (path === '/rest/v1/moderation_log' && method === 'GET') {
      if (!opts.admin) return j(200, []);
      return j(200, db.log.map((e) => ({ ...e, companies: e.company_id ? { name: db.companies.find((c) => c.id === e.company_id).name } : null, jobs: e.job_id ? { title: (db.jobs.find((x) => x.id === e.job_id) || {}).title } : null })));
    }
    if (path === '/rest/v1/feedback' && method === 'GET') {
      log.feedbackReads = (log.feedbackReads || []).concat([url.search]);
      if (opts.feedbackReadFail) return j(500, { message: 'boom' });
      if (!opts.admin) return j(200, []);
      return j(200, opts.feedbackRows || [
        { id: 3, page: '/jobs?area=3&view=map', message: 'The map is great.\nBut the pins overlap.', created_at: ago(1) },
        { id: 2, page: 'javascript:alert(1)', message: '<b>bold?</b>', created_at: ago(5) },
        { id: 1, page: null, message: 'No page on this one.', created_at: ago(48) }
      ]);
    }
    if (path === '/rest/v1/profiles' && method === 'GET' && (p.get('id') || '').startsWith('in.')) {
      const ids = p.get('id').slice(4, -1).split(',');
      return j(200, ids.map((i) => db.profiles[i]).filter(Boolean));
    }
    return r.fallback();
  });
  return { log, db };
}
module.exports = { amock, login, ID };
