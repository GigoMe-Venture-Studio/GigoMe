-- Students can sign up with any email.
--
-- Until now only an email of a listed university made a student account.
-- From now on the student login accepts any email; the database records how
-- each student account came about:
--
--   university_email  the email's domain is in public.universities (exact,
--                     lowercased match, as before): the email shows they're
--                     a student of that university.
--   self_declared     any other email, signed up through the student login:
--                     they told us they're a university student and which
--                     university (declare_student, once, on /welcome).
--
-- Nobody sets these from the browser: profiles.student_verification,
-- university_id, other_university and student_declared_at have no insert or
-- update grants. The database decides the method from the email; the only
-- thing the browser says is which login was used (the student login sends
-- signup_as = student in the new user's metadata, which Supabase stores only
-- when the user is created and which handle_new_user reads only then).
--
-- One email, one role: the role is decided when the account is created and
-- never changes through the API. An email that already has a company account
-- stays a company account at the student login, and the reverse. (A company
-- account that owns no company is still upgraded when its university is
-- added, as before.)
--
-- Both kinds of students have exactly the same permissions: every rule keeps
-- checking account_type = 'student' and nothing else.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column student_verification text
    check (student_verification in ('university_email', 'self_declared')),
  -- "Other" on /welcome: the university's name as the student typed it.
  add column other_university text
    check (other_university is null or char_length(other_university) between 2 and 200),
  -- When a self-declared student answered the /welcome questions (kept if
  -- their email's university is added later and they become verified).
  add column student_declared_at timestamptz;

-- Every existing student signed up with (or was upgraded by) a listed domain.
update public.profiles set student_verification = 'university_email' where account_type = 'student';

alter table public.profiles
  add constraint profiles_student_verification
    check ((account_type = 'student') = (student_verification is not null)),
  add constraint profiles_other_university
    check (other_university is null or (student_verification = 'self_declared' and university_id is null));

-- No grants on the new columns: profiles keeps "update (full_name,
-- degree_level, graduation_year)" only. Select on profiles is table-wide
-- (each user reads their own row, admins all), so the owner reads them.

-- ---------------------------------------------------------------------------
-- Sign-up: how the account was created
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_university uuid := public.university_for_email(new.email);
  v_student boolean := v_university is not null
    or coalesce(new.raw_user_meta_data ->> 'signup_as', '') = 'student';
begin
  insert into public.profiles (id, account_type, university_id, student_verification)
  values (
    new.id,
    case when v_student then 'student' else 'company' end,
    v_university,
    case when v_university is not null then 'university_email'
         when v_student then 'self_declared' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- A university added (or a domain added to one) later
-- ---------------------------------------------------------------------------

-- As before, company accounts that own no company and whose email domain now
-- matches become students of that university. New: self-declared students
-- whose email domain now matches become verified students of it (their
-- "Other" name goes, the university replaces it). Nobody is downgraded.
create or replace function public.upgrade_profiles_for_university()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set account_type = 'student',
      university_id = new.id,
      student_verification = 'university_email',
      other_university = null
  from auth.users u
  where u.id = p.id
    and (
      (p.account_type = 'company' and not exists (select 1 from public.companies c where c.owner_id = p.id))
      or (p.account_type = 'student' and p.student_verification = 'self_declared')
    )
    and lower(substring(u.email from '@([^@]+)$')) in (
      select lower(btrim(d.domain)) from unnest(new.email_domains) as d(domain)
    );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Changes made by hand in the Table Editor
-- ---------------------------------------------------------------------------

-- SUPABASE.md, "Move someone back to a company account": changing
-- account_type by hand keeps the student fields consistent. To company: they
-- are emptied. To student: the method comes from the email, as on sign-up.
create function public.profiles_account_type_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_university uuid;
begin
  if new.account_type = 'company' then
    new.student_verification := null;
    new.other_university := null;
    new.student_declared_at := null;
  elsif new.student_verification is null then
    select public.university_for_email(u.email) into v_university from auth.users u where u.id = new.id;
    new.student_verification := case when v_university is null then 'self_declared' else 'university_email' end;
    if v_university is not null then
      new.university_id := v_university;
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_account_type_changed
  before update of account_type on public.profiles
  for each row
  when (new.account_type is distinct from old.account_type)
  execute function public.profiles_account_type_changed();

revoke all on function public.profiles_account_type_changed() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- /welcome: a self-declared student's university, once
-- ---------------------------------------------------------------------------

-- "Which university?": one of the listed universities, or "Other" with its
-- name. Only for the caller's own account, only if it is a self-declared
-- student, and only once (to change it, they write to hello@gigome.org).
create function public.declare_student(p_university_id uuid, p_other_university text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_other text := nullif(regexp_replace(btrim(coalesce(p_other_university, '')), '\s+', ' ', 'g'), '');
  v_done int;
begin
  if v_uid is null then
    raise exception 'Log in first.' using errcode = '42501';
  end if;
  if (p_university_id is null) = (v_other is null) then
    raise exception 'Choose your university, or choose "Other" and type its name.' using errcode = '22023';
  end if;
  if p_other_university ~ '[[:cntrl:]]' or (v_other is not null and char_length(v_other) not between 2 and 200) then
    raise exception 'Type your university''s name (2 to 200 characters).' using errcode = '22023';
  end if;
  if p_university_id is not null and not exists (select 1 from public.universities u where u.id = p_university_id) then
    raise exception 'Unknown university.' using errcode = '22023';
  end if;
  update public.profiles
     set university_id = p_university_id,
         other_university = v_other,
         student_declared_at = now()
   where id = v_uid
     and account_type = 'student'
     and student_verification = 'self_declared'
     and student_declared_at is null;
  get diagnostics v_done = row_count;
  if v_done = 0 then
    raise exception 'Your university is already recorded. To change it, write to hello@gigome.org.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.declare_student(uuid, text) from public, anon, authenticated;
grant execute on function public.declare_student(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- /admin: students by verification method and university
-- ---------------------------------------------------------------------------

-- One row per method and university. university is the listed university's
-- name, 'Other' (named in admin_other_universities), or null (a
-- self-declared student who hasn't answered yet). Admins only.
create function public.admin_student_counts()
returns table (verification text, university text, students bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can read the numbers.' using errcode = '42501';
  end if;
  return query
  select p.student_verification,
         coalesce(u.name, case when p.other_university is not null then 'Other' end),
         count(*)
  from public.profiles p
  left join public.universities u on u.id = p.university_id
  where p.account_type = 'student'
  group by 1, 2
  order by 1, 3 desc, 2;
end;
$$;

-- The names typed under "Other", with how many students typed each (ignoring
-- capitals and extra spaces; the spelling shown is the most common one, and
-- on a tie the one that sorts first byte by byte, so capitals win: "Accademia"
-- over "accademia", the same on every database whatever its collation), so
-- the team can look up their student domains and add them. Admins only.
create function public.admin_other_universities()
returns table (name text, students bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can read the numbers.' using errcode = '42501';
  end if;
  return query
  select mode() within group (order by p.other_university collate "C"), count(*)
  from public.profiles p
  where p.account_type = 'student' and p.other_university is not null
  group by lower(p.other_university)
  order by 2 desc, 1;
end;
$$;

revoke all on function public.admin_student_counts() from public, anon, authenticated;
grant execute on function public.admin_student_counts() to authenticated;
revoke all on function public.admin_other_universities() from public, anon, authenticated;
grant execute on function public.admin_other_universities() to authenticated;

-- ---------------------------------------------------------------------------
-- Retention: unfinished sign-ups, whatever the verification
-- ---------------------------------------------------------------------------

-- run_retention() as in 20261111120000_data_protection.sql, with one change:
-- an unfinished sign-up is one that never completed /welcome, which for a
-- self-declared student includes answering "Which university?". Retention
-- depends on activity only, never on verification: a self-declared student
-- who completed /welcome is never deleted by the nightly job, like a
-- verified one. Inactive accounts (24 months) stay a manual task
-- (HANDOVER.md 7d); inactive_accounts_days stays empty. The periods are
-- unchanged. create or replace keeps the function's grants (none).
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
