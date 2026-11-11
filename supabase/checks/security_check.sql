-- GigoMe security check
--
-- Paste the whole file into the Supabase SQL Editor and press Run, after the
-- migrations are applied. It returns one row per check:
--   check_name | expected | actual | passed
-- Every row should say passed = true.
--
-- It creates test users, companies and jobs, acts as a logged-out visitor
-- (anon), a company user and a student, and then undoes everything: all test
-- data is created inside a block that is rolled back before the results are
-- shown. Nothing is left behind. It is not a migration and is never applied
-- automatically.

do $check$
declare
  results   jsonb := '[]';
  t         record;
  v_count   int;
  v_rows    int;
  v_text    text;
  v_err     text;
  -- test data
  v_student   uuid := gen_random_uuid();
  v_company   uuid := gen_random_uuid();   -- company user under test
  v_other     uuid := gen_random_uuid();   -- owner of the approved test company
  v_lookalike uuid := gen_random_uuid();
  v_co_own      uuid;  -- v_company's company (pending)
  v_co_approved uuid;  -- v_other's company (approved)
  v_job_live      uuid;
  v_job_draft     uuid;
  v_job_pending   uuid;
  v_job_closed    uuid;
  v_job_expired   uuid;
  v_job_unapproved uuid;  -- published, but its company is pending
  v_job_own_draft uuid;  -- v_company's own draft
  v_bocconi uuid;
  test_jobs uuid[];
  -- universities added later
  v_late        uuid := gen_random_uuid();   -- matches the new university
  v_late_alt    uuid := gen_random_uuid();   -- matches a domain added afterwards
  v_late_owner  uuid := gen_random_uuid();   -- matches, but owns a company
  v_late_sub    uuid := gen_random_uuid();   -- sub.check-uni.example: no exact match
  v_new_uni     uuid;
  -- account deletion
  v_leaver      uuid := gen_random_uuid();   -- student who deletes their account
  v_leaver_co   uuid := gen_random_uuid();   -- company account that deletes itself
  v_leaver_company uuid;
  v_leaver_job  uuid;
  v_clicks      bigint[];
  -- employer side
  v_emp         uuid := gen_random_uuid();   -- owner of an approved company (not an admin)
  v_emp2        uuid := gen_random_uuid();   -- owner of another approved company
  v_co_emp      uuid;
  v_co_emp2     uuid;
  v_emp_draft   uuid;
  v_emp_draft2  uuid;
  v_emp_live    uuid;
  v_emp2_live   uuid;
  v_count_text  text;
  -- areas and job locations
  v_loc_job     uuid;
  -- metro, categories, publication date
  v_st_a        smallint;
  v_st_b        smallint;
  v_pub         timestamptz;
  -- moderation and reports
  v_report      uuid;
  -- schedule, languages, saved searches, follows, opened jobs
  v_sched_job   uuid;
  v_pay_job     uuid;
  -- launch audit
  v_live_a      uuid;
  v_live_b      uuid;
  v_old_user    uuid := gen_random_uuid();
  v_old_admin   uuid := gen_random_uuid();
  v_ts          timestamptz;
  v_json        jsonb;
  v_exp_recent  uuid;
  v_exp_old     uuid;
  v_unapproved_job uuid;
  v_ss          uuid;
  v_n           int;
  -- on-site jobs need an area
  v_area_job    uuid;
  v_remote_job  uuid;
  v_log_before  bigint;
  -- data protection: Terms, access claims, dashboard deletion, retention
  v_dp_student  uuid := gen_random_uuid();   -- a student whose data others must not see
  v_dp_gone     uuid := gen_random_uuid();   -- student deleted in the dashboard
  v_dp_gone_owner uuid := gen_random_uuid(); -- company account deleted in the dashboard
  v_dp_gone_admin uuid := gen_random_uuid(); -- admin deleted in the dashboard
  v_dp_gone_company uuid;
  v_dp_gone_job uuid;
  v_dp_click    bigint;
  v_su          uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
                                gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_rt_closed   uuid;
  v_rt_expired  uuid;
  v_rt_reported uuid;
  v_rt_recent   uuid;
  v_rt_draft    uuid;
  v_rt_click_old bigint;
  v_rt_click_new bigint;
  v_rt_click_orphan bigint;
  v_kr_job      uuid;   -- a reported job its owner deletes
begin
  begin  -- sandbox: everything in here is rolled back at the end

    -- Helper: append one result row.
    create function pg_temp.res(acc jsonb, name text, expected text, actual text, passed boolean)
    returns jsonb language sql as $f$
      select acc || jsonb_build_array(jsonb_build_object(
        'n', jsonb_array_length(acc) + 1, 'check_name', name,
        'expected', expected, 'actual', coalesce(actual, '(null)'), 'passed', coalesce(passed, false)))
    $f$;

    -- ----------------------------------------------------------------------
    -- Structure
    -- ----------------------------------------------------------------------
    for t in
      select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public' and c.relkind in ('r', 'p')
      order by c.relname
    loop
      results := pg_temp.res(results, 'RLS is on: public.' || t.relname, 'on',
                             case when t.relrowsecurity then 'on' else 'off' end, t.relrowsecurity);
    end loop;

    foreach v_text in array array['admins', 'job_contacts'] loop
      select string_agg(x, ', ') into v_err from (
        select r || ':' || p from unnest(array['anon', 'authenticated']) r,
               unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
        where has_table_privilege(r, 'public.' || v_text, p)
        union all
        select r || ':column ' || p from unnest(array['anon', 'authenticated']) r,
               unnest(array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) p
        where has_any_column_privilege(r, 'public.' || v_text, p) and not has_table_privilege(r, 'public.' || v_text, p)
      ) s(x);
      results := pg_temp.res(results, 'No API privileges at all on public.' || v_text, 'none',
                             coalesce(v_err, 'none'), v_err is null);
    end loop;

    select string_agg(x, ', ') into v_err from (
      select r || ':' || p from unnest(array['anon', 'authenticated']) r,
             unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
      where has_table_privilege(r, 'public.universities', p)
      union all
      select r || ':column ' || p from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE']) p
      where has_any_column_privilege(r, 'public.universities', p)
    ) s(x);
    results := pg_temp.res(results, 'anon and authenticated can only read public.universities', 'SELECT only',
                           coalesce('also: ' || v_err, 'SELECT only'), v_err is null);

    select string_agg(p.proname, ', ') into v_err
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
    results := pg_temp.res(results, 'Every SECURITY DEFINER function has a fixed search_path', 'all',
                           coalesce('missing: ' || v_err, 'all'), v_err is null);

    select string_agg(p.proname, ', ') into v_err
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE');
    results := pg_temp.res(results, 'anon cannot execute any SECURITY DEFINER function', 'none',
                           coalesce(v_err, 'none'), v_err is null);

    -- The project's "Enable automatic RLS" setting must still work: a table
    -- created now gets RLS without asking. The table is dropped right away.
    begin
      create table public.gigome_security_check_auto_rls (id int);
      select case when c.relrowsecurity then 'on' else 'off' end into v_text
      from pg_class c where c.oid = 'public.gigome_security_check_auto_rls'::regclass;
      drop table public.gigome_security_check_auto_rls;
    exception when others then v_text := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Automatic RLS: a new table in public gets RLS turned on', 'on', v_text, v_text = 'on');

    -- ----------------------------------------------------------------------
    -- Test data (as the SQL Editor's own role, which bypasses RLS)
    -- ----------------------------------------------------------------------
    insert into auth.users (id, email) values
      (v_student,   'Check.Student@StudBocconi.IT'),
      (v_company,   'owner@check-company.example'),
      (v_other,     'owner@check-approved.example'),
      (v_lookalike, 'someone@notstudbocconi.it');

    select id into v_bocconi from public.universities where 'studbocconi.it' = any (email_domains) limit 1;

    select account_type || ', ' || coalesce((select name from public.universities where id = university_id), 'no university')
      into v_text from public.profiles where id = v_student;
    results := pg_temp.res(results, 'Sign-up with an @studbocconi.it email (any case) creates a Bocconi student',
                           'student, Bocconi University', v_text, v_text = 'student, Bocconi University');

    select account_type || ', ' || coalesce(university_id::text, 'no university') into v_text from public.profiles where id = v_company;
    results := pg_temp.res(results, 'Sign-up with another email domain creates a company account',
                           'company, no university', v_text, v_text = 'company, no university');

    select account_type into v_text from public.profiles where id = v_lookalike;
    results := pg_temp.res(results, 'A look-alike domain (notstudbocconi.it) is not a student', 'company', v_text, v_text = 'company');

    insert into public.companies (owner_id, name, status) values (v_company, 'Check Co (pending)', 'pending') returning id into v_co_own;
    insert into public.companies (owner_id, name, status) values (v_other, 'Check Co (approved)', 'approved') returning id into v_co_approved;

    -- A university added after its students signed up
    insert into auth.users (id, email) values
      (v_late,       'Late.Student@Check-Uni.example'),
      (v_late_alt,   'second@check-alt.example'),
      (v_late_owner, 'owner@check-uni.example'),
      (v_late_sub,   'someone@sub.check-uni.example');
    insert into public.companies (owner_id, name) values (v_late_owner, 'Check Co (owned by a check-uni address)');

    select string_agg(account_type, ',' order by account_type) into v_text
    from public.profiles where id in (v_late, v_late_alt, v_late_owner, v_late_sub);
    results := pg_temp.res(results, 'Before the university exists, its students get company accounts',
                           'company,company,company,company', v_text, v_text = 'company,company,company,company');

    insert into public.universities (name, email_domains) values ('Check University', array['check-uni.example'])
      returning id into v_new_uni;
    select account_type || ', ' || coalesce((select name from public.universities where id = university_id), 'no university')
      into v_text from public.profiles where id = v_late;
    results := pg_temp.res(results, 'Adding a university upgrades a matching company account to student',
                           'student, Check University', v_text, v_text = 'student, Check University');

    select account_type into v_text from public.profiles where id = v_late_owner;
    results := pg_temp.res(results, 'Adding a university does not upgrade an account that owns a company', 'company', v_text, v_text = 'company');

    select account_type into v_text from public.profiles where id = v_late_sub;
    results := pg_temp.res(results, 'Adding a university does not upgrade a sub-domain (sub.check-uni.example)', 'company', v_text, v_text = 'company');

    select account_type into v_text from public.profiles where id = v_late_alt;
    results := pg_temp.res(results, 'Adding a university does not upgrade other domains', 'company', v_text, v_text = 'company');

    update public.universities set email_domains = array_append(email_domains, 'Check-Alt.example') where id = v_new_uni;
    select account_type || ', ' || coalesce((select name from public.universities where id = university_id), 'no university')
      into v_text from public.profiles where id = v_late_alt;
    results := pg_temp.res(results, 'Adding a domain to a university upgrades matching company accounts',
                           'student, Check University', v_text, v_text = 'student, Check University');

    update public.universities set email_domains = '{}' where id = v_new_uni;
    select string_agg(account_type, ',' order by account_type) into v_text from public.profiles where id in (v_late, v_late_alt);
    results := pg_temp.res(results, 'Removing domains never downgrades a student', 'student,student', v_text, v_text = 'student,student');

    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_co_approved, 'Check live job', 'gig', 10, 'published', 1, array['flexible'], 'hour', 10) returning id into v_job_live;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_co_approved, 'Check draft job', 'gig', 10, 'draft', 1, array['flexible'], 'hour', 10) returning id into v_job_draft;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_co_approved, 'Check pending job', 'gig', 10, 'pending', 1, array['flexible'], 'hour', 10) returning id into v_job_pending;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_co_approved, 'Check closed job', 'gig', 10, 'closed', 1, array['flexible'], 'hour', 10) returning id into v_job_closed;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, expires_at, area_id, schedule, pay_unit, pay_min)
      values (v_co_approved, 'Check expired job', 'gig', 10, 'published', now() - interval '1 day', 1, array['flexible'], 'hour', 10) returning id into v_job_expired;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_co_own, 'Check job of a pending company', 'gig', 10, 'published', 1, array['flexible'], 'hour', 10) returning id into v_job_unapproved;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_co_own, 'Check own draft', 'part_time', 10, 'draft', 1, array['flexible'], 'hour', 10) returning id into v_job_own_draft;
    test_jobs := array[v_job_live, v_job_draft, v_job_pending, v_job_closed, v_job_expired, v_job_unapproved, v_job_own_draft];

    insert into public.job_contacts (job_id, apply_url, apply_email) values
      (v_job_live, 'https://check.example/apply', 'jobs@check.example'),
      (v_job_draft, 'https://check.example/draft', null);
    insert into public.job_clicks (job_id, user_id) values (v_job_live, v_other);
    insert into public.feedback (user_id, page, message) values (v_other, '/check', 'check feedback');
    insert into public.admins (user_id) values (v_other);

    -- ----------------------------------------------------------------------
    -- Logged-out visitor (anon)
    -- ----------------------------------------------------------------------
    foreach v_text in array array['job_contacts', 'admins', 'feedback', 'job_clicks', 'profiles', 'job_reports', 'moderation_log', 'saved_jobs'] loop
      begin
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        perform set_config('role', 'anon', true);
        execute format('select count(*) from public.%I', v_text) into v_count;
        perform set_config('role', 'none', true);
        v_err := v_count || ' rows visible';
      exception when others then
        v_err := 'error: ' || sqlerrm; v_count := 0;
      end;
      results := pg_temp.res(results, 'anon cannot read ' || v_text, '0 rows or permission denied', v_err, v_count = 0);
    end loop;

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select count(*) into v_count from public.jobs where id in (v_job_draft, v_job_pending, v_job_closed);
      perform set_config('role', 'none', true);
      v_err := v_count || ' visible';
    exception when others then v_err := 'error: ' || sqlerrm; v_count := -1;
    end;
    results := pg_temp.res(results, 'anon cannot read draft, pending or closed jobs', '0 visible', v_err, v_count = 0);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select count(*) into v_count from public.jobs where id = v_job_expired;
      perform set_config('role', 'none', true);
      v_err := v_count || ' visible';
    exception when others then v_err := 'error: ' || sqlerrm; v_count := -1;
    end;
    results := pg_temp.res(results, 'anon cannot read an expired published job', '0 visible', v_err, v_count = 0);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select count(*) into v_count from public.jobs where id = v_job_unapproved;
      perform set_config('role', 'none', true);
      v_err := v_count || ' visible';
    exception when others then v_err := 'error: ' || sqlerrm; v_count := -1;
    end;
    results := pg_temp.res(results, 'anon cannot read a published job of a pending company', '0 visible', v_err, v_count = 0);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select count(*) into v_count from public.jobs where id = v_job_live;
      perform set_config('role', 'none', true);
      v_err := v_count || ' visible';
    exception when others then v_err := 'error: ' || sqlerrm; v_count := -1;
    end;
    results := pg_temp.res(results, 'anon can read a published job of an approved company', '1 visible', v_err, v_count = 1);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select count(*) into v_count from public.companies where id = v_co_approved;
      perform set_config('role', 'none', true);
      v_err := v_count || ' visible';
    exception when others then v_err := 'error: ' || sqlerrm; v_count := -1;
    end;
    results := pg_temp.res(results, 'anon can read an approved company', '1 visible', v_err, v_count = 1);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select count(*) into v_count from public.companies where id = v_co_own;
      perform set_config('role', 'none', true);
      v_err := v_count || ' visible';
    exception when others then v_err := 'error: ' || sqlerrm; v_count := -1;
    end;
    results := pg_temp.res(results, 'anon cannot read a pending company', '0 visible', v_err, v_count = 0);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select count(*) into v_count from public.universities where id = v_bocconi;
      perform set_config('role', 'none', true);
      v_err := v_count || ' visible';
    exception when others then v_err := 'error: ' || sqlerrm; v_count := -1;
    end;
    results := pg_temp.res(results, 'anon can read universities (Bocconi)', '1 visible', v_err, v_count = 1);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      delete from public.universities where id = v_bocconi;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'deleted ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select count(*) into v_count from public.universities where id = v_bocconi;
    results := pg_temp.res(results, 'anon cannot delete a university', 'error, Bocconi still there',
                           v_err || case when v_count = 1 then ', Bocconi still there' else ', Bocconi gone' end,
                           v_err like 'error:%' and v_count = 1);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      perform * from public.reveal_job_contact(v_job_live);
      perform set_config('role', 'none', true);
      v_err := 'returned the contact';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon cannot call reveal_job_contact', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      insert into public.feedback (page, message) values ('/check', 'anon feedback');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon cannot send feedback', 'error', v_err, v_err like 'error:%');

    -- ----------------------------------------------------------------------
    -- Logged-in company user (owner of a pending company)
    -- ----------------------------------------------------------------------
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.profiles set account_type = 'student' where id = v_company;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select account_type into v_text from public.profiles where id = v_company;
    results := pg_temp.res(results, 'Company user cannot change their own account_type', 'error, still company',
                           v_err || ', now ' || v_text, v_err like 'error:%' and v_text = 'company');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.profiles set university_id = v_bocconi where id = v_company;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select coalesce(university_id::text, 'none') into v_text from public.profiles where id = v_company;
    results := pg_temp.res(results, 'Company user cannot set their own university_id', 'error, still none',
                           v_err || ', now ' || v_text, v_err like 'error:%' and v_text = 'none');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.profiles set full_name = 'Check Owner' where id = v_company;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Company user can edit their own full_name (control)', 'updated 1 row(s)', v_err, v_err = 'updated 1 row(s)');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set status = 'published' where id = v_job_own_draft;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_job_own_draft;
    results := pg_temp.res(results, 'Company user cannot publish their own job', 'error, still draft',
                           v_err || ', now ' || v_text, v_err like 'error:%' and v_text = 'draft');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        values (v_co_own, 'Check sneaky job', 'gig', 5, 'published', 1, array['flexible'], 'hour', 10);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Company user cannot create a job as published', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set status = 'pending' where id = v_job_own_draft;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_job_own_draft;
    results := pg_temp.res(results, 'Company user cannot submit a job while their company is pending', 'error, still draft',
                           v_err || ', now ' || v_text, v_err like 'error:%' and v_text = 'draft');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set title = 'Hijacked' where id = v_job_draft;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Company user cannot edit another company''s job', 'updated 0 row(s) or error',
                           v_err, v_err = 'updated 0 row(s)' or v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.companies set status = 'approved' where id = v_co_own;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.companies where id = v_co_own;
    results := pg_temp.res(results, 'Company user cannot approve their own company', 'error, still pending',
                           v_err || ', now ' || v_text, v_err like 'error:%' and v_text = 'pending');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_set_company_status(v_co_own, 'approved');
      perform set_config('role', 'none', true);
      v_err := 'status changed';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.companies where id = v_co_own;
    results := pg_temp.res(results, 'Company user cannot approve their company through admin_set_company_status', 'error, still pending',
                           v_err || ', now ' || v_text, v_err like 'error:%' and v_text = 'pending');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_lookalike, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.universities (name, email_domains) values ('Check Fake University', array['notstudbocconi.it']);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select account_type into v_text from public.profiles where id = v_lookalike;
    results := pg_temp.res(results, 'Signed-in user cannot add a university (and so cannot make themselves a student)', 'error, still company',
                           v_err || ', now ' || v_text, v_err like 'error:%' and v_text = 'company');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.universities set email_domains = array_append(email_domains, 'check-company.example') where id = v_bocconi;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select array_to_string(email_domains, ',') into v_text from public.universities where id = v_bocconi;
    results := pg_temp.res(results, 'Signed-in user cannot change a university''s email domains', 'error, unchanged',
                           v_err || ', domains: ' || v_text, v_err like 'error:%' and v_text not like '%check-company.example%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform * from public.reveal_job_contact(v_job_live);
      perform set_config('role', 'none', true);
      v_err := 'returned the contact';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Company user cannot call reveal_job_contact', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.profiles where id <> v_company;
      perform set_config('role', 'none', true);
      v_err := v_count || ' other profiles visible';
    exception when others then v_err := 'error: ' || sqlerrm; v_count := 0;
    end;
    results := pg_temp.res(results, 'Company user cannot read other users'' profiles', '0 other profiles visible', v_err, v_count = 0);

    -- ----------------------------------------------------------------------
    -- Logged-in student
    -- ----------------------------------------------------------------------
    select count(*) into v_rows from public.job_clicks where job_id = v_job_live;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select apply_url into v_text from public.reveal_job_contact(v_job_live);
      perform set_config('role', 'none', true);
      v_err := coalesce(v_text, 'no contact returned');
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Student can call reveal_job_contact on a live job', 'https://check.example/apply', v_err, v_err = 'https://check.example/apply');

    select count(*) into v_count from public.job_clicks where job_id = v_job_live and user_id = v_student;
    results := pg_temp.res(results, 'reveal_job_contact records the student''s click', '1 click', v_count || ' click(s)', v_count = 1);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform * from public.reveal_job_contact(v_job_draft);
      perform set_config('role', 'none', true);
      v_err := 'returned the contact';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Student cannot reveal the contact of a draft job', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.job_contacts;
      perform set_config('role', 'none', true);
      v_err := v_count || ' rows visible';
    exception when others then v_err := 'error: ' || sqlerrm; v_count := 0;
    end;
    results := pg_temp.res(results, 'Student cannot read job_contacts directly', '0 rows or permission denied', v_err, v_count = 0);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.job_clicks where user_id is distinct from v_student;
      perform set_config('role', 'none', true);
      v_err := v_count || ' rows of others visible';
    exception when others then v_err := 'error: ' || sqlerrm; v_count := 0;
    end;
    results := pg_temp.res(results, 'Student cannot read other people''s job_clicks (only their own)', '0 rows of others visible', v_err, v_count = 0);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.job_clicks (job_id, user_id) values (v_job_live, v_student);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Student cannot write job_clicks directly', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.companies (name, terms_accepted_at) values ('Check student company', now());
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Student cannot create a company', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.feedback (page, message) values ('/check', 'student feedback');
      select count(*) into v_count from public.feedback;
      perform set_config('role', 'none', true);
      v_err := 'sent, ' || v_count || ' feedback rows readable';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Student can send feedback but not read it', 'sent, 0 feedback rows readable', v_err, v_err = 'sent, 0 feedback rows readable');

    -- ----------------------------------------------------------------------
    -- Employer side: job review, owner rules, apply-click numbers
    -- ----------------------------------------------------------------------
    select string_agg(x, ', ') into v_err from (
      select r || ':' || c from unnest(array['anon', 'authenticated']) r, unnest(array['reviewed_by']) c
      where has_column_privilege(r, 'public.jobs', c, 'SELECT')
      union all
      select 'anon:' || c from unnest(array['review_note', 'reviewed_at']) c
      where has_column_privilege('anon', 'public.jobs', c, 'SELECT')
    ) s(x);
    results := pg_temp.res(results, 'Review fields: nobody reads reviewed_by through the API, anon reads no review field', 'none',
                           coalesce(v_err, 'none'), v_err is null);

    select string_agg(x, ', ') into v_err from (
      select r || ':' || p || ' ' || c from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE']) p,
             unnest(array['review_note', 'reviewed_by', 'reviewed_at', 'status']) c
      where has_column_privilege(r, 'public.jobs', c, p) and not (r = 'authenticated' and c = 'status')
    ) s(x);
    results := pg_temp.res(results, 'Review fields: only admin_review_job writes them (no insert or update grants)', 'none',
                           coalesce(v_err, 'none'), v_err is null);

    select string_agg(x, ', ') into v_err from (
      select r || ':contact_email' from unnest(array['anon', 'authenticated']) r
      where has_column_privilege(r, 'public.companies', 'contact_email', 'SELECT')
      union all
      select 'anon:owner_id' where has_column_privilege('anon', 'public.companies', 'owner_id', 'SELECT')
    ) s(x);
    results := pg_temp.res(results, 'Nobody reads companies.contact_email directly; anon doesn''t read owner_id either', 'none', coalesce(v_err, 'none'), v_err is null);

    select string_agg(f || ' ' || coalesce(nullif(g, ''), 'nobody'), '; ' order by f) into v_text from (
      select f, (select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ',' order by 1)
                 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                 where p.oid = f::regprocedure and a.privilege_type = 'EXECUTE'
                   and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))) g
      from unnest(array['public.admin_review_job(uuid,text,text)', 'public.my_job_stats()', 'public.get_company_contact_email(uuid)']) f
    ) s;
    results := pg_temp.res(results, 'admin_review_job, my_job_stats, get_company_contact_email: only authenticated can execute them',
                           'public.admin_review_job(uuid,text,text) authenticated; public.get_company_contact_email(uuid) authenticated; public.my_job_stats() authenticated', v_text,
                           v_text = 'public.admin_review_job(uuid,text,text) authenticated; public.get_company_contact_email(uuid) authenticated; public.my_job_stats() authenticated');

    -- Two owners of approved companies, neither an admin.
    insert into auth.users (id, email) values (v_emp, 'owner@check-emp.example'), (v_emp2, 'owner@check-emp2.example');
    insert into public.companies (owner_id, name, status) values (v_emp, 'Check Emp', 'approved') returning id into v_co_emp;
    insert into public.companies (owner_id, name, status) values (v_emp2, 'Check Emp Two', 'approved') returning id into v_co_emp2;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_co_emp, 'Check emp live', 'gig', 10, 'published', 1, array['flexible'], 'hour', 10) returning id into v_emp_live;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_co_emp2, 'Check emp2 live', 'gig', 10, 'published', 1, array['flexible'], 'hour', 10) returning id into v_emp2_live;
    insert into public.job_clicks (job_id, user_id) values (v_emp_live, v_student), (v_emp_live, v_student), (v_emp2_live, v_student);

    update public.companies set contact_email = 'hiring@check-emp.example' where id = v_co_emp;
    v_text := '';
    foreach v_err in array array['owner', 'admin', 'other company', 'student'] loop
      begin
        perform set_config('request.jwt.claims', jsonb_build_object('sub',
          case v_err when 'owner' then v_emp when 'admin' then v_other when 'other company' then v_emp2 else v_student end,
          'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        v_text := v_text || v_err || ': ' || coalesce(public.get_company_contact_email(v_co_emp), 'nothing') || '; ';
        perform set_config('role', 'none', true);
      exception when others then v_text := v_text || v_err || ': error; ';
      end;
    end loop;
    results := pg_temp.res(results, 'get_company_contact_email: the owner and admins get it, other users get nothing',
                           'owner: hiring@check-emp.example; admin: hiring@check-emp.example; other company: nothing; student: nothing; ',
                           v_text, v_text = 'owner: hiring@check-emp.example; admin: hiring@check-emp.example; other company: nothing; student: nothing; ');

    foreach v_text in array array['name', 'website'] loop
      begin
        perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        if v_text = 'name' then
          update public.companies set name = 'Check Emp Renamed' where id = v_co_emp;
        else
          update public.companies set website = 'https://elsewhere.example' where id = v_co_emp;
        end if;
        get diagnostics v_rows = row_count;
        perform set_config('role', 'none', true);
        v_err := 'updated ' || v_rows || ' row(s)';
      exception when others then v_err := 'error: ' || sqlerrm;
      end;
      select name || ', ' || coalesce(website, 'no website') into v_count_text from public.companies where id = v_co_emp;
      results := pg_temp.res(results, 'Owner of an approved company cannot change its ' || v_text, 'error, unchanged',
                             case when v_err like 'error:%' then 'error' else v_err end || ', ' ||
                             case when v_count_text = 'Check Emp, no website' then 'unchanged' else 'now ' || v_count_text end,
                             v_err like 'error:%' and v_count_text = 'Check Emp, no website');
    end loop;

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.companies set description = 'Check description', contact_email = 'jobs@check-emp.example' where id = v_co_emp;
      get diagnostics v_rows = row_count;
      update public.companies set name = 'Check Emp', website = null, description = 'Check description 2' where id = v_co_emp;
      get diagnostics v_count = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ', unchanged name and website sent: updated ' || v_count;
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Owner of an approved company can still edit its description and contact email (control)',
                           'updated 1, unchanged name and website sent: updated 1', v_err, v_err = 'updated 1, unchanged name and website sent: updated 1');
    update public.companies set contact_email = 'hiring@check-emp.example' where id = v_co_emp;

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.companies set name = 'Check Co (pending, renamed)', website = 'https://check.example' where id = v_co_own;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Owner of a pending company can still change its name and website (control)', 'updated 1 row(s)', v_err, v_err = 'updated 1 row(s)');

    begin
      update public.companies set name = 'Check Emp (renamed by the team)' where id = v_co_emp;
      select name into v_err from public.companies where id = v_co_emp;
      update public.companies set name = 'Check Emp' where id = v_co_emp;
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'The dashboard (SQL Editor) can still rename an approved company', 'Check Emp (renamed by the team)',
                           v_err, v_err = 'Check Emp (renamed by the team)');

    -- Terms of use: accepted on creation, stamped by the database, never changed through the API.
    select string_agg(r || ':' || p, ', ') into v_err
    from unnest(array['anon', 'authenticated']) r, unnest(array['UPDATE']) p
    where has_column_privilege(r, 'public.companies', 'terms_accepted_at', p)
       or (r = 'anon' and has_column_privilege(r, 'public.companies', 'terms_accepted_at', 'INSERT'));
    results := pg_temp.res(results, 'terms_accepted_at: nobody updates it through the API (logged-in users only set it on creation)',
                           'none', coalesce(v_err, 'none'), v_err is null);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_lookalike, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.companies (name, contact_email) values ('Check Co (no terms)', 'x@check.example');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A company account cannot create its company without accepting the terms', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_lookalike, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.companies (name, contact_email, terms_accepted_at)
        values ('Check Co (terms)', 'x@check.example', '2000-01-01T00:00:00Z');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || case when terms_accepted_at = now() then 'stamped now' else coalesce(terms_accepted_at::text, 'empty') end
      into v_text from public.companies where owner_id = v_lookalike;
    results := pg_temp.res(results, 'Accepting the terms on creation stores the database''s time, not the one sent',
                           'inserted, stamped now', coalesce(v_text, v_err), v_text = 'inserted, stamped now');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_lookalike, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.companies set terms_accepted_at = null where owner_id = v_lookalike;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select case when terms_accepted_at = now() then 'unchanged' else 'changed' end into v_text from public.companies where owner_id = v_lookalike;
    results := pg_temp.res(results, 'The owner cannot change when the terms were accepted', 'error, unchanged',
                           case when v_err like 'error:%' then 'error' else v_err end || ', ' || coalesce(v_text, 'no company'),
                           v_err like 'error:%' and v_text = 'unchanged');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select contact_email into v_text from public.companies where id = v_co_emp;
      perform set_config('role', 'none', true);
      v_err := 'read ' || coalesce(v_text, '(null)');
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A student cannot read an approved company''s contact email directly', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        values (v_co_own, 'Check draft of a pending company', 'gig', 5, 'draft', 1, array['flexible'], 'hour', 10);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Company user with a pending company can still prepare a draft (control)', 'inserted', v_err, v_err = 'inserted');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        values (v_co_own, 'Check submitted by a pending company', 'gig', 5, 'pending', 1, array['flexible'], 'hour', 10);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Company user with a pending company cannot create a job as submitted', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check emp draft', 'part_time', 12, 'draft', 1, array['flexible'], 'hour', 10) returning id into v_emp_draft;
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check emp draft 2', 'gig', 6, 'pending', 1, array['flexible'], 'hour', 10) returning id into v_emp_draft2;
      update public.jobs set status = 'pending' where id = v_emp_draft;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Owner of an approved company can submit a draft for review (control)', 'updated 1 row(s)', v_err, v_err = 'updated 1 row(s)');

    foreach v_text in array array['changes_requested', 'rejected', 'published'] loop
      begin
        perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.jobs set status = v_text where id = v_emp_draft;
        get diagnostics v_rows = row_count;
        perform set_config('role', 'none', true);
        v_err := 'updated ' || v_rows || ' row(s)';
      exception when others then v_err := 'error: ' || sqlerrm;
      end;
      results := pg_temp.res(results, 'Owner cannot set their own job to ' || v_text, 'error', v_err, v_err like 'error:%');
    end loop;

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set review_note = 'looks great', reviewed_at = now() where id = v_emp_draft;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Owner cannot write the review note or date', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_review_job(v_emp_draft, 'published', null);
      perform set_config('role', 'none', true);
      v_err := 'reviewed';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_emp_draft;
    results := pg_temp.res(results, 'A non-admin cannot call admin_review_job (not even on their own job)', 'error, still pending',
                           v_err || ', now ' || v_text, v_err like 'error:%' and v_text = 'pending');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_review_job(v_emp_draft, 'changes_requested', '   ');
      perform set_config('role', 'none', true);
      v_err := 'reviewed';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Admin cannot request changes without a note', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_review_job(v_emp_draft, 'changes_requested', 'Please state the pay.');
      perform set_config('role', 'none', true);
      v_err := 'reviewed';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || status || ', note ' || coalesce(review_note, '(none)') || ', by '
           || case when reviewed_by = v_other then 'the admin' else coalesce(reviewed_by::text, 'nobody') end
           || ', ' || case when reviewed_at is not null then 'dated' else 'no date' end
      into v_text from public.jobs where id = v_emp_draft;
    results := pg_temp.res(results, 'Admin requests changes with a note: status, note, reviewer and date recorded',
                           'reviewed, changes_requested, note Please state the pay., by the admin, dated', v_text,
                           v_text = 'reviewed, changes_requested, note Please state the pay., by the admin, dated');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select review_note into v_text from public.jobs where id = v_emp_draft;
      perform set_config('role', 'none', true);
      v_err := coalesce(v_text, '(no note)');
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Owner sees the reviewer''s note on their own job', 'Please state the pay.', v_err, v_err = 'Please state the pay.');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp2, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.jobs where id = v_emp_draft;
      perform set_config('role', 'none', true);
      v_err := v_count || ' visible';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Another company cannot see a job (or its note) that isn''t live', '0 visible', v_err, v_err = '0 visible');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set pay = '€12/h', status = 'pending' where id = v_emp_draft;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_emp_draft;
    results := pg_temp.res(results, 'Owner can edit a job with changes requested and resubmit it', 'updated 1 row(s), now pending',
                           v_err || ', now ' || v_text, v_err = 'updated 1 row(s)' and v_text = 'pending');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_review_job(v_emp_draft, 'rejected', 'Asks students for a deposit.');
      perform set_config('role', 'none', true);
    exception when others then null;
    end;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set title = 'Check emp resubmitted', status = 'pending' where id = v_emp_draft;
      get diagnostics v_rows = row_count;
      delete from public.jobs where id = v_emp_draft;
      get diagnostics v_count = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ', deleted ' || v_count;
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_emp_draft;
    results := pg_temp.res(results, 'Owner cannot edit, resubmit or delete a rejected job', 'updated 0, deleted 0, still rejected',
                           v_err || ', still ' || coalesce(v_text, '(gone)'), v_err in ('updated 0, deleted 0') and v_text = 'rejected');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set pay = '€14/h' where id = v_emp_live;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status || ', ' || coalesce(pay, 'no pay') into v_text from public.jobs where id = v_emp_live;
    results := pg_temp.res(results, 'Owner cannot edit a published job and keep it published', 'error, still published, no pay',
                           v_err || ', still ' || v_text, v_err like 'error:%' and v_text = 'published, no pay');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select coalesce(sum(apply_clicks), -1) || ' clicks on ' || count(*) || ' job(s), '
             || count(*) filter (where job_id not in (select id from public.jobs j where j.company_id = v_co_emp)) || ' not theirs'
        into v_text from public.my_job_stats() where job_id = v_emp_live or job_id = v_emp2_live;
      perform set_config('role', 'none', true);
      v_err := v_text;
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'my_job_stats: an owner gets their own job''s apply clicks', '2 clicks on 1 job(s), 0 not theirs', v_err,
                           v_err = '2 clicks on 1 job(s), 0 not theirs');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp2, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.my_job_stats() where job_id in (v_emp_live, v_emp_draft, v_job_live);
      select count(*) into v_rows from public.my_job_stats();
      perform set_config('role', 'none', true);
      v_err := v_count || ' rows of other companies, ' || v_rows || ' row(s) in total';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'my_job_stats: another company sees none of these numbers, only its own job', '0 rows of other companies, 1 row(s) in total',
                           v_err, v_err = '0 rows of other companies, 1 row(s) in total');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.my_job_stats();
      perform set_config('role', 'none', true);
      v_err := v_count || ' rows';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'my_job_stats: a student gets no numbers', '0 rows', v_err, v_err = '0 rows');

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select count(*) into v_count from public.my_job_stats();
      perform set_config('role', 'none', true);
      v_err := v_count || ' rows';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'my_job_stats: anon cannot call it', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select j.title || ' by ' || c.name || coalesce(', ' || c.website, '') into v_text
      from public.jobs j join public.companies c on c.id = j.company_id
      where j.id = v_job_live and j.status = 'published' and c.status = 'approved';
      perform set_config('role', 'none', true);
      v_err := coalesce(v_text, 'nothing');
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon can still read a live job with its company (what the job board needs)', 'Check live job by Check Co (approved)',
                           v_err, v_err = 'Check live job by Check Co (approved)');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_review_job(v_emp_live, 'changes_requested', 'Old note');
      perform public.admin_review_job(v_emp_live, 'published', null);
      perform set_config('role', 'none', true);
    exception when others then null;
    end;
    select status || ', note ' || coalesce(review_note, '(none)') into v_text from public.jobs where id = v_emp_live;
    results := pg_temp.res(results, 'Publishing clears an earlier review note', 'published, note (none)', v_text, v_text = 'published, note (none)');

    -- ----------------------------------------------------------------------
    -- Moderation: job reports, admin decisions and the moderation log
    -- ----------------------------------------------------------------------
    select string_agg(x, ', ') into v_err from (
      select r || ':' || p from unnest(array['anon', 'authenticated']) r,
             unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
      where has_table_privilege(r, 'public.moderation_log', p)
      union all
      select r || ':column ' || p from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE']) p
      where has_any_column_privilege(r, 'public.moderation_log', p)
    ) s(x);
    results := pg_temp.res(results, 'Nobody writes moderation_log through the API (only the admin functions do)', 'none',
                           coalesce(v_err, 'none'), v_err is null);

    select string_agg(x, ', ') into v_err from (
      select r || ':' || p from unnest(array['anon', 'authenticated']) r, unnest(array['UPDATE', 'DELETE', 'TRUNCATE']) p
      where has_table_privilege(r, 'public.job_reports', p) or (p = 'UPDATE' and has_any_column_privilege(r, 'public.job_reports', p))
      union all
      select 'anon:INSERT' where has_any_column_privilege('anon', 'public.job_reports', 'INSERT')
      union all
      select 'authenticated:INSERT ' || c from unnest(array['reporter_id', 'status', 'resolution_note', 'resolved_by', 'resolved_at', 'created_at', 'job_title', 'company_name']) c
      where has_column_privilege('authenticated', 'public.job_reports', c, 'INSERT')
    ) s(x);
    results := pg_temp.res(results, 'job_reports: logged-in users insert only job, reason and details; nobody updates or deletes',
                           'none', coalesce(v_err, 'none'), v_err is null);

    select string_agg(f || ' ' || coalesce(nullif(g, ''), 'nobody'), '; ' order by f) into v_text from (
      select f, (select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ',' order by 1)
                 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                 where p.oid = f::regprocedure and a.privilege_type = 'EXECUTE'
                   and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))) g
      from unnest(array['public.admin_resolve_report(uuid,text)', 'public.admin_job_contact(uuid)', 'public.admin_company_contact(uuid)']) f
    ) s;
    results := pg_temp.res(results, 'admin_resolve_report, admin_job_contact, admin_company_contact: only authenticated can execute them',
                           'public.admin_company_contact(uuid) authenticated; public.admin_job_contact(uuid) authenticated; public.admin_resolve_report(uuid,text) authenticated',
                           v_text, v_text = 'public.admin_company_contact(uuid) authenticated; public.admin_job_contact(uuid) authenticated; public.admin_resolve_report(uuid,text) authenticated');

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      insert into public.job_reports (job_id, reason) values (v_job_live, 'scam');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon cannot report a job', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.job_reports (job_id, reason, details) values (v_job_live, 'scam', 'They asked me for a €50 registration fee.');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select id into v_report from public.job_reports where job_id = v_job_live and reporter_id = v_student and status = 'open';
    results := pg_temp.res(results, 'Student can report a live job (control), recorded as theirs and open', 'inserted, theirs',
                           v_err || case when v_report is not null then ', theirs' else ', not found' end, v_err = 'inserted' and v_report is not null);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.job_reports (job_id, reason) values (v_job_live, 'other');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A user cannot open a second report on the same job while one is open', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.job_reports (job_id, reason, status) values (v_emp2_live, 'other', 'resolved');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A user cannot file a report as already resolved', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.job_reports (job_id, reason) values (v_job_draft, 'other');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A user cannot report a job they can''t see (a draft)', 'error', v_err, v_err like 'error:%');

    foreach v_err in array array['student', 'company'] loop
      begin
        perform set_config('request.jwt.claims', jsonb_build_object('sub', case v_err when 'student' then v_student else v_emp end, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        select count(*) into v_count from public.job_reports;
        select count(*) into v_rows from public.moderation_log;
        perform set_config('role', 'none', true);
        v_text := v_count || ' reports, ' || v_rows || ' log rows visible';
      exception when others then v_text := 'error: ' || sqlerrm;
      end;
      results := pg_temp.res(results, 'A ' || v_err || ' cannot read reports (not even their own) or the moderation log',
                             '0 reports, 0 log rows visible', v_text, v_text = '0 reports, 0 log rows visible' or v_text like 'error:%');
    end loop;

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_resolve_report(v_report, 'Not a problem');
      perform set_config('role', 'none', true);
      v_err := 'resolved';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.job_reports where id = v_report;
    results := pg_temp.res(results, 'A non-admin cannot resolve a report', 'error, still open', v_err || ', still ' || v_text,
                           v_err like 'error:%' and v_text = 'open');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.job_reports where id = v_report;
      perform public.admin_resolve_report(v_report, '  ');
      perform set_config('role', 'none', true);
      v_err := 'resolved';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Admin reads reports, but cannot resolve one without a note', 'reads 1, error',
                           'reads ' || v_count || ', ' || case when v_err like 'error:%' then 'error' else v_err end,
                           v_count = 1 and v_err like 'error:%');

    select coalesce(max(id), 0) into v_log_before from public.moderation_log;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_review_job(v_job_live, 'closed', 'Unpublished after a report: asks for a fee.');
      perform public.admin_resolve_report(v_report, 'Job unpublished; asked for a fee.');
      perform set_config('role', 'none', true);
      v_err := 'done';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', job ' || (select status from public.jobs where id = v_job_live)
           || ', report ' || r.status || ', by ' || case when r.resolved_by = v_other then 'the admin' else coalesce(r.resolved_by::text, 'nobody') end
           || ', ' || case when r.resolved_at is not null then 'dated' else 'no date' end
      into v_text from public.job_reports r where r.id = v_report;
    results := pg_temp.res(results, 'Admin unpublishes the job and resolves the report: who and when recorded',
                           'done, job closed, report resolved, by the admin, dated', v_text,
                           v_text = 'done, job closed, report resolved, by the admin, dated');

    select string_agg(action || ' by ' || case when admin_id = v_other then 'the admin' else coalesce(admin_id::text, 'nobody') end
                      || case when created_at is not null then ' (dated)' else '' end, ', ' order by id) into v_text
    from public.moderation_log where id > v_log_before;
    results := pg_temp.res(results, 'Both decisions are in the moderation log with who and when',
                           'job_closed by the admin (dated), report_resolved by the admin (dated)', v_text,
                           v_text = 'job_closed by the admin (dated), report_resolved by the admin (dated)');

    select coalesce(max(id), 0), count(*) into v_log_before, v_rows from public.moderation_log;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_set_company_status(v_co_own, 'approved');
      perform public.admin_set_company_status(v_co_own, 'rejected');
      select count(*) into v_count from public.moderation_log;
      perform set_config('role', 'none', true);
      v_err := 'done, admin reads ' || v_count || ' log rows';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || '; ' || string_agg(action, ', ' order by id) into v_text from public.moderation_log where id > v_log_before;
    results := pg_temp.res(results, 'Company decisions are logged too, and admins can read the log',
                           'done, admin reads ' || (v_rows + 2) || ' log rows; company_approved, company_rejected', v_text,
                           v_text = 'done, admin reads ' || (v_rows + 2) || ' log rows; company_approved, company_rejected');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.job_reports (job_id, reason) values (v_emp_live, 'misleading');
      insert into public.job_reports (job_id, reason) values (v_job_closed, 'other');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A user can report another live job, but not a closed one', 'error',
                           v_err, v_err like 'error:%' and exists (select 1 from public.job_reports where job_id = v_emp_live and reporter_id = v_student) is false);

    insert into public.job_contacts (job_id, apply_url, apply_email) values (v_emp_live, 'https://check-emp.example/jobs', null)
      on conflict (job_id) do nothing;
    v_text := '';
    foreach v_err in array array['admin', 'owner', 'student'] loop
      begin
        perform set_config('request.jwt.claims', jsonb_build_object('sub',
          case v_err when 'admin' then v_other when 'owner' then v_emp else v_student end, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        v_text := v_text || v_err || ': ' || coalesce((select apply_url from public.admin_job_contact(v_emp_live)), 'nothing') || '; ';
        perform set_config('role', 'none', true);
      exception when others then v_text := v_text || v_err || ': error; ';
      end;
    end loop;
    results := pg_temp.res(results, 'admin_job_contact: admins only (not even the job''s owner)',
                           'admin: https://check-emp.example/jobs; owner: error; student: error; ', v_text,
                           v_text = 'admin: https://check-emp.example/jobs; owner: error; student: error; ');

    v_text := '';
    foreach v_err in array array['admin', 'owner', 'student'] loop
      begin
        perform set_config('request.jwt.claims', jsonb_build_object('sub',
          case v_err when 'admin' then v_other when 'owner' then v_emp else v_student end, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        v_text := v_text || v_err || ': ' || coalesce((select login_email from public.admin_company_contact(v_co_emp)), 'nothing') || '; ';
        perform set_config('role', 'none', true);
      exception when others then v_text := v_text || v_err || ': error; ';
      end;
    end loop;
    results := pg_temp.res(results, 'admin_company_contact (with the owner''s login email): admins only',
                           'admin: owner@check-emp.example; owner: error; student: error; ', v_text,
                           v_text = 'admin: owner@check-emp.example; owner: error; student: error; ');

    -- ----------------------------------------------------------------------
    -- Areas and job locations
    -- ----------------------------------------------------------------------
    select string_agg(x, ', ') into v_err from (
      select r || ':' || p from unnest(array['anon', 'authenticated']) r,
             unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
      where has_table_privilege(r, 'public.areas', p)
      union all
      select r || ':column ' || p from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE']) p
      where has_any_column_privilege(r, 'public.areas', p)
    ) s(x);
    results := pg_temp.res(results, 'anon and authenticated can only read public.areas', 'SELECT only',
                           coalesce('also: ' || v_err, 'SELECT only'), v_err is null);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select count(*) || ' areas, Elsewhere ' || coalesce(max(case when name = 'Elsewhere in Milan' then
               case when latitude is null then 'without a centre' else 'with a centre' end end), 'missing')
        into v_text from public.areas;
      perform set_config('role', 'none', true);
      v_err := v_text;
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon can read the areas (seeded, "Elsewhere in Milan" has no centre)', '16 areas, Elsewhere without a centre',
                           v_err, v_err like '16 areas, Elsewhere without a centre');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.areas set latitude = 45.0 where id = 1;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'updated ' || v_rows || ' row(s)';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Nobody changes an area through the API (not even an admin)', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, latitude, longitude, show_exact_location, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check private home job', 'other', 4, 'draft', 2, 45.47321, 9.18911, false, array['flexible'], 'hour', 10)
        returning id into v_loc_job;
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', stored ' || coalesce(j.latitude::text || ',' || j.longitude::text, 'nothing')
           || case when j.latitude = a.latitude and j.longitude = a.longitude then ' (the area''s centre)' else ' (not the centre)' end
      into v_text from public.jobs j join public.areas a on a.id = 2 where j.id = v_loc_job;
    results := pg_temp.res(results, '"Only show the area": the exact point sent is replaced by the area''s centre',
                           'inserted, stored 45.472,9.1868 (the area''s centre)', coalesce(v_text, v_err),
                           v_text = 'inserted, stored 45.472,9.1868 (the area''s centre)');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set area_id = 16, latitude = 45.5011, longitude = 9.1022 where id = v_loc_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', stored ' || coalesce(latitude::text || ',' || longitude::text, 'nothing') into v_text from public.jobs where id = v_loc_job;
    results := pg_temp.res(results, '"Only show the area" with "Elsewhere in Milan": no point is stored at all',
                           'updated, stored nothing', v_text, v_text = 'updated, stored nothing');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set area_id = 3, latitude = 45.47612, longitude = 9.20734, show_exact_location = true where id = v_loc_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', stored ' || coalesce(latitude::text || ',' || longitude::text, 'nothing') into v_text from public.jobs where id = v_loc_job;
    results := pg_temp.res(results, 'An exact location is stored as sent (control)', 'updated, stored 45.47612,9.20734', v_text,
                           v_text = 'updated, stored 45.47612,9.20734');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set show_exact_location = false where id = v_loc_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', stored ' || coalesce(latitude::text || ',' || longitude::text, 'nothing') into v_text from public.jobs where id = v_loc_job;
    results := pg_temp.res(results, 'Switching a job to "only show the area" also replaces the point already stored',
                           'updated, stored 45.4745,9.205', v_text, v_text = 'updated, stored 45.4745,9.205');

    foreach v_text in array array['Rome', 'half a pair'] loop
      begin
        perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        if v_text = 'Rome' then
          update public.jobs set show_exact_location = true, latitude = 41.9028, longitude = 12.4964 where id = v_loc_job;
        else
          update public.jobs set show_exact_location = true, latitude = 45.47, longitude = null where id = v_loc_job;
        end if;
        perform set_config('role', 'none', true);
        v_err := 'updated';
      exception when others then v_err := 'error: ' || sqlerrm;
      end;
      results := pg_temp.res(results, 'Coordinates are refused: ' || case when v_text = 'Rome' then 'outside the Milan metro area' else 'latitude without longitude' end,
                             'error', v_err, v_err like 'error:%');
    end loop;

    update public.jobs set area_id = 3, latitude = 45.47612, longitude = 9.20734, show_exact_location = true where id = v_emp_live;
    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select a.name || ' ' || j.latitude || ',' || j.longitude || ' exact ' || j.show_exact_location into v_text
      from public.jobs j join public.areas a on a.id = j.area_id where j.id = v_emp_live;
      perform set_config('role', 'none', true);
      v_err := coalesce(v_text, 'nothing');
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon can read a live job''s area and location (the map needs them)', 'Porta Venezia 45.47612,9.20734 exact true',
                           v_err, v_err = 'Porta Venezia 45.47612,9.20734 exact true');

    -- ----------------------------------------------------------------------
    -- Metro stations, categories, publication date
    -- ----------------------------------------------------------------------
    select string_agg(x, ', ') into v_err from (
      select r || ':' || p from unnest(array['anon', 'authenticated']) r,
             unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p
      where has_table_privilege(r, 'public.metro_stations', p)
      union all
      select r || ':column ' || p from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE']) p
      where has_any_column_privilege(r, 'public.metro_stations', p)
    ) s(x);
    results := pg_temp.res(results, 'anon and authenticated can only read public.metro_stations', 'SELECT only',
                           coalesce('also: ' || v_err, 'SELECT only'), v_err is null);

    select string_agg(x, ', ') into v_err from (
      select r || ':' || p || ' ' || c from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE']) p,
             unnest(array['nearest_station_id', 'nearest_station_m', 'published_at']) c
      where has_column_privilege(r, 'public.jobs', c, p)
    ) s(x);
    results := pg_temp.res(results, 'Only the database sets a job''s nearest station and publication date (no write grants)', 'none',
                           coalesce(v_err, 'none'), v_err is null);

    -- Two test stations: one about 300 m from the test point, one further away.
    -- The test point (45.30, 8.80) is inside the allowed box but far from every
    -- real station, so the real stations never come nearer than the test ones.
    insert into public.metro_stations (name, lines, latitude, longitude)
      values ('Check Station Near', array['M1'], 45.30 + 0.0027, 8.80) returning id into v_st_a;
    insert into public.metro_stations (name, lines, latitude, longitude)
      values ('Check Station Far', array['M2', 'M3'], 45.30 - 0.0100, 8.80) returning id into v_st_b;

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set area_id = 16, latitude = 45.30, longitude = 8.80, show_exact_location = true, category = 'hospitality'
        where id = v_loc_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || coalesce((select name from public.metro_stations where id = nearest_station_id), 'no station')
           || ' ' || case when nearest_station_m between 290 and 310 then 'about 300 m' else coalesce(nearest_station_m::text, '?') || ' m' end
      into v_text from public.jobs where id = v_loc_job;
    results := pg_temp.res(results, 'An exact location gets its nearest station and the distance', 'updated, Check Station Near about 300 m',
                           v_text, v_text = 'updated, Check Station Near about 300 m');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set show_exact_location = false where id = v_loc_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || coalesce(nearest_station_id::text, 'no station') || ', ' || coalesce(nearest_station_m::text, 'no distance')
      into v_text from public.jobs where id = v_loc_job;
    results := pg_temp.res(results, 'A job that shows only its area gets no station', 'updated, no station, no distance', v_text,
                           v_text = 'updated, no station, no distance');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set nearest_station_id = v_st_b, nearest_station_m = 5 where id = v_loc_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'An owner cannot set the nearest station themselves', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set category = 'gambling' where id = v_loc_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A job category outside the list is refused', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_review_job(v_emp_draft2, 'published', null);
      perform set_config('role', 'none', true);
      v_err := 'published';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select published_at into v_pub from public.jobs where id = v_emp_draft2;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set pay = '€15/h', status = 'pending' where id = v_emp_draft2;
      perform set_config('role', 'none', true);
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_review_job(v_emp_draft2, 'published', null);
      perform set_config('role', 'none', true);
    exception when others then v_err := v_err || ' then error: ' || sqlerrm;
    end;
    select v_err || ', ' || case when v_pub is null then 'no date' when published_at = v_pub then 'first date kept after republishing' else 'date changed' end
      into v_text from public.jobs where id = v_emp_draft2;
    results := pg_temp.res(results, 'Publishing sets published_at once; republishing after an edit keeps the first date',
                           'published, first date kept after republishing', v_text, v_text = 'published, first date kept after republishing');

    update public.jobs set nearest_station_id = v_st_a, nearest_station_m = 300, category = 'tutoring_education' where id = v_emp_live;
    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select j.category || ', ' || s.name || ' (' || array_to_string(s.lines, ' ') || ') ' || j.nearest_station_m || ' m, '
             || case when j.published_at is not null then 'published date' else 'no date' end
        into v_text
      from public.jobs j join public.metro_stations s on s.id = j.nearest_station_id where j.id = v_emp_live;
      perform set_config('role', 'none', true);
      v_err := coalesce(v_text, 'nothing');
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon can read a live job''s category, station and publication date',
                           'tutoring_education, Check Station Near (M1) 300 m, published date', v_err,
                           v_err = 'tutoring_education, Check Station Near (M1) 300 m, published date');

    -- ----------------------------------------------------------------------
    -- Saved jobs
    -- ----------------------------------------------------------------------
    select string_agg(x, ', ') into v_err from (
      select 'anon:' || p from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
      where has_table_privilege('anon', 'public.saved_jobs', p) or (p in ('SELECT', 'INSERT', 'UPDATE') and has_any_column_privilege('anon', 'public.saved_jobs', p))
      union all
      select 'authenticated:' || p from unnest(array['UPDATE', 'TRUNCATE']) p
      where has_table_privilege('authenticated', 'public.saved_jobs', p) or (p = 'UPDATE' and has_any_column_privilege('authenticated', 'public.saved_jobs', p))
      union all
      select 'authenticated:INSERT ' || c from unnest(array['user_id', 'created_at']) c
      where has_column_privilege('authenticated', 'public.saved_jobs', c, 'INSERT')
    ) s(x);
    results := pg_temp.res(results, 'saved_jobs: nothing for anon; logged-in users insert only job_id, never update',
                           'none', coalesce(v_err, 'none'), v_err is null);

    select coalesce(nullif(g, ''), 'nobody') into v_text from (
      select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ',' order by 1) g
      from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = 'public.my_saved_jobs()'::regprocedure and a.privilege_type = 'EXECUTE'
        and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))
    ) s;
    results := pg_temp.res(results, 'my_saved_jobs: only authenticated can execute it', 'authenticated', v_text, v_text = 'authenticated');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.saved_jobs (job_id) values (v_emp2_live);
      perform set_config('role', 'none', true);
      v_err := 'saved';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || case when exists (select 1 from public.saved_jobs where user_id = v_student and job_id = v_emp2_live) then ', as theirs' else ', not found' end
      into v_text;
    results := pg_temp.res(results, 'A student can save a live job, recorded as theirs (control)', 'saved, as theirs', v_text, v_text = 'saved, as theirs');

    foreach v_text in array array['twice', 'a draft', 'for someone else', 'as a company'] loop
      begin
        perform set_config('request.jwt.claims', jsonb_build_object('sub', case when v_text = 'as a company' then v_emp else v_student end,
                           'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        if v_text = 'twice' then insert into public.saved_jobs (job_id) values (v_emp2_live);
        elsif v_text = 'a draft' then insert into public.saved_jobs (job_id) values (v_job_draft);
        elsif v_text = 'for someone else' then insert into public.saved_jobs (user_id, job_id) values (v_leaver_co, v_job_live);
        else insert into public.saved_jobs (job_id) values (v_emp2_live);
        end if;
        perform set_config('role', 'none', true);
        v_err := 'saved';
      exception when others then v_err := 'error: ' || sqlerrm;
      end;
      results := pg_temp.res(results, 'Saving is refused: ' || v_text, 'error', v_err, v_err like 'error:%');
    end loop;

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_late, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.saved_jobs;
      delete from public.saved_jobs where user_id = v_student;
      get diagnostics v_rows = row_count;
      select count(*) into v_count_text from public.my_saved_jobs();
      perform set_config('role', 'none', true);
      v_err := v_count || ' visible, ' || v_rows || ' deleted, ' || v_count_text || ' from my_saved_jobs';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Another student can''t see, delete or list someone''s saved jobs', '0 visible, 0 deleted, 0 from my_saved_jobs',
                           v_err, v_err = '0 visible, 0 deleted, 0 from my_saved_jobs');

    update public.jobs set status = 'closed' where id = v_emp2_live;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select string_agg(title || ' (' || case when live then 'live' else 'no longer available' end || ')', ', ') into v_text
      from public.my_saved_jobs();
      perform set_config('role', 'none', true);
      v_err := coalesce(v_text, 'nothing');
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'my_saved_jobs shows a saved job that closed as no longer available', 'Check emp2 live (no longer available)',
                           v_err, v_err = 'Check emp2 live (no longer available)');
    update public.jobs set status = 'published' where id = v_emp2_live;

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      delete from public.saved_jobs where job_id = v_emp2_live;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'removed ' || v_rows;
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A student can remove their own saved job (control)', 'removed 1', v_err, v_err = 'removed 1');

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      perform * from public.my_saved_jobs();
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon cannot call my_saved_jobs', 'error', v_err, v_err like 'error:%');

    -- ----------------------------------------------------------------------
    -- On-site jobs need an area (job_area_required)
    -- ----------------------------------------------------------------------

    select string_agg(trg.tgname, ',') || '; ' ||
           case when exists (
             select 1 from unnest(array['public', 'anon', 'authenticated']) r
             where has_function_privilege(r, 'public.job_area_required()', 'EXECUTE')) then 'callable' else 'not callable' end
      into v_text
      from pg_trigger trg where trg.tgrelid = 'public.jobs'::regclass and trg.tgname = 'job_area_required' and not trg.tgisinternal;
    results := pg_temp.res(results, 'The area rule is a trigger on jobs, and nobody can call its function', 'job_area_required; not callable',
                           v_text, v_text = 'job_area_required; not callable');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, remote, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check on-site, submitted without an area', 'gig', 5, 'pending', false, array['flexible'], 'hour', 10);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'An owner cannot submit an on-site job without an area', 'error', v_err, v_err like 'error:%area%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, remote, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check on-site draft without an area', 'gig', 5, 'draft', false, array['flexible'], 'hour', 10) returning id into v_area_job;
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'An on-site draft can be saved without an area (control)', 'inserted', v_err, v_err = 'inserted');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set status = 'pending' where id = v_area_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_area_job;
    results := pg_temp.res(results, 'That draft cannot be submitted until it has an area', 'error, still draft',
                           v_err || ', still ' || v_text, v_err like 'error:%area%' and v_text = 'draft');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_review_job(v_area_job, 'published', null);
      perform set_config('role', 'none', true);
      v_err := 'published';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_area_job;
    results := pg_temp.res(results, 'An admin cannot publish an on-site job without an area either', 'error, still draft',
                           v_err || ', still ' || v_text, v_err like 'error:%area%' and v_text = 'draft');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set area_id = 5, status = 'pending' where id = v_area_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_area_job;
    results := pg_temp.res(results, 'With an area it can be submitted (the pin stays optional)', 'updated, now pending',
                           v_err || ', now ' || v_text, v_err = 'updated' and v_text = 'pending');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set area_id = null where id = v_area_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select coalesce(area_id::text, 'none') into v_text from public.jobs where id = v_area_job;
    results := pg_temp.res(results, 'A submitted on-site job cannot lose its area', 'error, area 5',
                           v_err || ', area ' || v_text, v_err like 'error:%' and v_text = '5');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, remote, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check remote job without an area', 'other', 5, 'pending', true, array['flexible'], 'hour', 10) returning id into v_remote_job;
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A remote job can be submitted without an area (control)', 'inserted', v_err, v_err = 'inserted');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set remote = false where id = v_remote_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select case when remote then 'remote' else 'on-site' end into v_text from public.jobs where id = v_remote_job;
    results := pg_temp.res(results, 'A submitted remote job without an area cannot become on-site', 'error, still remote',
                           v_err || ', still ' || v_text, v_err like 'error:%' and v_text = 'remote');

    -- ----------------------------------------------------------------------
    -- Schedule and languages on jobs
    -- ----------------------------------------------------------------------

    select string_agg(r || ' ' || p || ' ' || c, '; ' order by r, c, p) into v_text from (
      select r, p, c from unnest(array['anon', 'authenticated']) r, unnest(array['SELECT', 'INSERT', 'UPDATE']) p, unnest(array['schedule', 'languages']) c
      where has_column_privilege(r, 'public.jobs', c, p)
    ) x;
    results := pg_temp.res(results, 'Schedule and languages: everyone reads them, only logged-in users (owners, by policy) write them', 'anon SELECT languages; anon SELECT schedule; authenticated INSERT languages; authenticated SELECT languages; authenticated UPDATE languages; authenticated INSERT schedule; authenticated SELECT schedule; authenticated UPDATE schedule', coalesce(v_text, 'none'), v_text = 'anon SELECT languages; anon SELECT schedule; authenticated INSERT languages; authenticated SELECT languages; authenticated UPDATE languages; authenticated INSERT schedule; authenticated SELECT schedule; authenticated UPDATE schedule');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check bad schedule', 'gig', 5, 'draft', 1, array['brunch'], 'hour', 10);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A schedule value outside the list is refused', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, languages, pay_unit, pay_min)
        values (v_co_emp, 'Check bad language', 'gig', 5, 'draft', 1, array['klingon'], 'hour', 10);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A language outside the list is refused', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, pay_unit, pay_min)
        values (v_co_emp, 'Check submitted without a schedule', 'gig', 5, 'pending', 1, 'hour', 10);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'An owner cannot submit a job without a schedule', 'error', v_err, v_err like 'error:%when the job happens%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, languages, pay_unit, pay_min)
        values (v_co_emp, 'Check draft without a schedule', 'gig', 5, 'draft', 1, array['it', 'en', 'it'], 'hour', 10) returning id into v_sched_job;
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', languages ' || coalesce(array_to_string(languages, ','), '?') into v_text from public.jobs where id = v_sched_job;
    results := pg_temp.res(results, 'A draft can be saved without a schedule; languages are stored sorted, without repeats', 'inserted, languages en,it', coalesce(v_text, v_err), v_text = 'inserted, languages en,it');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set status = 'pending' where id = v_sched_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_sched_job;
    results := pg_temp.res(results, 'That draft cannot be submitted until it has a schedule', 'error, still draft', v_err || ', still ' || v_text, v_err like 'error:%' and v_text = 'draft');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_review_job(v_sched_job, 'published', null);
      perform set_config('role', 'none', true);
      v_err := 'published';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_sched_job;
    results := pg_temp.res(results, 'An admin cannot publish a job without a schedule either', 'error, still draft', v_err || ', still ' || v_text, v_err like 'error:%' and v_text = 'draft');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set schedule = array['weekends', 'flexible', 'weekends'], status = 'pending' where id = v_sched_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || status || ', ' || array_to_string(schedule, ',') into v_text from public.jobs where id = v_sched_job;
    results := pg_temp.res(results, 'With a schedule it can be submitted; stored sorted, without repeats', 'updated, pending, flexible,weekends', coalesce(v_text, v_err), v_text = 'updated, pending, flexible,weekends');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set schedule = '{}' where id = v_sched_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select array_to_string(schedule, ',') into v_text from public.jobs where id = v_sched_job;
    results := pg_temp.res(results, 'A submitted job cannot lose its schedule', 'error, flexible,weekends', v_err || ', ' || v_text, v_err like 'error:%' and v_text = 'flexible,weekends');

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select array_to_string(schedule, ',') into v_text from public.jobs where id = v_emp2_live;
      perform set_config('role', 'none', true);
      v_err := 'read';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon can read a live job''s schedule', 'read, flexible', v_err || ', ' || coalesce(v_text, 'nothing'), v_err = 'read' and v_text = 'flexible');

    -- ----------------------------------------------------------------------
    -- Structured pay
    -- ----------------------------------------------------------------------

    select string_agg(r || ' ' || p || ' ' || c, '; ' order by r, c, p) into v_text from (
      select r, p, c from unnest(array['anon', 'authenticated']) r, unnest(array['SELECT', 'INSERT', 'UPDATE']) p,
        unnest(array['pay_unit', 'pay_min', 'pay_max', 'pay_hourly']) c
      where has_column_privilege(r, 'public.jobs', c, p)
    ) x;
    results := pg_temp.res(results, 'Structured pay: everyone reads it; owners write unit and amounts, nobody writes pay_hourly', 'anon SELECT pay_hourly; anon SELECT pay_max; anon SELECT pay_min; anon SELECT pay_unit; authenticated SELECT pay_hourly; authenticated INSERT pay_max; authenticated SELECT pay_max; authenticated UPDATE pay_max; authenticated INSERT pay_min; authenticated SELECT pay_min; authenticated UPDATE pay_min; authenticated INSERT pay_unit; authenticated SELECT pay_unit; authenticated UPDATE pay_unit', coalesce(v_text, 'none'), v_text = 'anon SELECT pay_hourly; anon SELECT pay_max; anon SELECT pay_min; anon SELECT pay_unit; authenticated SELECT pay_hourly; authenticated INSERT pay_max; authenticated SELECT pay_max; authenticated UPDATE pay_max; authenticated INSERT pay_min; authenticated SELECT pay_min; authenticated UPDATE pay_min; authenticated INSERT pay_unit; authenticated SELECT pay_unit; authenticated UPDATE pay_unit');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule)
        values (v_co_emp, 'Check submitted without pay', 'gig', 12, 'pending', 1, array['flexible']);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'An owner cannot submit a job without structured pay', 'error', v_err, v_err like 'error:%Set the pay%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule)
        values (v_co_emp, 'Check draft without pay', 'gig', 12, 'draft', 1, array['flexible']) returning id into v_pay_job;
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A draft can be saved without pay (control)', 'inserted', v_err, v_err = 'inserted');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set status = 'pending' where id = v_pay_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_pay_job;
    results := pg_temp.res(results, 'That draft cannot be submitted until it has pay', 'error, still draft', v_err || ', still ' || v_text, v_err like 'error:%' and v_text = 'draft');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.admin_review_job(v_pay_job, 'published', null);
      perform set_config('role', 'none', true);
      v_err := 'published';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status into v_text from public.jobs where id = v_pay_job;
    results := pg_temp.res(results, 'An admin cannot publish a job without pay either', 'error, still draft', v_err || ', still ' || v_text, v_err like 'error:%' and v_text = 'draft');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min, pay_max)
        values (v_co_emp, 'Check max below min', 'gig', 12, 'draft', 1, array['flexible'], 'hour', 13, 11);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'The maximum can''t be below the minimum', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check zero pay', 'gig', 12, 'draft', 1, array['flexible'], 'hour', 0);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Pay must be above €0', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit)
        values (v_co_emp, 'Check unit without amount', 'gig', 12, 'draft', 1, array['flexible'], 'hour');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A paid unit needs an amount', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_min)
        values (v_co_emp, 'Check amount without unit', 'gig', 12, 'draft', 1, array['flexible'], 12);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'An amount needs a unit', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check odd unit', 'gig', 12, 'draft', 1, array['flexible'], 'week', 100);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Only per hour, month, project, or a curricular internship', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit)
        values (v_co_emp, 'Check unpaid gig', 'gig', 12, 'draft', 1, array['flexible'], 'unpaid_curricular');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Unpaid is refused for anything but an internship', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check unpaid with an amount', 'internship', 12, 'draft', 1, array['flexible'], 'unpaid_curricular', 5);
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A curricular internship has no amount', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit)
        values (v_co_emp, 'Check curricular internship', 'internship', 12, 'pending', 1, array['flexible'], 'unpaid_curricular');
      perform set_config('role', 'none', true);
      v_err := 'inserted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select coalesce(pay_hourly::text, 'none') into v_text from public.jobs where title = 'Check curricular internship';
    results := pg_temp.res(results, 'A curricular internship (unpaid) can be submitted, with no hourly equivalent', 'inserted, none', v_err || ', ' || coalesce(v_text, '?'), v_err = 'inserted' and v_text = 'none');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set pay_unit = 'hour', pay_min = 12, pay_max = 14, status = 'pending' where id = v_pay_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || status || ', ' || coalesce(pay_hourly::text, 'none') into v_text from public.jobs where id = v_pay_job;
    results := pg_temp.res(results, '€12–14/h: submitted; hourly equivalent is the lower end', 'updated, pending, 12.00', coalesce(v_text, v_err), v_text = 'updated, pending, 12.00');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set pay_unit = 'month', pay_min = 600, pay_max = null where id = v_pay_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || coalesce(pay_hourly::text, 'none') into v_text from public.jobs where id = v_pay_job;
    results := pg_temp.res(results, '€600/month at 12 h/week: ≈ €11.54/h (600 / (12 × 52 / 12))', 'updated, 11.54', coalesce(v_text, v_err), v_text = 'updated, 11.54');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set hours_per_week = 24 where id = v_pay_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || coalesce(pay_hourly::text, 'none') into v_text from public.jobs where id = v_pay_job;
    results := pg_temp.res(results, 'Changing the hours recomputes it (24 h/week: ≈ €5.77/h)', 'updated, 5.77', coalesce(v_text, v_err), v_text = 'updated, 5.77');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set pay_unit = 'project', pay_min = 500 where id = v_pay_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || coalesce(pay_hourly::text, 'none') into v_text from public.jobs where id = v_pay_job;
    results := pg_temp.res(results, 'Per-project pay has no hourly equivalent', 'updated, none', coalesce(v_text, v_err), v_text = 'updated, none');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set pay_hourly = 99 where id = v_pay_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Nobody writes the hourly equivalent', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set pay_unit = null, pay_min = null where id = v_pay_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select coalesce(pay_unit, 'none') into v_text from public.jobs where id = v_pay_job;
    results := pg_temp.res(results, 'A submitted job cannot lose its pay', 'error, project', v_err || ', ' || v_text, v_err like 'error:%' and v_text = 'project');

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select pay_unit || ' ' || pay_min || ' ' || coalesce(pay_hourly::text, 'none') into v_text from public.jobs where id = v_emp2_live;
      perform set_config('role', 'none', true);
      v_err := 'read';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon can read a live job''s structured pay', 'read, hour 10.00 10.00', v_err || ', ' || coalesce(v_text, 'nothing'), v_err = 'read' and v_text = 'hour 10.00 10.00');

    -- ----------------------------------------------------------------------
    -- Saved searches
    -- ----------------------------------------------------------------------

    select relrowsecurity::text into v_text from pg_class where oid = 'public.saved_searches'::regclass;
    results := pg_temp.res(results, 'RLS is on: public.saved_searches', 'true', v_text, v_text = 'true');

    select string_agg(x, ', ') into v_err from (
      select 'anon:' || p from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
      where has_table_privilege('anon', 'public.saved_searches', p) or (p in ('SELECT', 'INSERT', 'UPDATE') and has_any_column_privilege('anon', 'public.saved_searches', p))
      union all
      select 'authenticated:TRUNCATE' where has_table_privilege('authenticated', 'public.saved_searches', 'TRUNCATE')
      union all
      select 'authenticated:INSERT ' || c from unnest(array['id', 'user_id', 'created_at', 'last_seen_at']) c
      where has_column_privilege('authenticated', 'public.saved_searches', c, 'INSERT')
      union all
      select 'authenticated:UPDATE ' || c from unnest(array['id', 'user_id', 'params', 'created_at']) c
      where has_column_privilege('authenticated', 'public.saved_searches', c, 'UPDATE')
    ) s(x);
    results := pg_temp.res(results, 'saved_searches: nothing for anon; logged-in users insert only name and params, update only name and last seen', 'none', coalesce(v_err, 'none'), v_err is null);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.saved_searches (name, params) values ('Check barista search', 'q=barista&area=3&when=weekends') returning id into v_ss;
      perform set_config('role', 'none', true);
      v_err := 'saved';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A student saves a search', 'saved', v_err, v_err = 'saved');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.saved_searches (user_id, name, params) values (v_late, 'Check for someone else', 'q=x');
      perform set_config('role', 'none', true);
      v_err := 'saved';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A student cannot save a search for someone else', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.saved_searches (name, params) values ('Check company search', 'q=x');
      perform set_config('role', 'none', true);
      v_err := 'saved';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A company account cannot save searches', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.saved_searches (name, params) values ('Check odd params', 'q=<script>');
      perform set_config('role', 'none', true);
      v_err := 'saved';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A saved search''s params must look like a query string', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.saved_searches (name, params) select 'Check search ' || n, 'q=x' || n from generate_series(2, 20) n;
      perform set_config('role', 'none', true);
      v_err := 'saved';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A student can keep 20 saved searches (control)', 'saved', v_err, v_err = 'saved');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.saved_searches (name, params) values ('Check search 21', 'q=x21');
      perform set_config('role', 'none', true);
      v_err := 'saved';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select count(*) into v_count from public.saved_searches where user_id = v_student;
    results := pg_temp.res(results, 'At most 20 saved searches per student', 'error, 20 kept', v_err || ', ' || v_count || ' kept', v_err like 'error:%' and v_count = 20);

    delete from public.saved_searches where user_id = v_student and name like 'Check search %';
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_late, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.saved_searches where id = v_ss;
      update public.saved_searches set name = 'Hijacked' where id = v_ss;
      get diagnostics v_rows = row_count;
      v_n := v_rows;
      delete from public.saved_searches where id = v_ss;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Another student can''t see, rename or delete someone''s saved search', 'ran, 0 visible, 0 renamed, 0 deleted', v_err || ', ' || v_count || ' visible, ' || v_n || ' renamed, ' || v_rows || ' deleted', v_err = 'ran' and v_count = 0 and v_n = 0 and v_rows = 0);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.saved_searches set last_seen_at = '2000-01-01', name = 'Check renamed' where id = v_ss;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || name || ', ' || case when last_seen_at >= now() - interval '1 minute' then 'seen now' else 'seen ' || last_seen_at::text end into v_text from public.saved_searches where id = v_ss;
    results := pg_temp.res(results, 'The owner renames it; "last seen" is always the database''s time, not the one sent', 'updated, Check renamed, seen now', v_text, v_text = 'updated, Check renamed, seen now');

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      select count(*) into v_count from public.saved_searches;
      perform set_config('role', 'none', true);
      v_err := 'read';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon cannot read saved searches', 'error', v_err, v_err like 'error:%');

    -- ----------------------------------------------------------------------
    -- Following companies
    -- ----------------------------------------------------------------------

    select relrowsecurity::text into v_text from pg_class where oid = 'public.company_follows'::regclass;
    results := pg_temp.res(results, 'RLS is on: public.company_follows', 'true', v_text, v_text = 'true');

    select string_agg(x, ', ') into v_err from (
      select 'anon:' || p from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
      where has_table_privilege('anon', 'public.company_follows', p) or (p in ('SELECT', 'INSERT', 'UPDATE') and has_any_column_privilege('anon', 'public.company_follows', p))
      union all
      select 'authenticated:' || p from unnest(array['UPDATE', 'TRUNCATE']) p
      where has_table_privilege('authenticated', 'public.company_follows', p) or (p = 'UPDATE' and has_any_column_privilege('authenticated', 'public.company_follows', p))
      union all
      select 'authenticated:INSERT ' || c from unnest(array['user_id', 'created_at']) c
      where has_column_privilege('authenticated', 'public.company_follows', c, 'INSERT')
    ) s(x);
    results := pg_temp.res(results, 'company_follows: nothing for anon; logged-in users insert only company_id, never update', 'none', coalesce(v_err, 'none'), v_err is null);

    select coalesce(nullif(g, ''), 'nobody') into v_text from (
      select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ',' order by 1) g
      from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = 'public.my_company_follower_count()'::regprocedure and a.privilege_type = 'EXECUTE'
        and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))
    ) s;
    results := pg_temp.res(results, 'my_company_follower_count: only authenticated can execute it', 'authenticated', v_text, v_text = 'authenticated');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.company_follows (company_id) values (v_co_approved);
      perform set_config('role', 'none', true);
      v_err := 'followed';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A student follows an approved company', 'followed', v_err, v_err = 'followed');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.company_follows (company_id) values (v_co_own);
      perform set_config('role', 'none', true);
      v_err := 'followed';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A student cannot follow a company that isn''t approved', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.company_follows (company_id) values (v_co_approved);
      perform set_config('role', 'none', true);
      v_err := 'followed';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A company account cannot follow companies', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.company_follows (user_id, company_id) values (v_late, v_co_emp);
      perform set_config('role', 'none', true);
      v_err := 'followed';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A student cannot follow on someone else''s behalf', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.company_follows;
      select public.my_company_follower_count() into v_n;
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'The followed company''s owner sees no followers, only the count', 'ran, 0 rows, count 1', v_err || ', ' || v_count || ' rows, count ' || coalesce(v_n::text, '?'), v_err = 'ran' and v_count = 0 and v_n = 1);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select public.my_company_follower_count() into v_n;
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Another company''s count doesn''t include it', 'ran, count 0', v_err || ', count ' || coalesce(v_n::text, '?'), v_err = 'ran' and v_n = 0);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_late, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.company_follows where user_id = v_student;
      delete from public.company_follows where user_id = v_student;
      get diagnostics v_rows = row_count;
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Another student can''t see or remove someone''s follows', 'ran, 0 visible, 0 removed', v_err || ', ' || v_count || ' visible, ' || v_rows || ' removed', v_err = 'ran' and v_count = 0 and v_rows = 0);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      perform public.my_company_follower_count();
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon cannot call my_company_follower_count', 'error', v_err, v_err like 'error:%');

    -- ----------------------------------------------------------------------
    -- Jobs you opened (your own apply clicks)
    -- ----------------------------------------------------------------------

    insert into public.job_clicks (job_id, user_id) values (v_emp2_live, v_student), (v_job_closed, v_student), (v_emp2_live, v_late);
    select coalesce(nullif(g, ''), 'nobody') into v_text from (
      select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ',' order by 1) g
      from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = 'public.my_opened_jobs()'::regprocedure and a.privilege_type = 'EXECUTE'
        and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))
    ) s;
    results := pg_temp.res(results, 'my_opened_jobs: only authenticated can execute it', 'authenticated', v_text, v_text = 'authenticated');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) filter (where user_id is distinct from v_student), count(*) filter (where user_id = v_student)
        into v_count, v_n from public.job_clicks;
      perform set_config('role', 'none', true);
      v_err := 'read';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A student reads only their own apply clicks', 'read, 0 of others, some of theirs', v_err || ', ' || v_count || ' of others, ' || case when v_n > 0 then 'some' else 'none' end || ' of theirs', v_err = 'read' and v_count = 0 and v_n > 0);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select string_agg(title || ' ' || case when live then 'live' else 'not live' end, '; ' order by title) into v_text
        from public.my_opened_jobs() where job_id in (v_emp2_live, v_job_closed);
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'my_opened_jobs lists the caller''s opened jobs, closed ones as not live', 'ran, Check closed job not live; Check emp2 live live', v_err || ', ' || coalesce(v_text, 'nothing'), v_text = 'Check closed job not live; Check emp2 live live');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_late, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.my_opened_jobs() where job_id = v_job_closed;
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'my_opened_jobs doesn''t show other students'' clicks', 'ran, 0', v_err || ', ' || v_count, v_err = 'ran' and v_count = 0);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.job_clicks where job_id in (v_emp_live, v_emp2_live, v_job_live, v_job_closed);
      perform set_config('role', 'none', true);
      v_err := 'read';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A non-admin employer reads no apply clicks', 'read, 0', v_err || ', ' || v_count, v_err = 'read' and v_count = 0);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      perform * from public.my_opened_jobs();
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon cannot call my_opened_jobs', 'error', v_err, v_err like 'error:%');

    -- ----------------------------------------------------------------------
    -- Launch audit: the whole API surface
    -- ----------------------------------------------------------------------

    select string_agg(p.proname, ', ' order by p.proname) into v_err
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prosecdef
      and not ('search_path=""' = any (coalesce(p.proconfig, '{}')));
    results := pg_temp.res(results, 'Every SECURITY DEFINER function uses an empty search_path (set search_path = '''')', 'all', coalesce('not empty: ' || v_err, 'all'), v_err is null);

    select string_agg(p.proname, ', ' order by p.proname) into v_err
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
      and exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee = 0 and a.privilege_type = 'EXECUTE');
    results := pg_temp.res(results, 'No function of ours can be called by everyone (PUBLIC)', 'none', coalesce(v_err, 'none'), v_err is null);

    select string_agg(distinct p.proname, ', ' order by p.proname) into v_text
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE');
    results := pg_temp.res(results, 'Logged-in users can call exactly these functions, no others', 'accept_terms, admin_company_contact, admin_job_contact, admin_resolve_report, admin_review_job, admin_set_company_status, admin_set_job_status, admin_stats, current_account_type, delete_my_account, extend_my_job, get_company_contact_email, get_own_job_contact, is_admin, my_company_follower_count, my_feedback, my_job_stats, my_opened_jobs, my_reports, my_saved_jobs, reveal_job_contact, set_job_contact', coalesce(v_text, 'none'), v_text = 'accept_terms, admin_company_contact, admin_job_contact, admin_resolve_report, admin_review_job, admin_set_company_status, admin_set_job_status, admin_stats, current_account_type, delete_my_account, extend_my_job, get_company_contact_email, get_own_job_contact, is_admin, my_company_follower_count, my_feedback, my_job_stats, my_opened_jobs, my_reports, my_saved_jobs, reveal_job_contact, set_job_contact');

    select string_agg(c.relname || ':' || pr, ', ' order by c.relname, pr) into v_err
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace, unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) pr
    where ns.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, pr) or (pr in ('INSERT', 'UPDATE') and has_any_column_privilege('anon', c.oid, pr)));
    results := pg_temp.res(results, 'anon can''t write to any table', 'none', coalesce(v_err, 'none'), v_err is null);

    select string_agg(tablename || ': ' || policyname, '; ') into v_err from pg_policies
    where schemaname = 'public' and 'public' = any (roles);
    results := pg_temp.res(results, 'No policy applies to every role (each names anon and/or authenticated)', 'none', coalesce(v_err, 'none'), v_err is null);

    -- ----------------------------------------------------------------------
    -- Links and emails from users: http(s) and plain addresses only
    -- ----------------------------------------------------------------------

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.companies set website = 'javascript:alert(1)' where id = v_co_own;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A javascript: website is refused', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.companies set website = 'data:text/html,<b>x</b>' where id = v_co_own;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A data: website is refused', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.companies set website = 'check-site.example' where id = v_co_own;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A website without http(s):// is refused (the site adds it)', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.companies set website = 'https://check-site.example/jobs?x=1' where id = v_co_own;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'An https website is accepted (control)', 'updated', v_err, v_err = 'updated');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.companies set contact_email = 'jobs@check.example?bcc=all' where id = v_co_own;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Contact email: an address with ?bcc= is refused', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.companies set contact_email = '"x"@check.example' where id = v_co_own;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Contact email: an address with quotes is refused', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.set_job_contact(v_job_own_draft, 'javascript:alert(document.cookie)', null);
      perform set_config('role', 'none', true);
      v_err := 'set';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A javascript: apply link is refused', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.set_job_contact(v_job_own_draft, 'https://check-site.example/"onmouseover="alert(1)', null);
      perform set_config('role', 'none', true);
      v_err := 'set';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'An apply link with quotes in it is refused', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.set_job_contact(v_job_own_draft, null, 'jobs@check.example?subject=x&body=y');
      perform set_config('role', 'none', true);
      v_err := 'set';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'An apply email carrying ?subject=&body= is refused', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.set_job_contact(v_job_own_draft, 'https://check-site.example/apply', 'jobs@check.example');
      perform set_config('role', 'none', true);
      v_err := 'set';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A normal apply link and email are accepted (control)', 'set', v_err, v_err = 'set');

    select (select count(*) from public.companies where website !~* '^https?://[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]{1,5})?([/?#][^[:space:]<>"''`]*)?$')
         + (select count(*) from public.companies where contact_email !~* '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$')
         + (select count(*) from public.job_contacts where apply_url !~* '^https?://[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]{1,5})?([/?#][^[:space:]<>"''`]*)?$')
         + (select count(*) from public.job_contacts where apply_email !~* '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$')
      into v_count;
    results := pg_temp.res(results, 'Every saved website, apply link and email fits the rules (older ones included)', '0 that don''t', v_count || ' that don''t', v_count = 0);

    -- ----------------------------------------------------------------------
    -- Daily limits against abuse
    -- ----------------------------------------------------------------------

    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_co_approved, 'Check live A', 'gig', 5, 'published', 1, array['flexible'], 'hour', 10) returning id into v_live_a;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_co_approved, 'Check live B', 'gig', 5, 'published', 1, array['flexible'], 'hour', 10) returning id into v_live_b;

    select string_agg(tg.tgname, ',' order by tg.tgname) into v_text from pg_trigger tg
    where not tg.tgisinternal and tg.tgname in ('feedback_daily_limit', 'reports_daily_limit', 'saves_daily_limit', 'job_submission_limit');
    results := pg_temp.res(results, 'The daily-limit triggers are in place (feedback, reports, saves on three tables, job submissions)', 'feedback_daily_limit,job_submission_limit,reports_daily_limit,saves_daily_limit,saves_daily_limit,saves_daily_limit', coalesce(v_text, 'none'), v_text = 'feedback_daily_limit,job_submission_limit,reports_daily_limit,saves_daily_limit,saves_daily_limit,saves_daily_limit');

    insert into public.feedback (user_id, page, message)
      select v_late, '/check', 'Check limit ' || n
      from generate_series(1, greatest(0, 19 - (select count(*) from public.feedback where user_id = v_late and created_at > now() - interval '1 day')::int)) n;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_late, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.feedback (page, message) values ('/check', 'Check feedback 20');
      perform set_config('role', 'none', true);
      v_err := 'sent';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Feedback: the 20th message of the day goes through (control)', 'sent', v_err, v_err = 'sent');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_late, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.feedback (page, message) values ('/check', 'Check feedback 21');
      perform set_config('role', 'none', true);
      v_err := 'sent';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Feedback: the 21st message of the day is refused with a clear message', 'error: Daily limit reached…', v_err, v_err like 'error: Daily limit reached: you can send feedback up to 20 times a day.%');

    insert into public.job_reports (job_id, reporter_id, reason, status, resolved_at)
      select v_live_a, v_late, 'other', 'resolved', now()
      from generate_series(1, greatest(0, 9 - (select count(*) from public.job_reports where reporter_id = v_late and created_at > now() - interval '1 day')::int)) n;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_late, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.job_reports (job_id, reason) values (v_live_a, 'other');
      perform set_config('role', 'none', true);
      v_err := 'reported';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Reports: the 10th report of the day goes through (control)', 'reported', v_err, v_err = 'reported');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_late, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.job_reports (job_id, reason) values (v_live_b, 'other');
      perform set_config('role', 'none', true);
      v_err := 'reported';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Reports: the 11th report of the day is refused', 'error: Daily limit reached…', v_err, v_err like 'error: Daily limit reached: you can report a job up to 10 times a day.%');

    with made as (
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        select v_co_approved, 'Check bulk ' || n, 'gig', 5, 'published', 1, array['flexible'], 'hour', 10 from generate_series(1, 50) n
      returning id
    )
    insert into public.saved_jobs (user_id, job_id)
      select v_late, id from made
      limit greatest(0, 49 - (
        (select count(*) from public.saved_jobs where user_id = v_late and created_at > now() - interval '1 day')
        + (select count(*) from public.saved_searches where user_id = v_late and created_at > now() - interval '1 day')
        + (select count(*) from public.company_follows where user_id = v_late and created_at > now() - interval '1 day'))::int);
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_late, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.saved_jobs (job_id) values (v_live_b);
      perform set_config('role', 'none', true);
      v_err := 'saved';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Saves: the 50th save, search or follow of the day goes through (control)', 'saved', v_err, v_err = 'saved');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_late, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.company_follows (company_id) values (v_co_emp);
      perform set_config('role', 'none', true);
      v_err := 'followed';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Saves: the 51st (a follow) is refused: saves, searches and follows count together', 'error: Daily limit reached…', v_err, v_err like 'error: Daily limit reached: you can save jobs or searches and follow companies up to 50 times a day.%');

    select count(*) into v_n from public.jobs where company_id = v_co_emp and submitted_at > now() - interval '1 day';
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        select v_co_emp, 'Check submission ' || n, 'gig', 5, 'pending', 1, array['flexible'], 'hour', 10 from generate_series(1, greatest(0, 10 - v_n)) n;
      perform set_config('role', 'none', true);
      v_err := 'submitted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Jobs: a company can submit 10 jobs in a day (control)', 'submitted', v_err, v_err = 'submitted');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check submission 11', 'gig', 5, 'pending', 1, array['flexible'], 'hour', 10);
      perform set_config('role', 'none', true);
      v_err := 'submitted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Jobs: the 11th submission of the day is refused', 'error: Daily limit reached…', v_err, v_err like 'error: Daily limit reached: you can submit jobs for review up to 10 times a day.%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
        values (v_co_emp, 'Check draft after the limit', 'gig', 5, 'draft', 1, array['flexible'], 'hour', 10);
      perform set_config('role', 'none', true);
      v_err := 'saved';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Jobs: drafts can still be saved after the limit (control)', 'saved', v_err, v_err = 'saved');

    select string_agg(r || ' ' || pr, ', ') into v_err from unnest(array['anon', 'authenticated']) r, unnest(array['SELECT', 'INSERT', 'UPDATE']) pr
    where has_column_privilege(r, 'public.jobs', 'submitted_at', pr);
    results := pg_temp.res(results, 'Nobody reads or writes jobs.submitted_at through the API', 'none', coalesce(v_err, 'none'), v_err is null);

    -- ----------------------------------------------------------------------
    -- Own data ("Download my data"): my_feedback, my_reports
    -- ----------------------------------------------------------------------

    insert into public.feedback (user_id, page, message) values (v_student, '/check', 'Check own feedback');
    insert into public.job_reports (job_id, reporter_id, reason, details, status, resolution_note, resolved_at)
      values (v_live_a, v_student, 'misleading', 'Check own report', 'resolved', 'Check internal note', now());
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select string_agg(message, ',') into v_text from public.my_feedback() where message like 'Check %';
      select v_text || ' | ' || string_agg(details || ' ' || status, ',') into v_text from public.my_reports() where details like 'Check %';
      perform set_config('role', 'none', true);
      v_err := 'read';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'my_feedback and my_reports return the caller''s own rows', 'read: Check own feedback | Check own report resolved', v_err || ': ' || coalesce(v_text, 'nothing'), v_err = 'read' and v_text = 'Check own feedback | Check own report resolved');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_late, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select count(*) into v_count from public.my_feedback() where message = 'Check own feedback';
      select v_count + count(*) into v_count from public.my_reports() where details = 'Check own report';
      perform set_config('role', 'none', true);
      v_err := 'read';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'They never return someone else''s', 'read, 0', v_err || ', ' || v_count, v_err = 'read' and v_count = 0);

    select string_agg(a, ',') into v_text from (select unnest(proargnames) a from pg_proc where oid = 'public.my_reports()'::regprocedure) x
      where a in ('resolution_note', 'resolved_by', 'reporter_id');
    results := pg_temp.res(results, 'my_reports leaves out the admin''s note and who resolved it', 'none', coalesce(v_text, 'none'), v_text is null);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      perform * from public.my_feedback();
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon cannot call my_feedback', 'error', v_err, v_err like 'error:%');

    -- ----------------------------------------------------------------------
    -- Retention (prepared, off until periods are set)
    -- ----------------------------------------------------------------------

    select string_agg(r || ':' || pr, ', ') into v_err from unnest(array['anon', 'authenticated']) r,
      unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) pr
    where has_table_privilege(r, 'public.retention_settings', pr) or (pr in ('SELECT', 'INSERT', 'UPDATE') and has_any_column_privilege(r, 'public.retention_settings', pr));
    results := pg_temp.res(results, 'No API privileges at all on public.retention_settings', 'none', coalesce(v_err, 'none'), v_err is null);

    select case when has_function_privilege('anon', 'public.run_retention()', 'EXECUTE') or has_function_privilege('authenticated', 'public.run_retention()', 'EXECUTE')
                then 'callable' else 'not callable' end into v_text;
    results := pg_temp.res(results, 'run_retention can''t be called through the API', 'not callable', v_text, v_text = 'not callable');

    if to_regclass('cron.job') is null then
      v_text := 'pg_cron not installed here';
    else
      execute $q$select case when exists (select 1 from cron.job where jobname = 'gigome-retention' and command like '%run_retention%')
                          then 'scheduled' else 'not scheduled' end$q$ into v_text;
    end if;
    results := pg_temp.res(results, 'The daily retention job is scheduled (where pg_cron exists)', 'scheduled', v_text, v_text in ('scheduled', 'pg_cron not installed here'));

    select coalesce(incomplete_signups_days::text, 'empty') || ', ' || coalesce(ended_job_details_days::text, 'empty') || ', '
           || coalesce(click_anonymize_days::text, 'empty') || '; older periods: '
           || coalesce(ended_jobs_days::text, 'empty') || ', ' || coalesce(feedback_days::text, 'empty') || ', '
           || coalesce(resolved_reports_days::text, 'empty') || ', ' || coalesce(inactive_accounts_days::text, 'empty')
      into v_text from public.retention_settings where id = 1;
    results := pg_temp.res(results, 'Retention periods (Privacy Notice section 9): incomplete sign-ups 29 days, ended listings 89, apply clicks 179, resolved reports 730; ended jobs, feedback and inactive accounts empty',
                           '29, 89, 179; older periods: empty, empty, 730, empty', v_text, v_text = '29, 89, 179; older periods: empty, empty, 730, empty');

    -- Old and recent test rows, then run it with every period empty, then set.
    insert into auth.users (id, email, created_at, last_sign_in_at) values
      (v_old_user, 'old.user@check-uni.example', now() - interval '3 years', now() - interval '400 days'),
      (v_old_admin, 'old.admin@check-uni.example', now() - interval '3 years', now() - interval '400 days');
    insert into public.admins (user_id) values (v_old_admin);
    insert into public.feedback (user_id, page, message, created_at) values
      (null, '/check', 'Check old feedback', now() - interval '400 days'),
      (null, '/check', 'Check recent feedback', now() - interval '5 days');
    insert into public.job_reports (job_id, reporter_id, reason, details, status, resolved_at, created_at) values
      (v_live_b, null, 'other', 'Check old resolved report', 'resolved', now() - interval '400 days', now() - interval '401 days'),
      (v_live_b, null, 'other', 'Check old open report', 'open', null, now() - interval '401 days');
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min, created_at, expires_at)
      values (v_co_approved, 'Check long expired', 'gig', 5, 'published', 1, array['flexible'], 'hour', 10, now() - interval '500 days', now() - interval '400 days');
    update public.retention_settings set ended_jobs_days = null, feedback_days = null, resolved_reports_days = null, inactive_accounts_days = null,
                                         incomplete_signups_days = null, ended_job_details_days = null, click_anonymize_days = null where id = 1;
    select public.run_retention() into v_json;
    select case when count(*) = 9 and bool_and(value = '0') then 'all 0' else v_json::text end into v_text from jsonb_each_text(v_json);
    results := pg_temp.res(results, 'With every period empty, retention deletes nothing', 'all 0', v_text, v_text = 'all 0');

    update public.retention_settings set ended_jobs_days = 365, feedback_days = 365, resolved_reports_days = 365, inactive_accounts_days = 365 where id = 1;
    perform public.run_retention();
    select (select count(*) from public.feedback where message = 'Check old feedback') || ' old/'
           || (select count(*) from public.feedback where message = 'Check recent feedback') || ' recent feedback, '
           || (select count(*) from public.jobs where title = 'Check long expired') || ' long-expired job, '
           || (select count(*) from public.job_reports where details = 'Check old resolved report') || ' old resolved/'
           || (select count(*) from public.job_reports where details = 'Check old open report') || ' old open report, '
           || (select count(*) from auth.users where id = v_old_user) || ' inactive user, '
           || (select count(*) from auth.users where id = v_old_admin) || ' inactive admin, '
           || (select count(*) from auth.users where id = v_student) || ' active student'
      into v_text;
    results := pg_temp.res(results, 'With periods set, retention deletes only what''s older (never admins, never active users)', '0 old/1 recent feedback, 0 long-expired job, 0 old resolved/1 old open report, 0 inactive user, 1 inactive admin, 1 active student', v_text, v_text = '0 old/1 recent feedback, 0 long-expired job, 0 old resolved/1 old open report, 0 inactive user, 1 inactive admin, 1 active student');

    update public.retention_settings set ended_jobs_days = null, feedback_days = null, resolved_reports_days = null, inactive_accounts_days = null where id = 1;

    -- ----------------------------------------------------------------------
    -- Job expiry: owners at most 60 days ahead; "Extend by 60 days"
    -- ----------------------------------------------------------------------

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set expires_at = now() + interval '90 days' where id = v_area_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'An owner can''t set a job to show for more than 60 days', 'error', v_err, v_err like 'error:%60 days%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set expires_at = now() + interval '30 days' where id = v_area_job;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, '30 days is fine (control)', 'updated', v_err, v_err = 'updated');

    select reviewed_at into v_ts from public.jobs where id = v_emp_live;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.extend_my_job(v_emp_live);
      perform set_config('role', 'none', true);
      v_err := 'extended';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || status || ', ' || case when expires_at between now() + interval '59 days' and now() + interval '61 days' then '60 days ahead' else expires_at::text end
           || case when reviewed_at is not distinct from v_ts then ', no new review' else ', reviewed again' end into v_text
    from public.jobs where id = v_emp_live;
    results := pg_temp.res(results, 'extend_my_job: a published job of your own goes to 60 days from now, still published, no new review', 'extended, published, 60 days ahead, no new review', v_text, v_text = 'extended, published, 60 days ahead, no new review');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.extend_my_job(v_area_job);
      perform set_config('role', 'none', true);
      v_err := 'extended';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'extend_my_job refuses a job that isn''t published', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.extend_my_job(v_live_a);
      perform set_config('role', 'none', true);
      v_err := 'extended';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'extend_my_job refuses another company''s job', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      perform public.extend_my_job(v_emp_live);
      perform set_config('role', 'none', true);
      v_err := 'extended';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon cannot call extend_my_job', 'error', v_err, v_err like 'error:%');

    -- Extending only within 14 days of expiry; older expired jobs go back to review.
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min, expires_at)
      values (v_co_emp2, 'Check expired 10 days ago', 'gig', 5, 'published', 1, array['flexible'], 'hour', 10, now() - interval '10 days')
      returning id into v_exp_recent;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min, expires_at)
      values (v_co_emp2, 'Check expired 20 days ago', 'gig', 5, 'published', 1, array['flexible'], 'hour', 10, now() - interval '20 days')
      returning id into v_exp_old;

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp2, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.extend_my_job(v_exp_recent);
      perform set_config('role', 'none', true);
      v_err := 'extended';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || status || ', ' || case when expires_at between now() + interval '59 days' and now() + interval '61 days' then '60 days ahead' else expires_at::text end
      into v_text from public.jobs where id = v_exp_recent;
    results := pg_temp.res(results, 'extend_my_job: a job that expired 10 days ago can still be extended (60 days from now, no review)', 'extended, published, 60 days ahead', v_text, v_text = 'extended, published, 60 days ahead');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp2, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.extend_my_job(v_exp_old);
      perform set_config('role', 'none', true);
      v_err := 'extended';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'extend_my_job refuses a job that expired more than 14 days ago, with a clear message',
                           'error: This job expired more than 14 days ago. Edit it and submit it again for review.', v_err,
                           v_err = 'error: This job expired more than 14 days ago. Edit it and submit it again for review.');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp2, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set expires_at = now() + interval '30 days' where id = v_exp_old;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select status || ', ' || case when expires_at < now() - interval '19 days' then 'still expired' else 'moved to ' || expires_at::text end
      into v_text from public.jobs where id = v_exp_old;
    results := pg_temp.res(results, 'The owner can''t revive it by changing the date while it stays published', 'published, still expired', v_text, v_text = 'published, still expired');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp2, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set status = 'pending', expires_at = now() + interval '30 days' where id = v_exp_old;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || status || case when expires_at > now() then ', new date' else ', old date' end into v_text from public.jobs where id = v_exp_old;
    results := pg_temp.res(results, 'Instead the owner resubmits it: back to review with a new date', 'updated, pending, new date', v_text, v_text = 'updated, pending, new date');

    -- A company that isn't approved (still pending, or rejected after a scam) can't extend.
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min, expires_at)
      values (v_co_own, 'Check job of a company not approved', 'gig', 5, 'published', 1, array['flexible'], 'hour', 10, now() + interval '5 days')
      returning id into v_unapproved_job;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_company, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.extend_my_job(v_unapproved_job);
      perform set_config('role', 'none', true);
      v_err := 'extended';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || case when expires_at < now() + interval '6 days' then ', unchanged' else ', moved' end into v_text from public.jobs where id = v_unapproved_job;
    results := pg_temp.res(results, 'extend_my_job refuses a company that isn''t approved', 'error, unchanged', v_text, v_text like 'error:%, unchanged');

    -- ----------------------------------------------------------------------
    -- Admin numbers: admin_stats()
    -- ----------------------------------------------------------------------

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_other, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select students || ',' || live_jobs into v_text from public.admin_stats();
      perform set_config('role', 'none', true);
      v_err := 'read';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select (select count(*) from public.profiles where account_type = 'student') || ','
           || (select count(*) from public.jobs j join public.companies c on c.id = j.company_id
               where j.status = 'published' and j.expires_at > now() and c.status = 'approved')
      into v_count_text;
    results := pg_temp.res(results, 'admin_stats gives an admin the same numbers as kpis.sql', v_count_text, v_err || ': ' || coalesce(v_text, '?'), v_err = 'read' and v_text = v_count_text);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform * from public.admin_stats();
      perform set_config('role', 'none', true);
      v_err := 'read';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'admin_stats refuses anyone who isn''t an admin', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      perform * from public.admin_stats();
      perform set_config('role', 'none', true);
      v_err := 'read';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon cannot call admin_stats', 'error', v_err, v_err like 'error:%');

    -- ----------------------------------------------------------------------
    -- Deleting your own account (delete_my_account)
    -- ----------------------------------------------------------------------
    select coalesce(string_agg(case when grantee = 0 then 'PUBLIC' else grantee::regrole::text end, ', ' order by 1), 'nobody')
      into v_text
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.delete_my_account()'::regprocedure and a.privilege_type = 'EXECUTE'
      and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'));
    results := pg_temp.res(results, 'delete_my_account: only authenticated can execute it (not anon, not PUBLIC)',
                           'authenticated', v_text, v_text = 'authenticated');

    select case when p.prosecdef then 'security definer' else 'security invoker' end || ', '
           || coalesce((select c from unnest(p.proconfig) c where c like 'search_path=%'), 'no search_path') || ', '
           || p.pronargs || ' arguments'
      into v_text
    from pg_proc p where p.oid = 'public.delete_my_account()'::regprocedure;
    results := pg_temp.res(results, 'delete_my_account: SECURITY DEFINER, empty search_path, no arguments (it can only act on the caller)',
                           'security definer, search_path="", 0 arguments', v_text,
                           v_text = 'security definer, search_path="", 0 arguments');

    -- A student with feedback and clicks, and a company account with a company, a job, a contact.
    insert into auth.users (id, email) values
      (v_leaver,    'leaver@studbocconi.it'),
      (v_leaver_co, 'owner@check-leaving.example');
    insert into public.feedback (user_id, page, message) values (v_leaver, '/check', 'leaver feedback 1'), (v_leaver, '/check', 'leaver feedback 2');
    insert into public.job_reports (job_id, reporter_id, reason, details) values (v_emp2_live, v_leaver, 'other', 'check leaver report');
    insert into public.saved_jobs (user_id, job_id) values (v_leaver, v_emp2_live), (v_leaver, v_job_live);
    insert into public.saved_searches (user_id, name, params) values (v_leaver, 'Check leaver search', 'q=x');
    insert into public.company_follows (user_id, company_id) values (v_leaver, v_co_approved);
    with c as (
      insert into public.job_clicks (job_id, user_id) values (v_job_live, v_leaver), (v_job_live, v_leaver) returning id
    ) select array_agg(id) into v_clicks from c;
    insert into public.companies (owner_id, name, status) values (v_leaver_co, 'Check Co (leaving)', 'approved') returning id into v_leaver_company;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_leaver_company, 'Check job of a leaving company', 'gig', 5, 'published', 1, array['flexible'], 'hour', 10) returning id into v_leaver_job;
    insert into public.job_contacts (job_id, apply_url) values (v_leaver_job, 'https://check.example/leaving');
    insert into public.company_follows (user_id, company_id) values (v_student, v_leaver_company);
    insert into public.job_clicks (job_id, user_id) values (v_leaver_job, v_student);

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      perform public.delete_my_account();
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select count(*) into v_count from auth.users where id in (v_student, v_company, v_other, v_leaver, v_leaver_co);
    results := pg_temp.res(results, 'anon cannot call delete_my_account', 'error, nobody deleted',
                           v_err || ', ' || (5 - v_count) || ' test user(s) deleted', v_err like 'error:%' and v_count = 5);

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_leaver, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.delete_my_account();
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', user ' || case when exists (select 1 from auth.users where id = v_leaver) then 'still there' else 'gone' end
           || ', profile ' || case when exists (select 1 from public.profiles where id = v_leaver) then 'still there' else 'gone' end
      into v_text;
    results := pg_temp.res(results, 'Student can delete their own account: user and profile are gone',
                           'ran, user gone, profile gone', v_text, v_text = 'ran, user gone, profile gone');

    select count(*) into v_count from auth.users where id in (v_student, v_company, v_other, v_lookalike, v_leaver_co);
    select count(*) into v_rows from public.profiles where id in (v_student, v_company, v_other, v_lookalike, v_leaver_co);
    results := pg_temp.res(results, 'delete_my_account deletes only the caller: every other test user and profile is still there',
                           '5 users, 5 profiles', v_count || ' users, ' || v_rows || ' profiles', v_count = 5 and v_rows = 5);

    select count(*) into v_count from public.feedback where message like 'leaver feedback%';
    select count(*) into v_rows from public.feedback where user_id = v_other;
    results := pg_temp.res(results, 'delete_my_account deletes the caller''s feedback, not anyone else''s',
                           '0 of theirs left, 1 other kept', v_count || ' of theirs left, ' || v_rows || ' other kept', v_count = 0 and v_rows = 1);

    select count(*) into v_count from public.saved_jobs where user_id = v_leaver;
    results := pg_temp.res(results, 'delete_my_account deletes the caller''s saved jobs', '0 left', v_count || ' left', v_count = 0);

    select (select count(*) from public.saved_searches where user_id = v_leaver) || ' searches, '
           || (select count(*) from public.company_follows where user_id = v_leaver) || ' follows left' into v_text;
    results := pg_temp.res(results, 'delete_my_account deletes the caller''s saved searches and follows', '0 searches, 0 follows left',
                           v_text, v_text = '0 searches, 0 follows left');

    select count(*) || ' kept, ' || count(reporter_id) || ' with a reporter' into v_text
    from public.job_reports where details = 'check leaver report';
    results := pg_temp.res(results, 'delete_my_account keeps the caller''s job reports, without a reporter',
                           '1 kept, 0 with a reporter', v_text, v_text = '1 kept, 0 with a reporter');

    select count(*) || ' kept, ' || count(user_id) || ' with a user_id' into v_text
    from public.job_clicks where id = any (v_clicks);
    results := pg_temp.res(results, 'delete_my_account keeps the caller''s clicks, without a user_id',
                           '2 kept, 0 with a user_id', v_text, v_text = '2 kept, 0 with a user_id');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_leaver_co, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.delete_my_account();
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', '
           || (select count(*) from auth.users where id = v_leaver_co) + (select count(*) from public.profiles where id = v_leaver_co) || ' user/profile, '
           || (select count(*) from public.companies where id = v_leaver_company) || ' company, '
           || (select count(*) from public.jobs where id = v_leaver_job) || ' job, '
           || (select count(*) from public.job_contacts where job_id = v_leaver_job) || ' contact left'
      into v_text;
    results := pg_temp.res(results, 'Company account can delete itself: its company, jobs and job contacts go with it',
                           'ran, 0 user/profile, 0 company, 0 job, 0 contact left', v_text,
                           v_text = 'ran, 0 user/profile, 0 company, 0 job, 0 contact left');

    select count(*) into v_count from public.company_follows where company_id = v_leaver_company;
    results := pg_temp.res(results, 'Follows of a deleted company go with it', '0 left', v_count || ' left', v_count = 0);

    select count(*) into v_count from public.companies where id in (v_co_own, v_co_approved);
    select count(*) into v_rows from public.jobs where id = any (test_jobs);
    results := pg_temp.res(results, 'Deleting a company account leaves other companies and jobs alone',
                           '2 companies, 7 jobs', v_count || ' companies, ' || v_rows || ' jobs', v_count = 2 and v_rows = 7);

    -- ----------------------------------------------------------------------
    -- Data protection: accepting the Terms, what the Privacy Notice promises
    -- about who sees what, deleting a user in the dashboard, retention
    -- ----------------------------------------------------------------------

    -- Helper: run one count as a user (null = logged out). 'no access' when
    -- the role may not read the table at all.
    create function pg_temp.seen_as(p_uid uuid, p_sql text)
    returns text language plpgsql as $f$
    declare v bigint;
    begin
      begin
        if p_uid is null then
          perform set_config('request.jwt.claims', '{"role":"anon"}', true);
          perform set_config('role', 'anon', true);
        else
          perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
          perform set_config('role', 'authenticated', true);
        end if;
        execute p_sql into v;
        perform set_config('role', 'none', true);
        return coalesce(v::text, 'nothing');
      exception
        when insufficient_privilege then return 'no access';
        when others then return 'error: ' || sqlerrm;
      end;
    end
    $f$;

    -- A student who used v_emp's listing: clicked Apply, saved it, followed
    -- the company, saved a search, sent feedback and reported the listing.
    insert into auth.users (id, email) values (v_dp_student, 'dp.student@studbocconi.it');
    insert into public.job_clicks (job_id, user_id) values (v_emp_live, v_dp_student);
    insert into public.saved_jobs (user_id, job_id) values (v_dp_student, v_emp_live);
    insert into public.saved_searches (user_id, name, params) values (v_dp_student, 'Check dp search', 'q=dp');
    insert into public.company_follows (user_id, company_id) values (v_dp_student, v_co_emp);
    insert into public.feedback (user_id, page, message) values (v_dp_student, '/check', 'Check dp feedback');
    insert into public.job_reports (job_id, reporter_id, reason, details) values (v_emp_live, v_dp_student, 'other', 'Check dp report');

    -- Accepting the Terms ---------------------------------------------------

    select coalesce(string_agg(r || ':' || pr || ' ' || col, ', '), 'none') into v_text
    from unnest(array['anon', 'authenticated']) r, unnest(array['INSERT', 'UPDATE']) pr,
         unnest(array['terms_version', 'terms_accepted_at']) col
    where has_column_privilege(r, 'public.profiles', col, pr);
    results := pg_temp.res(results, 'Terms acceptance: nobody writes profiles.terms_version or terms_accepted_at through the API',
                           'none', v_text, v_text = 'none');

    select coalesce(string_agg(case when grantee = 0 then 'PUBLIC' else grantee::regrole::text end, ', ' order by 1), 'nobody')
      into v_text
    from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.accept_terms(text)'::regprocedure and a.privilege_type = 'EXECUTE'
      and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'));
    results := pg_temp.res(results, 'accept_terms: only authenticated can execute it (not anon, not PUBLIC)',
                           'authenticated', v_text, v_text = 'authenticated');

    select coalesce(terms_version, 'no version') || ', ' || coalesce(terms_accepted_at::text, 'never') into v_text
    from public.profiles where id = v_dp_student;
    results := pg_temp.res(results, 'A new account has not accepted the Terms yet (it is asked on its first visit)',
                           'no version, never', v_text, v_text = 'no version, never');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_dp_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.profiles set terms_version = '2.0', terms_accepted_at = now() - interval '1 year' where id = v_dp_student;
      perform set_config('role', 'none', true);
      v_err := 'updated';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'A user cannot write their acceptance (or its date) directly', 'error', v_err, v_err like 'error:%');

    v_ts := null;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_dp_student, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      select public.accept_terms('2.0') into v_ts;
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || coalesce(terms_version, 'no version') || ', '
           || case when terms_accepted_at = now() and v_ts = now() then 'the database''s time' else coalesce(terms_accepted_at::text, 'never') end
      into v_text from public.profiles where id = v_dp_student;
    results := pg_temp.res(results, 'accept_terms records the version and the database''s time, for the caller',
                           'ran, 2.0, the database''s time', v_text, v_text = 'ran, 2.0, the database''s time');

    v_n := 0;
    foreach v_text in array array['2.0 or 1=1', '', 'latest', null] loop
      begin
        perform set_config('request.jwt.claims', jsonb_build_object('sub', v_dp_student, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        perform public.accept_terms(v_text);
        perform set_config('role', 'none', true);
      exception when others then v_n := v_n + 1;
      end;
    end loop;
    select v_n || ' refused, still ' || coalesce(terms_version, 'no version') into v_text from public.profiles where id = v_dp_student;
    results := pg_temp.res(results, 'accept_terms refuses anything but a version number', '4 refused, still 2.0', v_text, v_text = '4 refused, still 2.0');

    begin
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
      perform public.accept_terms('2.0');
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'anon cannot call accept_terms', 'error', v_err, v_err like 'error:%');

    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      perform public.accept_terms('2.0');
      perform set_config('role', 'none', true);
      v_err := 'ran';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', ' || coalesce(terms_version, 'no version') into v_text from public.profiles where id = v_emp;
    results := pg_temp.res(results, 'A company account records its acceptance the same way', 'ran, 2.0', v_text, v_text = 'ran, 2.0');

    -- Who sees what (Privacy Notice sections 4 and 5) ----------------------

    -- Control: the student has one row in each table, so the checks below
    -- can't pass by finding nothing.
    select string_agg(x.tbl || ' ' || x.n, ', ' order by x.tbl) into v_text from (
      select 'profiles' tbl, count(*) n from public.profiles where id = v_dp_student
      union all select 'job_clicks', count(*) from public.job_clicks where user_id = v_dp_student
      union all select 'saved_jobs', count(*) from public.saved_jobs where user_id = v_dp_student
      union all select 'saved_searches', count(*) from public.saved_searches where user_id = v_dp_student
      union all select 'company_follows', count(*) from public.company_follows where user_id = v_dp_student
      union all select 'feedback', count(*) from public.feedback where user_id = v_dp_student
      union all select 'job_reports', count(*) from public.job_reports where reporter_id = v_dp_student) x;
    results := pg_temp.res(results, 'Who sees what: the student has a row in each personal table (control)',
                           'company_follows 1, feedback 1, job_clicks 1, job_reports 1, profiles 1, saved_jobs 1, saved_searches 1', v_text,
                           v_text = 'company_follows 1, feedback 1, job_clicks 1, job_reports 1, profiles 1, saved_jobs 1, saved_searches 1');

    -- As an employer whose listing the student used, as another student, and
    -- logged out: none of the student's rows may be visible.
    for t in select * from (values ('an employer whose listing the student used', v_emp),
                                   ('another student', v_student),
                                   ('a logged-out visitor', null::uuid)) w(who, uid) loop
      select string_agg(x.tbl || ': ' || x.seen, ', ' order by x.tbl) into v_text from (
        select y.tbl, pg_temp.seen_as(t.uid, format('select count(*) from public.%I where %I = %L', y.tbl, y.col, v_dp_student)) seen
        from (values ('profiles', 'id'), ('job_clicks', 'user_id'), ('saved_jobs', 'user_id'), ('saved_searches', 'user_id'),
                     ('company_follows', 'user_id'), ('feedback', 'user_id'), ('job_reports', 'reporter_id')) y(tbl, col)) x
      where x.seen not in ('0', 'no access');
      results := pg_temp.res(results, 'Privacy Notice: ' || t.who || ' sees none of a student''s profile, apply clicks, saved jobs, searches, follows, feedback or reports',
                             'none', coalesce(v_text, 'none'), v_text is null);
    end loop;

    select count(*) into v_n from public.job_clicks where job_id = v_emp_live;
    v_text := pg_temp.seen_as(v_emp, format('select apply_clicks from public.my_job_stats() where job_id = %L', v_emp_live));
    select v_text || ' (of ' || v_n || '), columns: ' || string_agg(a, ', ' order by o) into v_text
    from unnest((select proargnames from pg_proc where oid = 'public.my_job_stats()'::regprocedure)) with ordinality u(a, o);
    results := pg_temp.res(results, 'Privacy Notice: the employer gets only the number of apply clicks on its listing, not who',
                           v_n || ' (of ' || v_n || '), columns: job_id, apply_clicks', v_text,
                           v_text = v_n || ' (of ' || v_n || '), columns: job_id, apply_clicks');

    select 'admin ' || pg_temp.seen_as(v_other, format('select count(*) from public.job_clicks where user_id = %L', v_dp_student))
           || ', the student themself ' || pg_temp.seen_as(v_dp_student, format('select count(*) from public.job_clicks where user_id = %L', v_dp_student))
           || ', of anyone else ' || pg_temp.seen_as(v_dp_student, format('select count(*) from public.job_clicks where user_id is distinct from %L', v_dp_student))
      into v_text;
    results := pg_temp.res(results, 'Privacy Notice: only admins read the apply-click log; a student reads only their own',
                           'admin 1, the student themself 1, of anyone else 0', v_text, v_text = 'admin 1, the student themself 1, of anyone else 0');

    select 'admin: feedback ' || pg_temp.seen_as(v_other, format('select count(*) from public.feedback where user_id = %L', v_dp_student))
           || ', reports ' || pg_temp.seen_as(v_other, format('select count(*) from public.job_reports where reporter_id = %L', v_dp_student))
           || ', log ' || case when pg_temp.seen_as(v_other, 'select count(*) from public.moderation_log') ~ '^[0-9]+$' then 'readable' else 'not readable' end
           || '; employer: log ' || pg_temp.seen_as(v_emp, 'select count(*) from public.moderation_log')
           || '; student: log ' || pg_temp.seen_as(v_dp_student, 'select count(*) from public.moderation_log')
      into v_text;
    results := pg_temp.res(results, 'Privacy Notice: only admins read feedback, reports and the moderation log',
                           'admin: feedback 1, reports 1, log readable; employer: log 0 or no access; student: log 0 or no access', v_text,
                           v_text ~ '^admin: feedback 1, reports 1, log readable; employer: log (0|no access); student: log (0|no access)$');

    -- Deleting users in the dashboard (Authentication > Users > Delete) -----
    -- The dashboard deletes the auth.users row directly, without
    -- delete_my_account(): everything must follow from the foreign keys.

    insert into auth.users (id, email) values
      (v_dp_gone,       'dp.gone@studbocconi.it'),
      (v_dp_gone_owner, 'owner@check-dp-gone.example'),
      (v_dp_gone_admin, 'admin@check-dp-gone.example');
    insert into public.admins (user_id) values (v_dp_gone_admin);
    update public.profiles set full_name = 'Check Gone', terms_version = '2.0', terms_accepted_at = now() where id = v_dp_gone;
    insert into public.feedback (user_id, page, message) values (v_dp_gone, '/check', 'Check dp gone feedback');
    insert into public.saved_jobs (user_id, job_id) values (v_dp_gone, v_emp_live);
    insert into public.saved_searches (user_id, name, params) values (v_dp_gone, 'Check dp gone search', 'q=gone');
    insert into public.company_follows (user_id, company_id) values (v_dp_gone, v_co_emp);
    insert into public.job_clicks (job_id, user_id) values (v_emp_live, v_dp_gone) returning id into v_dp_click;
    insert into public.job_reports (job_id, reporter_id, reason, details) values (v_emp_live, v_dp_gone, 'other', 'Check dp gone report');

    insert into public.companies (owner_id, name, status) values (v_dp_gone_owner, 'Check Co (deleted in the dashboard)', 'approved')
      returning id into v_dp_gone_company;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_dp_gone_company, 'Check job of a company deleted in the dashboard', 'gig', 5, 'published', 1, array['flexible'], 'hour', 10)
      returning id into v_dp_gone_job;
    insert into public.job_contacts (job_id, apply_email) values (v_dp_gone_job, 'jobs@check-dp-gone.example');
    insert into public.job_clicks (job_id, user_id) values (v_dp_gone_job, v_dp_student);
    insert into public.saved_jobs (user_id, job_id) values (v_dp_student, v_dp_gone_job);
    insert into public.company_follows (user_id, company_id) values (v_dp_student, v_dp_gone_company);
    insert into public.job_reports (job_id, reporter_id, reason, details) values (v_dp_gone_job, v_dp_student, 'scam', 'Check dp report on a deleted company');

    -- The admin's work: a decision on the company, a review, a resolved report.
    insert into public.moderation_log (admin_id, action, company_id, note) values
      (v_dp_gone_admin, 'company_approved', v_dp_gone_company, 'Check dp decision on a deleted company'),
      (v_dp_gone_admin, 'job_published', null, 'Check dp decision by a deleted admin');
    update public.jobs set reviewed_by = v_dp_gone_admin, reviewed_at = now() where id = v_emp_live;
    update public.job_reports set status = 'resolved', resolved_by = v_dp_gone_admin, resolved_at = now(), resolution_note = 'Check dp resolution'
      where details = 'Check dp report';

    -- One at a time, as the dashboard does.
    delete from auth.users where id = v_dp_gone_owner;
    delete from auth.users where id = v_dp_gone_admin;
    delete from auth.users where id = v_dp_gone;

    select (select count(*) from public.profiles where id = v_dp_gone) || ' profile, '
           || (select count(*) from public.feedback where user_id = v_dp_gone or message = 'Check dp gone feedback') || ' feedback, '
           || (select count(*) from public.saved_jobs where user_id = v_dp_gone) || ' saved jobs, '
           || (select count(*) from public.saved_searches where user_id = v_dp_gone or name = 'Check dp gone search') || ' searches, '
           || (select count(*) from public.company_follows where user_id = v_dp_gone) || ' follows'
      into v_text;
    results := pg_temp.res(results, 'Deleting a student in the dashboard: profile (with the Terms acceptance), feedback, saved jobs, searches and follows go with them',
                           '0 profile, 0 feedback, 0 saved jobs, 0 searches, 0 follows', v_text,
                           v_text = '0 profile, 0 feedback, 0 saved jobs, 0 searches, 0 follows');

    select (select count(*) || ' click, ' || count(user_id) || ' with a user' from public.job_clicks where id = v_dp_click) || '; '
           || (select count(*) || ' report, ' || count(reporter_id) || ' with a reporter' from public.job_reports where details = 'Check dp gone report')
      into v_text;
    results := pg_temp.res(results, 'Deleting a student in the dashboard: their apply clicks and reports stay, without them',
                           '1 click, 0 with a user; 1 report, 0 with a reporter', v_text, v_text = '1 click, 0 with a user; 1 report, 0 with a reporter');

    select (select count(*) from public.companies where id = v_dp_gone_company) || ' company, '
           || (select count(*) from public.jobs where id = v_dp_gone_job) || ' job, '
           || (select count(*) from public.job_contacts where job_id = v_dp_gone_job) || ' contact, '
           || (select count(*) from public.job_clicks where job_id = v_dp_gone_job) || ' clicks, '
           || (select count(*) from public.saved_jobs where job_id = v_dp_gone_job) || ' saves, '
           || (select count(*) from public.company_follows where company_id = v_dp_gone_company) || ' follows'
      into v_text;
    results := pg_temp.res(results, 'Deleting a company account in the dashboard: company, listing, contact, and the clicks, saves and follows on it go too',
                           '0 company, 0 job, 0 contact, 0 clicks, 0 saves, 0 follows', v_text,
                           v_text = '0 company, 0 job, 0 contact, 0 clicks, 0 saves, 0 follows');

    select count(*) || ' kept; job: ' || coalesce(string_agg(coalesce(job_id::text, 'empty'), ','), 'none')
           || '; title: ' || coalesce(string_agg(job_title, ','), 'none') || '; company: ' || coalesce(string_agg(company_name, ','), 'none')
           || '; reason: ' || coalesce(string_agg(reason, ','), 'none') || '; reporter: ' || coalesce(string_agg(case when reporter_id = v_dp_student then 'kept' else 'other' end, ','), 'none')
      into v_text from public.job_reports where details = 'Check dp report on a deleted company';
    results := pg_temp.res(results, 'Deleting a company account in the dashboard: the reports on its jobs stay as evidence, with only the job title and company name',
                           '1 kept; job: empty; title: Check job of a company deleted in the dashboard; company: Check Co (deleted in the dashboard); reason: scam; reporter: kept', v_text,
                           v_text = '1 kept; job: empty; title: Check job of a company deleted in the dashboard; company: Check Co (deleted in the dashboard); reason: scam; reporter: kept');

    select (select count(*) || ' decision(s), ' || count(admin_id) || ' with an admin, ' || count(company_id) || ' with a company'
              from public.moderation_log where note in ('Check dp decision on a deleted company', 'Check dp decision by a deleted admin')) || '; review: '
           || (select case when reviewed_by is null and reviewed_at is not null then 'kept without the reviewer' else 'other' end from public.jobs where id = v_emp_live) || '; resolution: '
           || (select case when resolved_by is null and status = 'resolved' and resolution_note is not null then 'kept without the resolver' else 'other' end
                 from public.job_reports where details = 'Check dp report')
      into v_text;
    results := pg_temp.res(results, 'Deleting an admin or a company in the dashboard: moderation decisions, reviews and resolutions stay, without them',
                           '2 decision(s), 0 with an admin, 0 with a company; review: kept without the reviewer; resolution: kept without the resolver', v_text,
                           v_text = '2 decision(s), 0 with an admin, 0 with a company; review: kept without the reviewer; resolution: kept without the resolver');

    -- Every column in public that points at an account, and how many rows
    -- still point at the three deleted ones.
    v_n := 0;
    for t in
      select c.conrelid::regclass::text tbl, a.attname::text col
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
        and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
    loop
      execute format('select count(*) from %s where %I = any ($1)', t.tbl, t.col)
        into v_count using array[v_dp_gone, v_dp_gone_owner, v_dp_gone_admin];
      v_n := v_n + v_count;
    end loop;
    results := pg_temp.res(results, 'Nothing in public still points at a user deleted in the dashboard', '0 rows', v_n || ' rows', v_n = 0);

    select 'emptied: ' || coalesce(string_agg(x.ref, ', ' order by x.ref) filter (where x.rule = 'n'), 'none')
           || '; blocking: ' || coalesce(string_agg(x.ref, ', ' order by x.ref) filter (where x.rule not in ('c', 'n')), 'none')
      into v_text
    from (
      select c.conrelid::regclass::text || '.' || a.attname as ref, c.confdeltype::text as rule
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.contype = 'f' and c.connamespace = 'public'::regnamespace
        and c.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
    ) x;
    results := pg_temp.res(results, 'Every reference to an account is deleted with it, except these kept without the person; nothing blocks deleting a user',
                           'emptied: job_clicks.user_id, job_reports.reporter_id, job_reports.resolved_by, jobs.reviewed_by, moderation_log.admin_id; blocking: none',
                           v_text, v_text = 'emptied: job_clicks.user_id, job_reports.reporter_id, job_reports.resolved_by, jobs.reviewed_by, moderation_log.admin_id; blocking: none');

    -- Reports outlive the job -----------------------------------------------

    select case when has_function_privilege('anon', 'public.job_reports_keep_job()', 'EXECUTE')
                  or has_function_privilege('authenticated', 'public.job_reports_keep_job()', 'EXECUTE')
                  or has_function_privilege('anon', 'public.job_reports_keep_company()', 'EXECUTE')
                  or has_function_privilege('authenticated', 'public.job_reports_keep_company()', 'EXECUTE')
                then 'callable' else 'not callable' end
           || ', ' || (select count(*) from pg_trigger where not tgisinternal
                         and tgname in ('job_reports_keep_job', 'job_reports_keep_company')) || ' triggers'
      into v_text;
    results := pg_temp.res(results, 'Reports are kept by two triggers whose functions nobody can call',
                           'not callable, 2 triggers', v_text, v_text = 'not callable, 2 triggers');

    -- A live job of v_emp's company, reported by the student, then taken back
    -- to draft and deleted by its owner through the API.
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min, description)
      values (v_co_emp, 'Check reported then deleted', 'gig', 5, 'published', 1, array['flexible'], 'hour', 10, 'Check description')
      returning id into v_kr_job;
    insert into public.job_reports (job_id, reporter_id, reason, details) values (v_kr_job, v_dp_student, 'misleading', 'Check report on a deleted job');
    update public.jobs set status = 'draft' where id = v_kr_job;
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      delete from public.jobs where id = v_kr_job;
      perform set_config('role', 'none', true);
      v_err := 'deleted';
    exception when others then v_err := 'error: ' || sqlerrm;
    end;
    select v_err || ', job ' || case when exists (select 1 from public.jobs where id = v_kr_job) then 'still there' else 'gone' end
           || '; report: ' || coalesce((select coalesce(job_id::text, 'no job') || ', ' || coalesce(job_title, 'no title') || ', ' || coalesce(company_name, 'no company')
                                          || ', ' || reason || ', ' || status
                                        from public.job_reports where details = 'Check report on a deleted job'), 'gone')
      into v_text;
    results := pg_temp.res(results, 'An owner deletes a reported job: the report stays, with only the job title and company name',
                           'deleted, job gone; report: no job, Check reported then deleted, Check Emp, misleading, open', v_text,
                           v_text = 'deleted, job gone; report: no job, Check reported then deleted, Check Emp, misleading, open');

    v_text := pg_temp.seen_as(v_dp_student, 'select count(*) from public.my_reports() where job_id is null and job_title = ''Check reported then deleted''');
    results := pg_temp.res(results, 'my_reports still lists the student''s report on a deleted job, with its title', '1', v_text, v_text = '1');

    select count(*) into v_n from public.job_reports where job_id is null and status = 'open' and details = 'Check report on a deleted job';
    v_text := pg_temp.seen_as(v_other, 'select count(*) from public.job_reports where job_id is null and details = ''Check report on a deleted job''');
    results := pg_temp.res(results, 'An admin still reads the report on a deleted job (it stays open until resolved)',
                           '1', v_text, v_text = '1' and v_n = 1);

    -- When a job ended ------------------------------------------------------

    select coalesce(string_agg(r || ':' || pr, ', '), 'none') into v_text
    from unnest(array['anon', 'authenticated']) r, unnest(array['SELECT', 'INSERT', 'UPDATE']) pr
    where has_column_privilege(r, 'public.jobs', 'ended_at', pr);
    results := pg_temp.res(results, 'Nobody reads or writes jobs.ended_at through the API', 'none', v_text, v_text = 'none');

    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min)
      values (v_co_emp, 'Check dp draft', 'gig', 5, 'draft', 1, array['flexible'], 'hour', 10) returning id into v_rt_draft;
    v_text := '';
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set status = 'closed' where id = v_rt_draft;
      perform set_config('role', 'none', true);
      select 'closed: ' || case when ended_at = now() then 'now' else coalesce(ended_at::text, 'empty') end into v_text from public.jobs where id = v_rt_draft;
      perform set_config('request.jwt.claims', jsonb_build_object('sub', v_emp, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      update public.jobs set status = 'draft' where id = v_rt_draft;
      perform set_config('role', 'none', true);
      select v_text || ', back to draft: ' || coalesce(ended_at::text, 'empty') into v_text from public.jobs where id = v_rt_draft;
    exception when others then v_text := v_text || ' error: ' || sqlerrm;
    end;
    results := pg_temp.res(results, 'Closing a job records when it ended; reopening it clears that',
                           'closed: now, back to draft: empty', v_text, v_text = 'closed: now, back to draft: empty');

    -- Retention: the three periods ------------------------------------------

    -- Accounts: 1, 2 never finished signing up (no login for 40 days);
    -- 3 logged in 10 days ago; 4 has a name; 5 accepted the Terms; 6 owns a
    -- company; 7 is an admin; 8 signed up 5 days ago.
    insert into auth.users (id, email, created_at, last_sign_in_at) values
      (v_su[1], 'su.never@check-signup.example', now() - interval '40 days', null),
      (v_su[2], 'su.old@studbocconi.it',         now() - interval '45 days', now() - interval '40 days'),
      (v_su[3], 'su.recent@studbocconi.it',      now() - interval '60 days', now() - interval '10 days'),
      (v_su[4], 'su.named@studbocconi.it',       now() - interval '40 days', now() - interval '40 days'),
      (v_su[5], 'su.terms@check-signup.example', now() - interval '40 days', now() - interval '40 days'),
      (v_su[6], 'su.owner@check-signup.example', now() - interval '40 days', now() - interval '40 days'),
      (v_su[7], 'su.admin@check-signup.example', now() - interval '40 days', now() - interval '40 days'),
      (v_su[8], 'su.new@check-signup.example',   now() - interval '5 days',  null);
    update public.profiles set full_name = 'Check Named' where id = v_su[4];
    update public.profiles set terms_version = '2.0', terms_accepted_at = now() - interval '40 days' where id = v_su[5];
    insert into public.companies (owner_id, name) values (v_su[6], 'Check Co (signed up 40 days ago)');
    insert into public.admins (user_id) values (v_su[7]);

    -- Listings: closed 100 days ago, expired 100 days ago, closed 100 days
    -- ago but reported, closed 10 days ago. Each with a contact; the first
    -- two saved, the first with an apply click and an exact pin.
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min,
                             description, pay, location, latitude, longitude, show_exact_location)
      values (v_co_emp, 'Check dp closed long ago', 'gig', 5, 'closed', 1, array['flexible'], 'hour', 10,
              'Check description', 'Check pay note', 'Via Check 1', 45.4601, 9.1901, true) returning id into v_rt_closed;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min, description, expires_at)
      values (v_co_emp, 'Check dp expired long ago', 'gig', 5, 'published', 1, array['flexible'], 'hour', 10, 'Check description', now() - interval '100 days')
      returning id into v_rt_expired;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min, description)
      values (v_co_emp, 'Check dp reported, closed long ago', 'gig', 5, 'closed', 1, array['flexible'], 'hour', 10, 'Check description')
      returning id into v_rt_reported;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, area_id, schedule, pay_unit, pay_min, description)
      values (v_co_emp, 'Check dp closed recently', 'gig', 5, 'closed', 1, array['flexible'], 'hour', 10, 'Check description')
      returning id into v_rt_recent;
    update public.jobs set ended_at = now() - interval '100 days' where id in (v_rt_closed, v_rt_reported);
    update public.jobs set ended_at = now() - interval '10 days' where id = v_rt_recent;
    insert into public.job_contacts (job_id, apply_url) values
      (v_rt_closed, 'https://check.example/rt1'), (v_rt_expired, 'https://check.example/rt2'),
      (v_rt_reported, 'https://check.example/rt3'), (v_rt_recent, 'https://check.example/rt4');
    insert into public.saved_jobs (user_id, job_id) values (v_dp_student, v_rt_closed), (v_dp_student, v_rt_expired);
    insert into public.job_clicks (job_id, user_id) values (v_rt_closed, v_dp_student);
    insert into public.job_reports (job_id, reporter_id, reason, details) values (v_rt_reported, v_dp_student, 'scam', 'Check dp retention report');

    -- Apply clicks on the live job: 200 days old, 10 days old, and 200 days
    -- old from an account already deleted.
    insert into public.job_clicks (job_id, user_id, created_at) values (v_job_live, v_dp_student, now() - interval '200 days') returning id into v_rt_click_old;
    insert into public.job_clicks (job_id, user_id, created_at) values (v_job_live, v_dp_student, now() - interval '10 days') returning id into v_rt_click_new;
    insert into public.job_clicks (job_id, user_id, created_at) values (v_job_live, null, now() - interval '199 days 3 hours') returning id into v_rt_click_orphan;
    select count(*) into v_n from public.job_clicks where job_id = v_job_live;

    -- Reports resolved 731 and 700 days ago.
    insert into public.job_reports (job_id, reporter_id, reason, details, status, resolution_note, resolved_at, created_at) values
      (v_job_live, null, 'other', 'Check rt resolved 731 days ago', 'resolved', 'Check note', now() - interval '731 days', now() - interval '740 days'),
      (v_job_live, null, 'other', 'Check rt resolved 700 days ago', 'resolved', 'Check note', now() - interval '700 days', now() - interval '710 days');

    -- The periods as the migrations set them.
    update public.retention_settings set incomplete_signups_days = 29, ended_job_details_days = 89, click_anonymize_days = 179,
                                         resolved_reports_days = 730, ended_jobs_days = null, feedback_days = null, inactive_accounts_days = null
      where id = 1;
    perform public.run_retention();

    select (select count(*) from public.job_reports where details = 'Check rt resolved 731 days ago') || ' resolved over 730 days ago, '
           || (select count(*) from public.job_reports where details = 'Check rt resolved 700 days ago') || ' resolved 700 days ago, '
           || (select count(*) from public.job_reports where details = 'Check dp retention report' and status = 'open') || ' open'
      into v_text;
    results := pg_temp.res(results, 'Retention: resolved reports are deleted 730 days (24 months) after resolution; newer and open ones stay',
                           '0 resolved over 730 days ago, 1 resolved 700 days ago, 1 open', v_text,
                           v_text = '0 resolved over 730 days ago, 1 resolved 700 days ago, 1 open');

    select (select count(*) from auth.users where id in (v_su[1], v_su[2])) || ' users, '
           || (select count(*) from public.profiles where id in (v_su[1], v_su[2])) || ' profiles left'
      into v_text;
    results := pg_temp.res(results, 'Retention: sign-ups never finished (no Terms, no name, no company), with no login for 29 days, are deleted',
                           '0 users, 0 profiles left', v_text, v_text = '0 users, 0 profiles left');

    select count(*) || ' of 6 kept' into v_text from auth.users where id = any (v_su[3:8]);
    results := pg_temp.res(results, 'Retention: kept if logged in within 29 days, named, Terms accepted, owning a company, admin, or newer than 29 days',
                           '6 of 6 kept', v_text, v_text = '6 of 6 kept');

    select (select count(*) from public.job_contacts where job_id in (v_rt_closed, v_rt_expired)) || ' contacts, '
           || (select count(*) from public.saved_jobs where job_id in (v_rt_closed, v_rt_expired)) || ' saves, '
           || (select count(*) from public.jobs where id in (v_rt_closed, v_rt_expired)
                 and description is null and pay is null and location is null and not show_exact_location
                 and nearest_station_id is null and latitude is distinct from 45.4601) || ' of 2 without details'
      into v_text;
    results := pg_temp.res(results, 'Retention: a listing closed or expired over 89 days ago loses its contact, saves, description, pay note, free-text location and pin',
                           '0 contacts, 0 saves, 2 of 2 without details', v_text, v_text = '0 contacts, 0 saves, 2 of 2 without details');

    select (select count(*) from public.jobs where id in (v_rt_closed, v_rt_expired) and title like 'Check dp % long ago') || ' listings with their title, '
           || (select count(*) from public.job_clicks where job_id = v_rt_closed) || ' apply click'
      into v_text;
    results := pg_temp.res(results, 'Retention: the listing itself stays (title, company, status, dates, pay, area) with its apply clicks',
                           '2 listings with their title, 1 apply click', v_text, v_text = '2 listings with their title, 1 apply click');

    select (select count(*) from public.job_contacts where job_id in (v_rt_reported, v_rt_recent, v_job_live)) || ' contacts, '
           || (select count(*) from public.jobs where id in (v_rt_reported, v_rt_recent) and description = 'Check description') || ' descriptions kept'
      into v_text;
    results := pg_temp.res(results, 'Retention: reported listings, listings ended under 89 days ago and live listings are left alone',
                           '3 contacts, 2 descriptions kept', v_text, v_text = '3 contacts, 2 descriptions kept');

    select string_agg(case when user_id is null then 'no student' else 'student' end || ', '
                      || case when created_at = date_trunc('day', created_at) then 'day only' else 'exact time' end,
                      '; ' order by array_position(array[v_rt_click_old, v_rt_click_orphan, v_rt_click_new], id))
      into v_text from public.job_clicks where id in (v_rt_click_old, v_rt_click_orphan, v_rt_click_new);
    results := pg_temp.res(results, 'Retention: apply clicks older than 179 days lose the student for good and keep only the day; newer ones are untouched',
                           'no student, day only; no student, day only; student, exact time', v_text,
                           v_text = 'no student, day only; no student, day only; student, exact time');

    select (select count(*) from public.job_clicks where job_id = v_job_live) || ' (was ' || v_n || '), owner sees '
           || pg_temp.seen_as(v_other, format('select apply_clicks from public.my_job_stats() where job_id = %L', v_job_live))
      into v_text;
    results := pg_temp.res(results, 'Retention: the number of apply clicks employers see doesn''t change',
                           v_n || ' (was ' || v_n || '), owner sees ' || v_n, v_text, v_text = v_n || ' (was ' || v_n || '), owner sees ' || v_n);

    select public.run_retention() into v_json;
    select case when count(*) = 9 and bool_and(value = '0') then 'all 0' else v_json::text end into v_text from jsonb_each_text(v_json);
    results := pg_temp.res(results, 'Retention: running it again changes nothing', 'all 0', v_text, v_text = 'all 0');

    -- ----------------------------------------------------------------------
    -- Undo everything above
    -- ----------------------------------------------------------------------
    raise exception 'gigome_security_check_rollback';
  exception when others then
    perform set_config('role', 'none', true);
    if sqlerrm <> 'gigome_security_check_rollback' then
      results := results || jsonb_build_array(jsonb_build_object(
        'n', jsonb_array_length(results) + 1, 'check_name', 'Script ran to the end',
        'expected', 'no error', 'actual', 'error: ' || sqlerrm, 'passed', false));
    end if;
  end;

  perform set_config('gigome.security_check', results::text, false);
end
$check$;

select r ->> 'check_name'           as check_name,
       r ->> 'expected'             as expected,
       r ->> 'actual'               as actual,
       (r ->> 'passed')::boolean    as passed
from jsonb_array_elements(current_setting('gigome.security_check')::jsonb) as r
order by (r ->> 'n')::int;
