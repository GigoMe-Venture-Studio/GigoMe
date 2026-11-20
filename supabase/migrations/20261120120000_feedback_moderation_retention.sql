-- Retention for feedback and moderation decisions (Privacy Notice v1.2,
-- section 9; decided by the owner, to whom the legal person delegated it, on
-- 20 November 2026).
--
--   feedback          deleted 12 months after it was sent: feedback_days = 364
--   moderation_log    deleted 24 months after the decision: moderation_log_days = 729
--
-- Like the other periods, each is a day inside the Notice's promise, so the
-- nightly run (gigome-retention, 03:37 UTC) is never late: 364 days is under
-- 12 months even when they hold no 29 February, 729 under 24 months.
-- A moderation decision is deleted on its own: the company, job or report it
-- was about stays. No table points to moderation_log, so deleting its rows
-- can't block or cascade into anything.
--
-- run_retention() as in 20261119130000_any_email_students.sql, with one step
-- added (moderation decisions) and its count in the result. The feedback step
-- was already there, off until now. create or replace keeps the function's
-- grants (none); the cron job is unchanged.

alter table public.retention_settings
  add column moderation_log_days integer check (moderation_log_days >= 30);
-- No grants: retention_settings has none at all.

update public.retention_settings
   set feedback_days = 364,
       moderation_log_days = 729
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
  v_moderation bigint := 0;
  v_ended uuid[];
  v_result jsonb;
begin
  select * into s from public.retention_settings where id = 1;
  if not found then
    return '{}'::jsonb;
  end if;

  -- Unfinished sign-ups: never completed /welcome, and no login for the
  -- period. Based on activity, never on how a student was verified. Finished
  -- means the Terms accepted or a name given (accounts from before the Terms
  -- were asked for have only a name) and, for a self-declared student, "Which
  -- university?" answered. A self-declared student who finished is kept
  -- exactly like a verified one. Not an admin, no company. Deleted like
  -- delete_my_account() (everything of theirs cascades).
  if s.incomplete_signups_days is not null then
    delete from auth.users u
    where greatest(u.created_at, u.last_sign_in_at) < now() - make_interval(days => s.incomplete_signups_days)
      and not exists (select 1 from public.admins a where a.user_id = u.id)
      and not exists (select 1 from public.companies c where c.owner_id = u.id)
      and not exists (
        select 1 from public.profiles p
        where p.id = u.id
          and (p.terms_accepted_at is not null or p.full_name is not null)
          -- is distinct from: company accounts have no verification (null).
          and (p.student_verification is distinct from 'self_declared' or p.student_declared_at is not null)
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

  -- The older periods: ended jobs and inactive accounts stay empty (off);
  -- feedback is on (Privacy Notice v1.2).
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

  -- Moderation decisions older than the period (Privacy Notice section 9).
  if s.moderation_log_days is not null then
    delete from public.moderation_log m where m.created_at < now() - make_interval(days => s.moderation_log_days);
    get diagnostics v_moderation = row_count;
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
    'accounts', v_accounts,
    'moderation_log', v_moderation);
  update public.retention_settings set last_run_at = now(), last_result = v_result where id = 1;
  return v_result;
end;
$$;

revoke all on function public.run_retention() from public, anon, authenticated;
-- No grants: run by pg_cron (or by hand in the SQL Editor).
