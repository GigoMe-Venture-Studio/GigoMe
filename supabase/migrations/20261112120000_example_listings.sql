-- Example listings: fictional companies and jobs for testers, until the
-- public launch.
--
--   * companies.is_example / jobs.is_example (default false). Example rows
--     are loaded by hand in the SQL Editor from supabase/seed/examples.sql
--     and removed, with everything that points at them, by
--     supabase/seed/remove_examples.sql (HANDOVER.md, launch checklist).
--     The site marks them "Example listing, not a real job" and asks search
--     engines not to index their pages.
--   * Everyone reads the flag; nobody writes it through the API (no insert
--     or update grants), so no employer can mark a real listing as an
--     example or the other way round. Only the SQL Editor sets it.
--   * An example company has no owner (owner_id empty): nobody can log in
--     as it, so nobody can edit it or its jobs, and no fake login accounts
--     are needed. Every other company still needs an owner (check
--     companies_owner_unless_example).
--   * reveal_job_contact() refuses example jobs: there is no employer to
--     apply to, so no contact is shown and no apply click is recorded.
--     Employers' click counts (my_job_stats) never include example jobs:
--     only the owner sees them, and example companies have none.
--   * admin_stats() leaves example companies and jobs (and any clicks on
--     them) out of every number, like supabase/queries/kpis.sql.

-- ===========================================================================
-- The flag
-- ===========================================================================

alter table public.companies add column is_example boolean not null default false;
alter table public.jobs add column is_example boolean not null default false;

create index jobs_is_example_idx on public.jobs (is_example) where is_example;

-- Read by everyone who can read the row, for the badge. No insert or update
-- grants.
grant select (is_example) on table public.companies to anon, authenticated;
grant select (is_example) on table public.jobs to anon, authenticated;


-- ===========================================================================
-- Example companies have no owner
-- ===========================================================================

alter table public.companies alter column owner_id drop not null;
alter table public.companies
  add constraint companies_owner_unless_example check (owner_id is not null or is_example);


-- ===========================================================================
-- Nobody applies to an example job
-- ===========================================================================

-- As in 20261107120000_initial_schema.sql, plus the example check before
-- anything is recorded.
create or replace function public.reveal_job_contact(p_job_id uuid)
returns table (apply_url text, apply_email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Sign in to see how to apply.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_user and p.account_type = 'student') then
    raise exception 'Only student accounts can see how to apply.' using errcode = '42501';
  end if;
  if exists (select 1 from public.jobs j where j.id = p_job_id and j.is_example) then
    raise exception 'This is an example listing, not a real job: there is nobody to apply to.' using errcode = 'P0002';
  end if;
  if not exists (
    select 1
    from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = p_job_id
      and j.status = 'published'
      and j.expires_at > now()
      and c.status = 'approved'
  ) then
    raise exception 'This job is not available.' using errcode = 'P0002';
  end if;

  insert into public.job_clicks (job_id, user_id) values (p_job_id, v_user);

  return query
    select jc.apply_url, jc.apply_email from public.job_contacts jc where jc.job_id = p_job_id;
end;
$$;

revoke all on function public.reveal_job_contact(uuid) from public, anon, authenticated;
grant execute on function public.reveal_job_contact(uuid) to authenticated;


-- ===========================================================================
-- Admin numbers without the examples
-- ===========================================================================

-- As in 20261109100500_admin_stats.sql, with example companies, example jobs
-- and clicks on example jobs left out. Students are unchanged (example
-- companies have no accounts).
create or replace function public.admin_stats()
returns table (
  students bigint,
  companies_approved bigint,
  companies_with_live_job bigint,
  live_jobs bigint,
  apply_clicks_this_week bigint,
  students_clicked_this_week bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can read the numbers.' using errcode = '42501';
  end if;
  return query
  with live as (
    select j.id, j.company_id
    from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.status = 'published' and j.expires_at > now() and c.status = 'approved'
      and not j.is_example and not c.is_example
  ),
  week as (
    select k.id, k.user_id
    from public.job_clicks k
    join public.jobs j on j.id = k.job_id
    where k.created_at >= date_trunc('week', now()) and not j.is_example
  )
  select
    (select count(*) from public.profiles p where p.account_type = 'student'),
    (select count(*) from public.companies c where c.status = 'approved' and not c.is_example),
    (select count(distinct l.company_id) from live l),
    (select count(*) from live),
    (select count(*) from week),
    (select count(distinct w.user_id) from week w);
end;
$$;

revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to authenticated;
