-- Daily limits against abuse, per user (or company) over the last 24 hours.
--
--   * feedback: 20 messages per user.
--   * job_reports: 10 reports per user.
--   * saved_jobs + saved_searches + company_follows together: 50 new rows
--     per user.
--   * jobs: a company submits (sends to review) at most 10 different jobs.
--     jobs.submitted_at records the last time each job was submitted; it is
--     set by the database only and isn't readable through the API.
--
-- A refused insert raises errcode 54000 (program_limit_exceeded) with a
-- message the site shows as it is. The counting functions are SECURITY
-- DEFINER because users can't read their own feedback or reports.

create function public.limit_per_day(p_what text, p_count bigint, p_max int)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_count >= p_max then
    raise exception 'Daily limit reached: you can % up to % times a day. Try again tomorrow.', p_what, p_max
      using errcode = '54000';
  end if;
end;
$$;

revoke all on function public.limit_per_day(text, bigint, int) from public, anon, authenticated;

-- Feedback: 20 a day.
create function public.feedback_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    perform public.limit_per_day('send feedback',
      (select count(*) from public.feedback f where f.user_id = new.user_id and f.created_at > now() - interval '1 day'), 20);
  end if;
  return new;
end;
$$;

create trigger feedback_daily_limit
  before insert on public.feedback
  for each row execute function public.feedback_daily_limit();

-- Reports: 10 a day.
create function public.reports_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reporter_id is not null then
    perform public.limit_per_day('report a job',
      (select count(*) from public.job_reports r where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day'), 10);
  end if;
  return new;
end;
$$;

create trigger reports_daily_limit
  before insert on public.job_reports
  for each row execute function public.reports_daily_limit();

-- Saved jobs, saved searches and follows: 50 a day together.
create function public.saves_daily_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.limit_per_day('save jobs or searches and follow companies',
    (select count(*) from public.saved_jobs s where s.user_id = new.user_id and s.created_at > now() - interval '1 day')
    + (select count(*) from public.saved_searches s where s.user_id = new.user_id and s.created_at > now() - interval '1 day')
    + (select count(*) from public.company_follows f where f.user_id = new.user_id and f.created_at > now() - interval '1 day'),
    50);
  return new;
end;
$$;

create trigger saves_daily_limit
  before insert on public.saved_jobs
  for each row execute function public.saves_daily_limit();
create trigger saves_daily_limit
  before insert on public.saved_searches
  for each row execute function public.saves_daily_limit();
create trigger saves_daily_limit
  before insert on public.company_follows
  for each row execute function public.saves_daily_limit();

-- Jobs submitted for review: 10 different jobs a day per company.
alter table public.jobs add column submitted_at timestamptz;
-- No grants: set by the database, not readable through the API.

create function public.job_submission_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
    perform public.limit_per_day('submit jobs for review',
      (select count(*) from public.jobs j
       where j.company_id = new.company_id and j.id <> new.id and j.submitted_at > now() - interval '1 day'), 10);
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

create trigger job_submission_limit
  before insert or update of status on public.jobs
  for each row execute function public.job_submission_limit();

revoke all on function public.feedback_daily_limit(), public.reports_daily_limit(), public.saves_daily_limit(),
  public.job_submission_limit() from public, anon, authenticated;
-- Triggers only, no grants.
