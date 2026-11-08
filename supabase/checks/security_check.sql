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

    insert into public.jobs (company_id, title, job_type, hours_per_week, status)
      values (v_co_approved, 'Check live job', 'gig', 10, 'published') returning id into v_job_live;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status)
      values (v_co_approved, 'Check draft job', 'gig', 10, 'draft') returning id into v_job_draft;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status)
      values (v_co_approved, 'Check pending job', 'gig', 10, 'pending') returning id into v_job_pending;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status)
      values (v_co_approved, 'Check closed job', 'gig', 10, 'closed') returning id into v_job_closed;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status, expires_at)
      values (v_co_approved, 'Check expired job', 'gig', 10, 'published', now() - interval '1 day') returning id into v_job_expired;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status)
      values (v_co_own, 'Check job of a pending company', 'gig', 10, 'published') returning id into v_job_unapproved;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status)
      values (v_co_own, 'Check own draft', 'part_time', 10, 'draft') returning id into v_job_own_draft;
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
    foreach v_text in array array['job_contacts', 'admins', 'feedback', 'job_clicks', 'profiles'] loop
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
      insert into public.jobs (company_id, title, job_type, hours_per_week, status)
        values (v_co_own, 'Check sneaky job', 'gig', 5, 'published');
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
    results := pg_temp.res(results, 'Company user can submit their own job for review (control)', 'updated 1 row(s)', v_err, v_err = 'updated 1 row(s)');

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
      select count(*) into v_count from public.job_clicks;
      perform set_config('role', 'none', true);
      v_err := v_count || ' rows visible';
    exception when others then v_err := 'error: ' || sqlerrm; v_count := 0;
    end;
    results := pg_temp.res(results, 'Student cannot read job_clicks', '0 rows or permission denied', v_err, v_count = 0);

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
      insert into public.companies (name) values ('Check student company');
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
    with c as (
      insert into public.job_clicks (job_id, user_id) values (v_job_live, v_leaver), (v_job_live, v_leaver) returning id
    ) select array_agg(id) into v_clicks from c;
    insert into public.companies (owner_id, name, status) values (v_leaver_co, 'Check Co (leaving)', 'approved') returning id into v_leaver_company;
    insert into public.jobs (company_id, title, job_type, hours_per_week, status)
      values (v_leaver_company, 'Check job of a leaving company', 'gig', 5, 'published') returning id into v_leaver_job;
    insert into public.job_contacts (job_id, apply_url) values (v_leaver_job, 'https://check.example/leaving');
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

    select count(*) into v_count from public.companies where id in (v_co_own, v_co_approved);
    select count(*) into v_rows from public.jobs where id = any (test_jobs);
    results := pg_temp.res(results, 'Deleting a company account leaves other companies and jobs alone',
                           '2 companies, 7 jobs', v_count || ' companies, ' || v_rows || ' jobs', v_count = 2 and v_rows = 7);

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
