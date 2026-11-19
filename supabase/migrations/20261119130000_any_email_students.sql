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
-- capitals and extra spaces; the spelling shown is the most common one), so
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
  select mode() within group (order by p.other_university), count(*)
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
