-- GigoMe KPIs
--
-- Paste into the Supabase SQL Editor and press Run. Read-only: it changes
-- nothing. It is not a migration and is never applied automatically.
--
-- One table: metric | detail | value.
--   * Live job = published, not expired, from an approved company (what
--     students can see on /jobs).
--   * Apply clicks = presses of "Apply" (reveal_job_contact). They are not
--     applications: GigoMe doesn't see whether anyone applied.
--   * Weeks start on Monday (UTC); the last 12 weeks, including weeks with
--     no clicks.
--   * Distinct students per week leaves out clicks of deleted accounts (their
--     user_id is empty); their clicks still count in "Apply clicks".
--   * Test and admin accounts are counted like everyone else.

with live_jobs as (
  select j.id, j.company_id
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where j.status = 'published' and j.expires_at > now() and c.status = 'approved'
),
weeks as (
  select w::date as week
  from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') as w
),
weekly as (
  select wk.week,
         count(k.id) as clicks,
         count(distinct k.user_id) as students
  from weeks wk
  left join public.job_clicks k
    on k.created_at >= wk.week and k.created_at < wk.week + interval '1 week'
  group by wk.week
)
select metric, detail, value
from (
  select 1 as section, 'Students registered' as metric, '' as detail,
         (select count(*) from public.profiles where account_type = 'student') as value
  union all
  select 2, 'Students per university', u.name, count(p.id)
  from public.universities u
  left join public.profiles p on p.university_id = u.id and p.account_type = 'student'
  group by u.name
  union all
  select 3, 'Approved companies', '', (select count(*) from public.companies where status = 'approved')
  union all
  select 4, 'Companies with at least one live job', '', (select count(distinct company_id) from live_jobs)
  union all
  select 5, 'Live jobs', '', (select count(*) from live_jobs)
  union all
  select 6, 'Apply clicks per week (week starting)', to_char(week, 'YYYY-MM-DD'), clicks from weekly
  union all
  select 7, 'Distinct students who clicked per week (week starting)', to_char(week, 'YYYY-MM-DD'), students from weekly
) t
order by section, detail;
