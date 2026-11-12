-- For tests/db/run-check.sh only (never on the real project): after
-- supabase/seed/examples.sql, what testers do with the example listings,
-- next to a real company and job, through the API as they would. Then
-- remove_examples.sql runs and tests/db/examples-removed.sql checks that only
-- the example side went.
--
-- Fixed ids (d0000000-...): a student, an admin, the owner of a real company.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('d0000000-0000-4000-8000-000000000001', 'examples.student@studbocconi.it'),
  ('d0000000-0000-4000-8000-000000000002', 'examples.admin@check-examples.example'),
  ('d0000000-0000-4000-8000-000000000003', 'examples.owner@check-examples.example');
insert into public.admins (user_id) values ('d0000000-0000-4000-8000-000000000002');
insert into public.companies (id, owner_id, name, status) values
  ('d0000000-0000-4000-8000-0000000000c1', 'd0000000-0000-4000-8000-000000000003', 'Check real company', 'approved');
insert into public.jobs (id, company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min) values
  ('d0000000-0000-4000-8000-0000000000a1', 'd0000000-0000-4000-8000-0000000000c1', 'Check real job', 'gig', 10, 'published', 1, array['flexible'], 'hour', 10);
insert into public.job_contacts (job_id, apply_email) values ('d0000000-0000-4000-8000-0000000000a1', 'jobs@check-examples.example');

-- The student: saves, follows and reports an example and a real listing,
-- and presses Apply on the real one (an example one is refused).
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
insert into public.saved_jobs (job_id) values ('e0000000-0000-4000-8000-000000000001'), ('d0000000-0000-4000-8000-0000000000a1');
insert into public.company_follows (company_id) values ('e0000000-0000-4000-8000-0000000000c1'), ('d0000000-0000-4000-8000-0000000000c1');
insert into public.job_reports (job_id, reason, details) values
  ('e0000000-0000-4000-8000-000000000001', 'other', 'Testing reports on an example'),
  ('e0000000-0000-4000-8000-000000000002', 'misleading', 'Testing reports on an example'),
  ('e0000000-0000-4000-8000-000000000003', 'other', 'Report on an example job deleted by hand later'),
  ('d0000000-0000-4000-8000-0000000000a1', 'other', 'A real report');
select * from public.reveal_job_contact('d0000000-0000-4000-8000-0000000000a1');
do $$
begin
  perform * from public.reveal_job_contact('e0000000-0000-4000-8000-000000000001');
  raise exception 'reveal_job_contact gave the contact of an example job';
exception when no_data_found then null;  -- P0002: refused, as it should be
end $$;

-- The admin tries /admin on examples (and makes one real decision).
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
select public.admin_review_job('e0000000-0000-4000-8000-000000000004', 'closed', 'Testing unpublish on an example');
select public.admin_set_company_status('e0000000-0000-4000-8000-0000000000c6', 'rejected');
select public.admin_resolve_report(id, 'Testing resolve on an example') from public.job_reports
  where job_id = 'e0000000-0000-4000-8000-000000000001';
select public.admin_set_company_status('d0000000-0000-4000-8000-0000000000c1', 'approved');
reset role;
select set_config('request.jwt.claims', '', false);

-- An example job deleted by hand in the Table Editor: its report stays, with
-- only the title and company name (job_reports_keep_job).
delete from public.jobs where id = 'e0000000-0000-4000-8000-000000000003';
