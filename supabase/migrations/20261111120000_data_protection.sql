-- Data protection: terms acceptance, account deletion from the dashboard,
-- and the first retention periods (Privacy Notice v1.0, section 9).
--
--   * profiles.terms_version / terms_accepted_at: which version of the Terms
--     the account holder accepted ("I'm 18 or older and I accept the
--     Terms"), and when. Written only by accept_terms(version), which stamps
--     the database's now(). Students and company accounts alike. The current
--     version lives in one place, TERMS_VERSION in src/lib/terms.js: when it
--     changes, everyone is asked again. Existing accounts start empty, so
--     they are asked once on their next visit.
--   * feedback.user_id now cascades: deleting a user in the dashboard
--     (Authentication > Users > Delete) deletes their feedback, as
--     delete_my_account() already did. Feedback left behind by accounts
--     deleted there before (user_id empty) is deleted now.
--   * jobs.ended_at: when a job was closed or rejected (empty otherwise).
--     Set only by the database (trigger job_ended_at); no grants.
--   * Three retention periods, applied daily by run_retention() (pg_cron
--     job 'gigome-retention', 03:37 UTC):
--       incomplete_signups_days  30   accounts that never finished signing
--                                     up (never accepted the Terms, no name,
--                                     no company, not an admin), counted
--                                     from their last login: deleted.
--       ended_job_details_days   90   closed, rejected or expired listings:
--                                     their how-to-apply contact, saves,
--                                     description, pay note, free-text
--                                     location and exact pin are removed.
--                                     Title, company, dates, type, pay and
--                                     area stay (the employer's history, the
--                                     moderation log, the counts). Listings
--                                     with a report are left alone (fraud
--                                     evidence).
--       click_anonymize_days     180  apply-click records lose the student
--                                     (user_id) for good, and their time is
--                                     cut to the day. The rows stay, so the
--                                     per-listing counts employers see stay
--                                     the same.
--     The four older periods (ended_jobs_days, feedback_days,
--     resolved_reports_days, inactive_accounts_days) stay empty: off.

-- ===========================================================================
-- Terms acceptance
-- ===========================================================================

alter table public.profiles
  add column terms_version text check (terms_version ~ '^[0-9]{1,3}\.[0-9]{1,3}$'),
  add column terms_accepted_at timestamptz,
  add constraint profiles_terms_pair check ((terms_version is null) = (terms_accepted_at is null));
-- Readable by the owner (and admins) through the existing table-wide SELECT
-- grant and policies. No update grant: users write only full_name,
-- degree_level and graduation_year.

create function public.accept_terms(p_version text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'Log in to accept the Terms.' using errcode = '42501';
  end if;
  if p_version is null or p_version !~ '^[0-9]{1,3}\.[0-9]{1,3}$' then
    raise exception 'Unknown version of the Terms.' using errcode = '22023';
  end if;
  update public.profiles
     set terms_version = p_version, terms_accepted_at = v_at
   where id = v_uid;
  if not found then
    raise exception 'No profile for this account.' using errcode = 'P0002';
  end if;
  return v_at;
end;
$$;

revoke all on function public.accept_terms(text) from public, anon, authenticated;
grant execute on function public.accept_terms(text) to authenticated;


-- ===========================================================================
-- Deleting a user in the dashboard also deletes their feedback
-- ===========================================================================

alter table public.feedback
  drop constraint feedback_user_id_fkey,
  add constraint feedback_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

-- Feedback can only be sent logged in, so an empty user_id means the account
-- was deleted in the dashboard, where the old rule kept the message.
delete from public.feedback where user_id is null;


-- ===========================================================================
-- When a job ended
-- ===========================================================================

alter table public.jobs add column ended_at timestamptz;
-- No grants: nobody reads or writes it through the API.

create function public.job_ended_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('closed', 'rejected') then
    if tg_op = 'INSERT' or old.status is distinct from new.status or new.ended_at is null then
      new.ended_at := now();
    end if;
  else
    new.ended_at := null;
  end if;
  return new;
end;
$$;

revoke all on function public.job_ended_at() from public, anon, authenticated;

create trigger job_ended_at
  before insert or update of status, ended_at on public.jobs
  for each row execute function public.job_ended_at();

-- Jobs that ended before this migration: their last known change.
update public.jobs
   set ended_at = greatest(created_at, submitted_at, reviewed_at, published_at)
 where status in ('closed', 'rejected');


-- ===========================================================================
-- Retention
-- ===========================================================================

alter table public.retention_settings
  add column incomplete_signups_days integer check (incomplete_signups_days >= 7),
  add column ended_job_details_days  integer check (ended_job_details_days >= 30),
  add column click_anonymize_days    integer check (click_anonymize_days >= 30);

update public.retention_settings
   set incomplete_signups_days = 30,
       ended_job_details_days = 90,
       click_anonymize_days = 180
 where id = 1;

create or replace function public.run_retention()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.retention_settings;
  v_signups bigint := 0;
  v_details bigint := 0;
  v_contacts bigint := 0;
  v_saves bigint := 0;
  v_clicks bigint := 0;
  v_jobs bigint := 0;
  v_feedback bigint := 0;
  v_reports bigint := 0;
  v_accounts bigint := 0;
  v_ended uuid[];
  v_result jsonb;
begin
  select * into s from public.retention_settings where id = 1;
  if not found then
    return '{}'::jsonb;
  end if;

  -- Sign-ups never finished: no Terms accepted, no name, no company, not an
  -- admin, and no login for the period. Deleted like delete_my_account()
  -- (everything of theirs cascades).
  if s.incomplete_signups_days is not null then
    delete from auth.users u
    where greatest(u.created_at, u.last_sign_in_at) < now() - make_interval(days => s.incomplete_signups_days)
      and not exists (select 1 from public.admins a where a.user_id = u.id)
      and not exists (select 1 from public.companies c where c.owner_id = u.id)
      and not exists (
        select 1 from public.profiles p
        where p.id = u.id and (p.terms_accepted_at is not null or p.full_name is not null)
      );
    get diagnostics v_signups = row_count;
  end if;

  -- Listings removed (closed, rejected) or expired for the period, without
  -- any report: their non-essential details go.
  if s.ended_job_details_days is not null then
    select coalesce(array_agg(j.id), '{}') into v_ended
    from public.jobs j
    where coalesce(case when j.status in ('closed', 'rejected') then j.ended_at end,
                   case when j.status = 'published' and j.expires_at < now() then j.expires_at end)
          < now() - make_interval(days => s.ended_job_details_days)
      and not exists (select 1 from public.job_reports r where r.job_id = j.id);

    delete from public.job_contacts c where c.job_id = any (v_ended);
    get diagnostics v_contacts = row_count;
    delete from public.saved_jobs sj where sj.job_id = any (v_ended);
    get diagnostics v_saves = row_count;
    update public.jobs j
       set description = null, pay = null, location = null, show_exact_location = false,
           latitude = null, longitude = null
     where j.id = any (v_ended)
       and (j.description is not null or j.pay is not null or j.location is not null or j.show_exact_location);
    get diagnostics v_details = row_count;
  end if;

  -- Apply clicks older than the period: no student, time cut to the day.
  if s.click_anonymize_days is not null then
    update public.job_clicks k
       set user_id = null, created_at = date_trunc('day', k.created_at)
     where k.created_at < now() - make_interval(days => s.click_anonymize_days)
       and (k.user_id is not null or k.created_at <> date_trunc('day', k.created_at));
    get diagnostics v_clicks = row_count;
  end if;

  -- The older periods, unchanged (all empty, so off).
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
    delete from auth.users u
    where coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => s.inactive_accounts_days)
      and not exists (select 1 from public.admins a where a.user_id = u.id);
    get diagnostics v_accounts = row_count;
  end if;

  v_result := jsonb_build_object(
    'incomplete_signups', v_signups,
    'ended_job_details', v_details,
    'ended_job_contacts', v_contacts,
    'ended_job_saves', v_saves,
    'anonymized_clicks', v_clicks,
    'jobs', v_jobs,
    'feedback', v_feedback,
    'resolved_reports', v_reports,
    'accounts', v_accounts);
  update public.retention_settings set last_run_at = now(), last_result = v_result where id = 1;
  return v_result;
end;
$$;

revoke all on function public.run_retention() from public, anon, authenticated;
-- No grants: run by pg_cron (or by hand in the SQL Editor).

-- The daily job, as in 20261109100300_retention.sql: schedule it again in
-- case it couldn't be set up then (same name, so never twice).
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
