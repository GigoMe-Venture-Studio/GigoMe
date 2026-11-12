-- For tests/db/run-check.sh only: after examples-activity.sql and
-- supabase/seed/remove_examples.sql. One row per check (check | expected |
-- actual | passed), then removes the test rows so nothing is left behind.
\set ON_ERROR_STOP on

create temporary table r (n serial, check_name text, expected text, actual text);
insert into r (check_name, expected, actual) values
  ('Removal: no example company or job is left', '0, 0',
   (select count(*) from public.companies where is_example) || ', ' || (select count(*) from public.jobs where is_example)),
  ('Removal: no company without an owner is left', '0',
   (select count(*) from public.companies where owner_id is null)::text),
  ('Removal: reports on examples are gone (also on one deleted by hand); the real one stays', 'A real report',
   (select string_agg(details, ', ') from public.job_reports)),
  ('Removal: moderation log entries about examples are gone; the real one stays', 'company_approved',
   (select string_agg(action, ', ') from public.moderation_log)),
  ('Removal: the student keeps their real save, follow and apply click', '1 save, 1 follow, 1 click',
   (select count(*) from public.saved_jobs where user_id = 'd0000000-0000-4000-8000-000000000001') || ' save, '
   || (select count(*) from public.company_follows where user_id = 'd0000000-0000-4000-8000-000000000001') || ' follow, '
   || (select count(*) from public.job_clicks where user_id = 'd0000000-0000-4000-8000-000000000001') || ' click'),
  ('Removal: the real company, job and how to apply are untouched', 'Check real company, Check real job, jobs@check-examples.example',
   (select c.name || ', ' || j.title || ', ' || jc.apply_email
    from public.companies c join public.jobs j on j.company_id = c.id join public.job_contacts jc on jc.job_id = j.id
    where c.id = 'd0000000-0000-4000-8000-0000000000c1')),
  ('Removal: no account was deleted', '3',
   (select count(*) from auth.users where id::text like 'd0000000-%')::text);

-- Clean up the test accounts (with their company, job, saves, follows) and what
-- outlives them.
delete from auth.users where id::text like 'd0000000-%';
delete from public.job_reports where details = 'A real report';
delete from public.job_clicks where job_id is null or user_id is null;
delete from public.moderation_log where admin_id is null;

select check_name, expected, coalesce(actual, '(null)'), actual is not distinct from expected
from r order by n;
