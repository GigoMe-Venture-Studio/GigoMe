-- Job reports outlive the job and the company; retention periods in git.
--
--   * Reports are fraud and safety evidence (Privacy Notice section 9:
--     "normally 24 months after resolution"). Until now, deleting a job, or
--     a company with its jobs (the company deleting its account, or a user
--     deleted in the dashboard), deleted every report on those jobs too.
--     Now a report stays, with job_id emptied and only the minimum kept:
--     the job's title and the company's name, copied into the report just
--     before the job or company is deleted (triggers
--     job_reports_keep_job / job_reports_keep_company), next to what the
--     report already holds (reason, details, status, dates). Nothing is
--     copied while the job exists, and the migration changes no existing
--     row.
--   * Retention periods (owner's decision, November 2026), so a nightly
--     run stays within the Privacy Notice's "within N days":
--       incomplete_signups_days  29  (was 30)
--       ended_job_details_days   89  (was 90)
--       click_anonymize_days     179 (was 180)
--       resolved_reports_days    730 (was empty): resolved reports are
--                                    deleted 24 months after resolution.
--   * Supabase's auth audit log (auth.audit_log_entries) is NOT pruned
--     here: that table belongs to Supabase's auth service. See HANDOVER.md
--     section 7d for the manual step.

-- ===========================================================================
-- Reports outlive the job
-- ===========================================================================

alter table public.job_reports
  add column job_title text check (char_length(job_title) <= 120),
  add column company_name text check (char_length(company_name) <= 200);
-- Admins read them through the existing table-wide SELECT grant (policy:
-- admins only). No insert or update grants: only the triggers write them.

alter table public.job_reports alter column job_id drop not null;
alter table public.job_reports
  drop constraint job_reports_job_id_fkey,
  add constraint job_reports_job_id_fkey
    foreign key (job_id) references public.jobs (id) on delete set null;

-- Just before a job is deleted: its title (and its company's name, if the
-- company trigger hasn't already copied it) go into its reports, which stop
-- pointing at it (the foreign key's "set null" is the backstop). SECURITY
-- DEFINER because an owner deleting their own draft has no right to update
-- reports.
create function public.job_reports_keep_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_reports r
     set job_id = null,
         job_title = old.title,
         company_name = coalesce(r.company_name, (select c.name from public.companies c where c.id = old.company_id))
   where r.job_id = old.id;
  return old;
end;
$$;

revoke all on function public.job_reports_keep_job() from public, anon, authenticated;

create trigger job_reports_keep_job
  before delete on public.jobs
  for each row execute function public.job_reports_keep_job();

-- Just before a company is deleted (its jobs go with it): its name goes into
-- the reports on its jobs, while the jobs can still be found.
create function public.job_reports_keep_company()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_reports r
     set company_name = old.name
    from public.jobs j
   where j.id = r.job_id and j.company_id = old.id;
  return old;
end;
$$;

revoke all on function public.job_reports_keep_company() from public, anon, authenticated;

create trigger job_reports_keep_company
  before delete on public.companies
  for each row execute function public.job_reports_keep_company();

-- my_reports(): the reporter's own reports, also those whose job is gone
-- (it used to leave them out).
create or replace function public.my_reports()
returns table (job_id uuid, job_title text, reason text, details text, status text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.job_id, coalesce(j.title, r.job_title), r.reason, r.details, r.status, r.created_at
  from public.job_reports r
  left join public.jobs j on j.id = r.job_id
  where r.reporter_id = (select auth.uid())
  order by r.created_at;
$$;

revoke all on function public.my_reports() from public, anon, authenticated;
grant execute on function public.my_reports() to authenticated;


-- ===========================================================================
-- Retention periods
-- ===========================================================================

update public.retention_settings
   set incomplete_signups_days = 29,
       ended_job_details_days = 89,
       click_anonymize_days = 179,
       resolved_reports_days = 730
 where id = 1;
