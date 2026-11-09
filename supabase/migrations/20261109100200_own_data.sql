-- "Download my data" on /account: the two kinds of rows a user wrote but
-- can't read directly (only admins read feedback and reports).
--
--   * my_feedback(): the caller's own feedback (page, message, time).
--   * my_reports(): the reports the caller filed (job, reason, details, time,
--     open or resolved). Not the admin's resolution note or who resolved it.
--   Both only ever return the caller's own rows (auth.uid()).

create function public.my_feedback()
returns table (page text, message text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.page, f.message, f.created_at
  from public.feedback f
  where f.user_id = (select auth.uid())
  order by f.created_at;
$$;

create function public.my_reports()
returns table (job_id uuid, job_title text, reason text, details text, status text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.job_id, j.title, r.reason, r.details, r.status, r.created_at
  from public.job_reports r
  join public.jobs j on j.id = r.job_id
  where r.reporter_id = (select auth.uid())
  order by r.created_at;
$$;

revoke all on function public.my_feedback(), public.my_reports() from public, anon, authenticated;
grant execute on function public.my_feedback(), public.my_reports() to authenticated;
