-- GigoMe: initial database schema.
--
-- Applied automatically by Supabase's GitHub integration when this file is
-- merged into main. Read SUPABASE.md for the same rules in plain English.
--
-- Security model, in short:
--   * RLS is enabled on every table here, explicitly.
--   * Privileges are revoked first and then granted to anon / authenticated
--     column by column, so the result is the same whether or not the project
--     exposes new tables automatically.
--   * admins and job_contacts get no privileges at all: they are only reached
--     through SECURITY DEFINER functions.
--   * Every SECURITY DEFINER function has search_path = '' and EXECUTE only
--     for the roles that need it (PUBLIC's default EXECUTE is revoked).


-- ===========================================================================
-- Tables
-- ===========================================================================

-- Universities whose students get a student account. Edited in the dashboard.
create table public.universities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique check (char_length(btrim(name)) between 1 and 200),
  email_domains text[] not null default '{}',
  created_at    timestamptz not null default now()
);
alter table public.universities enable row level security;

-- One row per auth user, created by the on_auth_user_created trigger below.
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  account_type    text not null check (account_type in ('student', 'company')),
  university_id   uuid references public.universities (id) on delete set null,
  full_name       text check (char_length(full_name) <= 120),
  degree_level    text check (degree_level in ('bachelor', 'master', 'single_cycle', 'phd', 'exchange', 'other')),
  graduation_year integer check (graduation_year between 1990 and 2100),
  created_at      timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Admin users. Added and removed in the dashboard only; no API access.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

-- Employers. One company per account.
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null unique default auth.uid() references public.profiles (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 120),
  website       text check (char_length(website) <= 300),
  description   text check (char_length(description) <= 5000),
  contact_email text check (char_length(contact_email) <= 254 and contact_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz not null default now()
);
alter table public.companies enable row level security;

create table public.jobs (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  title          text not null check (char_length(btrim(title)) between 1 and 120),
  description    text check (char_length(description) <= 10000),
  job_type       text not null check (job_type in ('gig', 'part_time', 'internship', 'other')),
  location       text check (char_length(location) <= 200),
  remote         boolean not null default false,
  hours_per_week integer not null check (hours_per_week between 1 and 40),
  pay            text check (char_length(pay) <= 200),
  italian_level  text not null default 'none' check (italian_level in ('none', 'basic', 'fluent')),
  start_date     date,
  expires_at     timestamptz not null default (now() + interval '60 days'),
  status         text not null default 'draft' check (status in ('draft', 'pending', 'published', 'closed')),
  created_at     timestamptz not null default now()
);
alter table public.jobs enable row level security;
create index jobs_company_id_idx on public.jobs (company_id);
create index jobs_status_expires_at_idx on public.jobs (status, expires_at);

-- How to apply. Never read directly: students get it from reveal_job_contact(),
-- owners write it with set_job_contact() and read it with get_own_job_contact().
create table public.job_contacts (
  job_id      uuid primary key references public.jobs (id) on delete cascade,
  apply_url   text check (char_length(apply_url) <= 500 and apply_url ~* '^https?://[^[:space:]]+$'),
  apply_email text check (char_length(apply_email) <= 254 and apply_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint job_contacts_url_or_email check (apply_url is not null or apply_email is not null)
);
alter table public.job_contacts enable row level security;

-- One row each time a student reveals a job's contact. Written only by reveal_job_contact().
create table public.job_clicks (
  id         bigint generated always as identity primary key,
  job_id     uuid not null references public.jobs (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.job_clicks enable row level security;
create index job_clicks_job_id_idx on public.job_clicks (job_id);

create table public.feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  page       text check (char_length(page) <= 200),
  message    text not null check (char_length(btrim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;


-- ===========================================================================
-- Seed data
-- ===========================================================================

insert into public.universities (name, email_domains)
values ('Bocconi University', array['studbocconi.it']);


-- ===========================================================================
-- Helper functions
-- ===========================================================================

-- True when the signed-in user is in public.admins.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

-- 'student', 'company', or null when signed out.
create function public.current_account_type()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.account_type from public.profiles p where p.id = (select auth.uid());
$$;

-- The university an email address belongs to: everything after the last @,
-- lowercased, must exactly match one of the university's email_domains.
create function public.university_for_email(p_email text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select u.id
  from public.universities u
  where exists (
    select 1 from unnest(u.email_domains) as d(domain)
    where lower(btrim(d.domain)) = lower(substring(p_email from '@([^@]+)$'))
  )
  order by u.created_at
  limit 1;
$$;


-- ===========================================================================
-- New users get a profile
-- ===========================================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_university uuid := public.university_for_email(new.email);
begin
  insert into public.profiles (id, account_type, university_id)
  values (new.id, case when v_university is null then 'company' else 'student' end, v_university)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users who signed up before this migration get a profile too.
insert into public.profiles (id, account_type, university_id)
select u.id,
       case when public.university_for_email(u.email) is null then 'company' else 'student' end,
       public.university_for_email(u.email)
from auth.users u
on conflict (id) do nothing;


-- ===========================================================================
-- Functions called from the app
-- ===========================================================================

-- Students only: returns how to apply for a live job and records the click.
create function public.reveal_job_contact(p_job_id uuid)
returns table (apply_url text, apply_email text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Sign in to see how to apply.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_user and p.account_type = 'student') then
    raise exception 'Only student accounts can see how to apply.' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = p_job_id
      and j.status = 'published'
      and j.expires_at > now()
      and c.status = 'approved'
  ) then
    raise exception 'This job is not available.' using errcode = 'P0002';
  end if;

  insert into public.job_clicks (job_id, user_id) values (p_job_id, v_user);

  return query
    select jc.apply_url, jc.apply_email from public.job_contacts jc where jc.job_id = p_job_id;
end;
$$;

-- Owners only: set how students apply to one of their jobs. Passing two
-- nulls removes the contact.
create function public.set_job_contact(p_job_id uuid, p_apply_url text, p_apply_email text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.id = p_job_id and c.owner_id = (select auth.uid())
  ) then
    raise exception 'You can only set the contact for your own jobs.' using errcode = '42501';
  end if;

  if nullif(btrim(p_apply_url), '') is null and nullif(btrim(p_apply_email), '') is null then
    delete from public.job_contacts where job_id = p_job_id;
    return;
  end if;

  insert into public.job_contacts (job_id, apply_url, apply_email)
  values (p_job_id, nullif(btrim(p_apply_url), ''), nullif(btrim(p_apply_email), ''))
  on conflict (job_id) do update
    set apply_url = excluded.apply_url,
        apply_email = excluded.apply_email;
end;
$$;

-- Owners only: read back the contact of one of their jobs.
create function public.get_own_job_contact(p_job_id uuid)
returns table (apply_url text, apply_email text)
language sql
stable
security definer
set search_path = ''
as $$
  select jc.apply_url, jc.apply_email
  from public.job_contacts jc
  join public.jobs j on j.id = jc.job_id
  join public.companies c on c.id = j.company_id
  where jc.job_id = p_job_id and c.owner_id = (select auth.uid());
$$;

-- Admins only: approve or reject a company.
create function public.admin_set_company_status(p_company_id uuid, p_status text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change a company''s status.' using errcode = '42501';
  end if;
  update public.companies set status = p_status where id = p_company_id;
  if not found then
    raise exception 'Company not found.' using errcode = 'P0002';
  end if;
end;
$$;

-- Admins only: set any job status, including published.
create function public.admin_set_job_status(p_job_id uuid, p_status text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change a job to this status.' using errcode = '42501';
  end if;
  update public.jobs set status = p_status where id = p_job_id;
  if not found then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;
end;
$$;


-- ===========================================================================
-- Function privileges: nothing by default, then only what each role needs
-- ===========================================================================

revoke all on function
  public.is_admin(),
  public.current_account_type(),
  public.university_for_email(text),
  public.handle_new_user(),
  public.reveal_job_contact(uuid),
  public.set_job_contact(uuid, text, text),
  public.get_own_job_contact(uuid),
  public.admin_set_company_status(uuid, text),
  public.admin_set_job_status(uuid, text)
from public, anon, authenticated;

-- Used inside RLS policies that apply to signed-in users.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_account_type() to authenticated;
-- Called from the app by signed-in users; each checks who is calling.
grant execute on function public.reveal_job_contact(uuid) to authenticated;
grant execute on function public.set_job_contact(uuid, text, text) to authenticated;
grant execute on function public.get_own_job_contact(uuid) to authenticated;
grant execute on function public.admin_set_company_status(uuid, text) to authenticated;
grant execute on function public.admin_set_job_status(uuid, text) to authenticated;
-- university_for_email and handle_new_user: internal only, no grants.


-- ===========================================================================
-- Table privileges: revoke everything, then grant exactly what is needed
-- ===========================================================================

revoke all on table
  public.universities, public.profiles, public.admins, public.companies,
  public.jobs, public.job_contacts, public.job_clicks, public.feedback
from public, anon, authenticated;

-- universities: readable by everyone
grant select on table public.universities to anon, authenticated;

-- profiles: signed-in users read their own row and edit three fields
grant select on table public.profiles to authenticated;
grant update (full_name, degree_level, graduation_year) on table public.profiles to authenticated;

-- admins: no grants

-- companies: everyone reads (RLS: approved only); owners create and edit,
-- but never owner_id or status
grant select on table public.companies to anon, authenticated;
grant insert (name, website, description, contact_email) on table public.companies to authenticated;
grant update (name, website, description, contact_email) on table public.companies to authenticated;

-- jobs: everyone reads (RLS: live jobs only); owners create, edit and delete
-- (RLS: never published, and only their own)
grant select on table public.jobs to anon, authenticated;
grant insert (company_id, title, description, job_type, location, remote, hours_per_week,
              pay, italian_level, start_date, expires_at, status)
  on table public.jobs to authenticated;
grant update (title, description, job_type, location, remote, hours_per_week,
              pay, italian_level, start_date, expires_at, status)
  on table public.jobs to authenticated;
grant delete on table public.jobs to authenticated;

-- job_contacts: no grants

-- job_clicks: read by admins only (RLS)
grant select on table public.job_clicks to authenticated;

-- feedback: signed-in users write; admins read (RLS)
grant insert (page, message) on table public.feedback to authenticated;
grant select on table public.feedback to authenticated;


-- ===========================================================================
-- Row level security policies
-- ===========================================================================

-- universities
create policy "Anyone can read universities"
  on public.universities for select
  to anon, authenticated
  using (true);

-- profiles
create policy "Users read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Admins read all profiles"
  on public.profiles for select
  to authenticated
  using ((select public.is_admin()));

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- admins: no policies, so no rows are visible through the API

-- companies
create policy "Anyone can read approved companies"
  on public.companies for select
  to anon, authenticated
  using (status = 'approved');

create policy "Owners read their own company"
  on public.companies for select
  to authenticated
  using (owner_id = (select auth.uid()));

create policy "Admins read all companies"
  on public.companies for select
  to authenticated
  using ((select public.is_admin()));

create policy "Company accounts create their own company"
  on public.companies for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select public.current_account_type()) = 'company'
  );

create policy "Owners edit their own company"
  on public.companies for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- jobs
create policy "Anyone can read live jobs of approved companies"
  on public.jobs for select
  to anon, authenticated
  using (
    status = 'published'
    and expires_at > now()
    and exists (select 1 from public.companies c where c.id = company_id and c.status = 'approved')
  );

create policy "Owners read their own jobs"
  on public.jobs for select
  to authenticated
  using (exists (select 1 from public.companies c where c.id = company_id and c.owner_id = (select auth.uid())));

create policy "Admins read all jobs"
  on public.jobs for select
  to authenticated
  using ((select public.is_admin()));

create policy "Owners create jobs as draft or pending"
  on public.jobs for insert
  to authenticated
  with check (
    status in ('draft', 'pending')
    and exists (select 1 from public.companies c where c.id = company_id and c.owner_id = (select auth.uid()))
  );

create policy "Owners edit their own jobs but never publish"
  on public.jobs for update
  to authenticated
  using (exists (select 1 from public.companies c where c.id = company_id and c.owner_id = (select auth.uid())))
  with check (
    status in ('draft', 'pending', 'closed')
    and exists (select 1 from public.companies c where c.id = company_id and c.owner_id = (select auth.uid()))
  );

create policy "Owners delete their own draft jobs"
  on public.jobs for delete
  to authenticated
  using (
    status = 'draft'
    and exists (select 1 from public.companies c where c.id = company_id and c.owner_id = (select auth.uid()))
  );

-- job_contacts: no policies

-- job_clicks
create policy "Admins read job clicks"
  on public.job_clicks for select
  to authenticated
  using ((select public.is_admin()));

-- feedback
create policy "Signed-in users send feedback"
  on public.feedback for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Admins read feedback"
  on public.feedback for select
  to authenticated
  using ((select public.is_admin()));
