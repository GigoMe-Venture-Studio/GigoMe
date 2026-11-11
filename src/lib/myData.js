// "Download my data" on /account: everything GigoMe holds about the logged-in
// user, gathered in the browser from their own rows (the database lets each
// user read only their own) and saved as a JSON file. Nothing new is stored
// and nothing is sent anywhere else.
import { supabase } from './supabase.js';

const JOB_COLUMNS =
  'id, title, description, job_type, category, location, remote, area_id, latitude, longitude, show_exact_location, ' +
  'hours_per_week, schedule, languages, pay_unit, pay_min, pay_max, pay, italian_level, start_date, expires_at, ' +
  'status, review_note, reviewed_at, published_at, created_at';

async function rows(label, request) {
  const { data, error } = await request;
  if (error) throw new Error(`${label}: ${error.message || 'not loaded'}`);
  return data;
}

export async function collectMyData(user) {
  const profile = await rows('profile', supabase
    .from('profiles')
    .select('account_type, full_name, degree_level, graduation_year, created_at, terms_version, terms_accepted_at, universities(name)')
    .eq('id', user.id)
    .maybeSingle());
  const data = {
    about_this_file:
      'Everything GigoMe (gigome.org) holds about your account, as of the time below. ' +
      'Your login session on this device is kept by your browser and is not included.',
    exported_at: new Date().toISOString(),
    account: {
      email: user.email,
      created_at: user.created_at || null,
      last_sign_in_at: user.last_sign_in_at || null,
      type: profile ? profile.account_type : null
    },
    profile: profile && {
      full_name: profile.full_name,
      degree_level: profile.degree_level,
      graduation_year: profile.graduation_year,
      university: profile.universities ? profile.universities.name : null,
      created_at: profile.created_at,
      terms_accepted: profile.terms_accepted_at ? { version: profile.terms_version, at: profile.terms_accepted_at } : null
    },
    feedback_sent: await rows('feedback', supabase.rpc('my_feedback')),
    jobs_reported: await rows('reports', supabase.rpc('my_reports'))
  };

  if (!profile || profile.account_type === 'student') {
    data.saved_jobs = await rows('saved jobs', supabase.rpc('my_saved_jobs'));
    data.saved_searches = await rows('saved searches', supabase
      .from('saved_searches').select('name, params, created_at, last_seen_at').order('created_at'));
    data.companies_followed = (await rows('follows', supabase
      .from('company_follows').select('company_id, created_at, companies(name)').order('created_at')))
      .map((f) => ({ company_id: f.company_id, company: f.companies ? f.companies.name : null, followed_at: f.created_at }));
    data.apply_clicks = await rows('apply clicks', supabase
      .from('job_clicks').select('job_id, created_at').eq('user_id', user.id).order('created_at'));
    data.jobs_opened = await rows('jobs opened', supabase.rpc('my_opened_jobs'));
  } else {
    const company = await rows('company', supabase
      .from('companies').select('id, name, website, description, status, created_at').eq('owner_id', user.id).maybeSingle());
    if (company) {
      const email = await rows('company email', supabase.rpc('get_company_contact_email', { p_company_id: company.id }));
      const jobs = await rows('jobs', supabase
        .from('jobs').select(JOB_COLUMNS).eq('company_id', company.id).order('created_at'));
      const clicks = await rows('apply clicks', supabase.rpc('my_job_stats'));
      const clicksFor = Object.fromEntries((clicks || []).map((r) => [r.job_id, Number(r.apply_clicks) || 0]));
      for (const job of jobs) {
        const contact = (await rows('how to apply', supabase.rpc('get_own_job_contact', { p_job_id: job.id }))) || [];
        job.how_to_apply = { apply_url: (contact[0] && contact[0].apply_url) || null, apply_email: (contact[0] && contact[0].apply_email) || null };
        job.apply_clicks = clicksFor[job.id] || 0;
      }
      data.company = { ...company, contact_email: email || null };
      data.jobs = jobs;
      data.followers = await rows('followers', supabase.rpc('my_company_follower_count'));
    } else {
      data.company = null;
    }
  }
  return data;
}

// Saves the data as gigome-my-data-<date>.json on the user's device.
export function downloadJson(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
