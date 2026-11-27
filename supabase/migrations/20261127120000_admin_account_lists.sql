-- /admin: read-only lists of student and employer accounts.
--
-- Two functions, admins only, that read and never write (stable, no
-- inserts, updates or deletes): newest sign-ups first, an optional search
-- (plain text, matched anywhere, capitals ignored; % and _ are not
-- wildcards) and pagination (p_limit 1 to 100 rows, from p_offset). Every
-- row carries `total`, the number of matches before pagination.
-- No table, column, policy or data changes.

-- Students: email, name, university (a listed one, or the name typed under
-- "Other"), how they signed up (student_verification), sign-up and last
-- login time. Search matches email, name and university.
create function public.admin_list_students(p_search text default null, p_offset integer default 0, p_limit integer default 25)
returns table (
  id               uuid,
  email            text,
  full_name        text,
  university       text,
  other_university text,
  verification     text,
  signed_up_at     timestamptz,
  last_login_at    timestamptz,
  total            bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := lower(btrim(left(coalesce(p_search, ''), 200)));
begin
  if not public.is_admin() then
    raise exception 'Only admins can read the account lists.' using errcode = '42501';
  end if;
  return query
  select p.id, u.email::text, p.full_name, un.name, p.other_university, p.student_verification,
         coalesce(u.created_at, p.created_at), u.last_sign_in_at,
         count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.universities un on un.id = p.university_id
  where p.account_type = 'student'
    and (v_q = ''
         or strpos(lower(coalesce(u.email::text, '')), v_q) > 0
         or strpos(lower(coalesce(p.full_name, '')), v_q) > 0
         or strpos(lower(coalesce(un.name, '')), v_q) > 0
         or strpos(lower(coalesce(p.other_university, '')), v_q) > 0)
  order by coalesce(u.created_at, p.created_at) desc, p.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
end;
$$;

-- Employers: every company account, with its company if it made one (name,
-- status, how many jobs and how many are live) or none yet, the email it
-- logs in with, sign-up and last login time. Example companies have no
-- account, so they never appear. Search matches email and company name.
create function public.admin_list_employers(p_search text default null, p_offset integer default 0, p_limit integer default 25)
returns table (
  id             uuid,
  email          text,
  company_id     uuid,
  company_name   text,
  company_status text,
  jobs           bigint,
  live_jobs      bigint,
  signed_up_at   timestamptz,
  last_login_at  timestamptz,
  total          bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := lower(btrim(left(coalesce(p_search, ''), 200)));
begin
  if not public.is_admin() then
    raise exception 'Only admins can read the account lists.' using errcode = '42501';
  end if;
  return query
  select p.id, u.email::text, c.id, c.name, c.status,
         (select count(*) from public.jobs j where j.company_id = c.id),
         (select count(*) from public.jobs j
          where j.company_id = c.id and j.status = 'published' and j.expires_at > now() and c.status = 'approved'),
         coalesce(u.created_at, p.created_at), u.last_sign_in_at,
         count(*) over ()
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.companies c on c.owner_id = p.id
  where p.account_type = 'company'
    and (v_q = ''
         or strpos(lower(coalesce(u.email::text, '')), v_q) > 0
         or strpos(lower(coalesce(c.name, '')), v_q) > 0)
  order by coalesce(u.created_at, p.created_at) desc, p.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 25), 1), 100);
end;
$$;

revoke all on function public.admin_list_students(text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_list_students(text, integer, integer) to authenticated;
revoke all on function public.admin_list_employers(text, integer, integer) from public, anon, authenticated;
grant execute on function public.admin_list_employers(text, integer, integer) to authenticated;
