-- Data retention: prepared, but OFF. Nothing is deleted until someone sets a
-- period (waiting for the legal decision; see SUPABASE.md).
--
--   * retention_settings: one row. Each period is in days and empty (null)
--     by default; empty means "keep forever".
--       ended_jobs_days         closed or rejected jobs, and expired jobs,
--                               this long after they ended (with their
--                               contacts, clicks, reports and saves)
--       feedback_days           feedback messages older than this
--       resolved_reports_days   reports resolved this long ago
--       inactive_accounts_days  accounts not signed in for this long (not
--                               admins): deleted like delete_my_account()
--     Changed only in the dashboard (Table Editor): no grants at all.
--   * run_retention(): applies the periods that are set, records when it ran
--     and what it deleted (last_run_at, last_result). Not callable through
--     the API.
--   * A daily pg_cron job (03:37 UTC) runs it, when pg_cron is available.

create table public.retention_settings (
  id                     smallint primary key default 1 check (id = 1),
  ended_jobs_days        integer check (ended_jobs_days >= 30),
  feedback_days          integer check (feedback_days >= 30),
  resolved_reports_days  integer check (resolved_reports_days >= 30),
  inactive_accounts_days integer check (inactive_accounts_days >= 180),
  last_run_at            timestamptz,
  last_result            jsonb
);
alter table public.retention_settings enable row level security;
revoke all on table public.retention_settings from public, anon, authenticated;
-- No grants and no policies: only the dashboard and run_retention() touch it.

insert into public.retention_settings (id) values (1);

create function public.run_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.retention_settings;
  v_jobs bigint := 0;
  v_feedback bigint := 0;
  v_reports bigint := 0;
  v_accounts bigint := 0;
  v_result jsonb;
begin
  select * into s from public.retention_settings where id = 1;
  if not found then
    return '{}'::jsonb;
  end if;

  if s.ended_jobs_days is not null then
    delete from public.jobs j
    where j.expires_at < now() - make_interval(days => s.ended_jobs_days)
       or (j.status in ('closed', 'rejected')
           and greatest(j.created_at, j.reviewed_at, j.submitted_at) < now() - make_interval(days => s.ended_jobs_days));
    get diagnostics v_jobs = row_count;
  end if;

  if s.feedback_days is not null then
    delete from public.feedback f where f.created_at < now() - make_interval(days => s.feedback_days);
    get diagnostics v_feedback = row_count;
  end if;

  if s.resolved_reports_days is not null then
    delete from public.job_reports r
    where r.status = 'resolved' and r.resolved_at < now() - make_interval(days => s.resolved_reports_days);
    get diagnostics v_reports = row_count;
  end if;

  if s.inactive_accounts_days is not null then
    -- Like delete_my_account(): feedback explicitly, then the user (the
    -- rest cascades; their clicks and reports stay, anonymous).
    delete from public.feedback f
    where f.user_id in (
      select u.id from auth.users u
      where coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => s.inactive_accounts_days)
        and not exists (select 1 from public.admins a where a.user_id = u.id)
    );
    delete from auth.users u
    where coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => s.inactive_accounts_days)
      and not exists (select 1 from public.admins a where a.user_id = u.id);
    get diagnostics v_accounts = row_count;
  end if;

  v_result := jsonb_build_object('jobs', v_jobs, 'feedback', v_feedback, 'resolved_reports', v_reports, 'accounts', v_accounts);
  update public.retention_settings set last_run_at = now(), last_result = v_result where id = 1;
  return v_result;
end;
$$;

revoke all on function public.run_retention() from public, anon, authenticated;
-- No grants: run by pg_cron (or by hand in the SQL Editor).

-- The daily job. pg_cron is available on Supabase; if it can't be set up
-- here, the migration still succeeds and SUPABASE.md says how to add it.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('gigome-retention', '37 3 * * *', 'select public.run_retention()');
  else
    raise notice 'pg_cron is not available: schedule public.run_retention() by hand (see SUPABASE.md).';
  end if;
exception when others then
  raise notice 'Could not schedule the retention job (%): schedule it by hand (see SUPABASE.md).', sqlerrm;
end $$;
