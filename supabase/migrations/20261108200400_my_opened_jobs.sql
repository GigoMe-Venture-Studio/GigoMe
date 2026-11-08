-- Part 5: "Jobs you opened" on /saved, from the student's own apply clicks.
--
--   * A student may read their own rows of job_clicks (until now only
--     admins could read any). Nobody else's.
--   * my_opened_jobs(): one row per job the caller pressed "Apply" on, with
--     the last time, title, company and whether the job is still live (a
--     closed job can't be read directly any more). GigoMe only knows the
--     application was opened, never whether they applied: the site says
--     "You opened the application on <date>".

create policy "Students read their own apply clicks"
  on public.job_clicks for select
  to authenticated
  using (user_id = (select auth.uid()));

create function public.my_opened_jobs()
returns table (job_id uuid, last_opened_at timestamptz, title text, company_name text, live boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select k.job_id, max(k.created_at), j.title, c.name,
         bool_and(j.status = 'published' and j.expires_at > now() and c.status = 'approved')
  from public.job_clicks k
  join public.jobs j on j.id = k.job_id
  join public.companies c on c.id = j.company_id
  where k.user_id = (select auth.uid())
  group by k.job_id, j.title, c.name
  order by max(k.created_at) desc;
$$;

revoke all on function public.my_opened_jobs() from public, anon, authenticated;
grant execute on function public.my_opened_jobs() to authenticated;
