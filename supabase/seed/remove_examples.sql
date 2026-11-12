-- REMOVE THE EXAMPLE LISTINGS. NOT a migration: run it by hand, and before
-- the public launch at the latest (HANDOVER.md, launch checklist).
--
-- How to run: Supabase dashboard > SQL Editor > New query > paste this whole
-- file > Run. The result is one table that should say 0 on every row.
--
-- It deletes every example company and job (is_example = true, as loaded by
-- supabase/seed/examples.sql) and everything that points at them:
--   * reports on example jobs (normally a report outlives its job as
--     evidence; for made-up listings there is nothing to keep), and the
--     moderation log's entries about example companies, jobs and those
--     reports (testers trying /admin);
--   * with the jobs: how to apply, apply clicks, students' saves;
--   * with the companies: students' follows.
-- Real companies and jobs are never touched: only rows with is_example =
-- true, and jobs of example companies. No account is deleted (example
-- companies have no owner). Saved searches stay: they're filters, not
-- listings.
--
-- Running it again, or when nothing was loaded, does nothing. Everything
-- runs in one transaction: if any step fails, nothing is deleted.

begin;

create temporary table example_companies on commit drop as
  select id, name from public.companies where is_example;

create temporary table example_jobs on commit drop as
  select id from public.jobs
  where is_example or company_id in (select id from example_companies);

-- Reports: on example jobs, and those whose job was already deleted by hand
-- (the job's title and company name were copied into them then).
create temporary table example_reports on commit drop as
  select id from public.job_reports
  where job_id in (select id from example_jobs)
     or (job_id is null and company_name in (select name from example_companies));

delete from public.moderation_log
where company_id in (select id from example_companies)
   or job_id in (select id from example_jobs)
   or report_id in (select id from example_reports);

delete from public.job_reports where id in (select id from example_reports);

-- Explicit, though the foreign keys would delete them with the jobs and
-- companies anyway.
delete from public.job_clicks where job_id in (select id from example_jobs);
delete from public.saved_jobs where job_id in (select id from example_jobs);
delete from public.job_contacts where job_id in (select id from example_jobs);
delete from public.company_follows where company_id in (select id from example_companies);

delete from public.jobs where id in (select id from example_jobs);
delete from public.companies where id in (select id from example_companies);

commit;

-- ---------------------------------------------------------------------------
-- Check: every row should be 0.
-- ---------------------------------------------------------------------------
select 'Example companies left' as what, count(*) as left_behind from public.companies where is_example
union all select 'Example jobs left', count(*) from public.jobs where is_example
union all select 'Jobs of companies without an owner', count(*) from public.jobs j
  join public.companies c on c.id = j.company_id where c.owner_id is null
union all select 'Reports naming an example company', count(*) from public.job_reports where company_name like 'Example %'
union all select 'Companies without an owner', count(*) from public.companies where owner_id is null;
