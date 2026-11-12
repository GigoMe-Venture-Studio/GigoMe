-- For tests/db/run-check.sh only (run as "supa", the tables' owner): jobs
-- written before 20261112180000_no_internships.sql that are internships or
-- unpaid (like the example listings loaded on the live project when it was
-- applied). They can still be closed, edited, cleaned up by run_retention()
-- and deleted, but not submitted or published again until both values are
-- changed. One row per check (check | expected | actual | passed), then
-- removes everything it made.
\set ON_ERROR_STOP on

create temporary table r (n serial, check_name text, expected text, actual text);

-- The old rows, written with the new rule switched off (only here, to make
-- rows that exist from before it).
insert into public.companies (id, owner_id, name, contact_email, status, is_example)
  values ('f0000000-0000-4000-8000-0000000000c1', null, 'Example legacy company', 'hello@gigome.org', 'approved', true);
alter table public.jobs disable trigger job_no_internships;
insert into public.jobs (id, company_id, is_example, status, title, description, job_type, remote, area_id, hours_per_week,
                         pay_unit, pay_min, schedule, expires_at)
values
  ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-0000000000c1', true, 'published',
   'Legacy paid internship', 'Old description', 'internship', false, 1, 20, 'month', 800, array['flexible'], now() + interval '30 days'),
  ('f0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-0000000000c1', true, 'published',
   'Legacy unpaid internship', 'Old description', 'internship', false, 1, 20, 'unpaid_curricular', null, array['flexible'], now() + interval '30 days');
alter table public.jobs enable trigger job_no_internships;

create function pg_temp.try(sql text) returns text language plpgsql as $$
begin
  execute sql;
  return 'done';
exception when others then
  return 'error: ' || sqlerrm;
end;
$$;

insert into r (check_name, expected, actual) values
  ('The dashboard (the tables'' owner) cannot add an internship either', 'refused',
   case when pg_temp.try($q$insert into public.jobs (company_id, is_example, status, title, job_type, remote, area_id, hours_per_week, pay_unit, pay_min, schedule)
                             values ('f0000000-0000-4000-8000-0000000000c1', true, 'draft', 'New internship', 'internship', false, 1, 20, 'hour', 10, array['flexible'])$q$) like 'error:%not internships%'
        then 'refused' else 'allowed' end),
  ('Legacy internship: other details can still be changed', 'done',
   pg_temp.try($q$update public.jobs set description = 'New description', hours_per_week = 15 where id = 'f0000000-0000-4000-8000-000000000001'$q$)),
  ('Legacy internship: can be sent back to review only with a new type', 'refused',
   case when pg_temp.try($q$update public.jobs set status = 'pending' where id = 'f0000000-0000-4000-8000-000000000001'$q$) like 'error:%not internships%'
        then 'refused' else 'allowed' end),
  ('Legacy unpaid job: cannot be published again as it is', 'refused',
   case when pg_temp.try($q$update public.jobs set status = 'pending' where id = 'f0000000-0000-4000-8000-000000000002'$q$) like 'error:%'
        then 'refused' else 'allowed' end),
  ('Legacy unpaid job: changing only the type is not enough', 'refused',
   case when pg_temp.try($q$update public.jobs set job_type = 'part_time', status = 'pending' where id = 'f0000000-0000-4000-8000-000000000002'$q$) like 'error:%'
        then 'refused' else 'allowed' end),
  ('Legacy unpaid job: a paid part-time job can be submitted', 'done',
   pg_temp.try($q$update public.jobs set job_type = 'part_time', pay_unit = 'hour', pay_min = 11, status = 'pending' where id = 'f0000000-0000-4000-8000-000000000002'$q$)),
  ('Legacy internship: can be closed', 'done',
   pg_temp.try($q$update public.jobs set status = 'closed' where id = 'f0000000-0000-4000-8000-000000000001'$q$));

-- Ended long ago: the nightly clean-up still works on it.
update public.jobs set ended_at = now() - interval '100 days' where id = 'f0000000-0000-4000-8000-000000000001';
create temporary table ran as select pg_temp.try('select public.run_retention()') as result;
insert into r (check_name, expected, actual) values
  ('Legacy internship: run_retention() still clears an ended one', 'done, no description',
   (select result from ran) || ', '
   || (select coalesce('description: ' || description, 'no description') from public.jobs where id = 'f0000000-0000-4000-8000-000000000001'));
insert into r (check_name, expected, actual) values
  ('Legacy internship: can be deleted', 'done',
   pg_temp.try($q$delete from public.jobs where id = 'f0000000-0000-4000-8000-000000000001'$q$)),
  ('The rule is back on after this test', 'O',
   (select tgenabled::text from pg_trigger where tgname = 'job_no_internships'));

delete from public.companies where id = 'f0000000-0000-4000-8000-0000000000c1';

select check_name, expected, coalesce(actual, '(null)'), actual is not distinct from expected
from r order by n;
