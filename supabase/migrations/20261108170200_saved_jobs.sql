-- Saved jobs: students keep a list of jobs to come back to.
--
--   * saved_jobs (user_id, job_id, created_at): visible to and changed by the
--     student who saved them only. A student saves a job they can see (a live
--     one), for themselves (user_id is always the caller), once.
--   * Deleted with the account (auth.users, on delete cascade) and with the
--     job.
--   * my_saved_jobs(): the caller's saved jobs with title, company and
--     whether they are still live, so a job that closed or expired can be
--     shown as "No longer available" (students can't read closed jobs).

create table public.saved_jobs (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id     uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);
alter table public.saved_jobs enable row level security;
create index saved_jobs_job_id_idx on public.saved_jobs (job_id);

revoke all on table public.saved_jobs from public, anon, authenticated;
grant select, delete on table public.saved_jobs to authenticated;
grant insert (job_id) on table public.saved_jobs to authenticated;

create policy "Students read their own saved jobs"
  on public.saved_jobs for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Students save jobs they can see, for themselves"
  on public.saved_jobs for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_account_type()) = 'student'
    and exists (select 1 from public.jobs j where j.id = job_id)
  );

create policy "Students remove their own saved jobs"
  on public.saved_jobs for delete
  to authenticated
  using (user_id = (select auth.uid()));

create function public.my_saved_jobs()
returns table (job_id uuid, saved_at timestamptz, title text, company_name text, live boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.job_id, s.created_at, j.title, c.name,
         (j.status = 'published' and j.expires_at > now() and c.status = 'approved')
  from public.saved_jobs s
  join public.jobs j on j.id = s.job_id
  join public.companies c on c.id = j.company_id
  where s.user_id = (select auth.uid())
  order by s.created_at desc;
$$;

revoke all on function public.my_saved_jobs() from public, anon, authenticated;
grant execute on function public.my_saved_jobs() to authenticated;
