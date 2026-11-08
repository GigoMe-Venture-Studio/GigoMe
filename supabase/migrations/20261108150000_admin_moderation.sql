-- Admin moderation and job reports.
--
--   * job_reports: logged-in users report a live job (one open report per
--     user per job). Only admins read them; they are resolved only through
--     admin_resolve_report().
--   * moderation_log: every admin decision (company approved or rejected,
--     job reviewed, report resolved) with who and when. Admins read it;
--     nobody writes it directly: the admin functions do.
--   * Admin reads that the API didn't offer yet: how to apply for a job
--     (admin_job_contact) and a company's contact and login emails
--     (admin_company_contact). Admins could already read every company and
--     job through the existing policies.


-- ===========================================================================
-- Tables
-- ===========================================================================

create table public.job_reports (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs (id) on delete cascade,
  reporter_id     uuid default auth.uid() references auth.users (id) on delete set null,
  reason          text not null check (reason in ('scam', 'illegal', 'misleading', 'discriminatory', 'other')),
  details         text check (char_length(details) <= 2000),
  created_at      timestamptz not null default now(),
  status          text not null default 'open' check (status in ('open', 'resolved')),
  resolution_note text check (char_length(resolution_note) <= 2000),
  resolved_by     uuid references auth.users (id) on delete set null,
  resolved_at     timestamptz
);
alter table public.job_reports enable row level security;
-- One open report per user per job.
create unique index job_reports_one_open_per_user on public.job_reports (job_id, reporter_id) where status = 'open';
create index job_reports_status_created_idx on public.job_reports (status, created_at);

create table public.moderation_log (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  admin_id   uuid references auth.users (id) on delete set null,
  action     text not null check (action in (
               'company_approved', 'company_rejected', 'company_pending',
               'job_published', 'job_changes_requested', 'job_rejected', 'job_closed', 'job_draft', 'job_pending',
               'report_resolved')),
  company_id uuid references public.companies (id) on delete set null,
  job_id     uuid references public.jobs (id) on delete set null,
  report_id  uuid references public.job_reports (id) on delete set null,
  note       text check (char_length(note) <= 2000)
);
alter table public.moderation_log enable row level security;
create index moderation_log_created_idx on public.moderation_log (created_at desc);


-- ===========================================================================
-- Privileges and policies
-- ===========================================================================

revoke all on table public.job_reports, public.moderation_log from public, anon, authenticated;

-- job_reports: logged-in users create (three columns); admins read (RLS).
-- No update or delete: resolving goes through admin_resolve_report().
grant insert (job_id, reason, details) on table public.job_reports to authenticated;
grant select on table public.job_reports to authenticated;

-- moderation_log: admins read (RLS). Written only by the admin functions.
grant select on table public.moderation_log to authenticated;

-- A report is the caller's own, open, and about a job they can see (RLS on
-- jobs applies inside the check: live jobs, or their own).
create policy "Logged-in users report jobs they can see"
  on public.job_reports for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open'
    and exists (select 1 from public.jobs j where j.id = job_id)
  );

create policy "Admins read job reports"
  on public.job_reports for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins read the moderation log"
  on public.moderation_log for select
  to authenticated
  using ((select public.is_admin()));


-- ===========================================================================
-- Admin functions (each checks is_admin() and writes the log)
-- ===========================================================================

create or replace function public.admin_set_company_status(p_company_id uuid, p_status text)
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
  if p_status is null or p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Unknown company status: %', p_status using errcode = '22023';
  end if;
  update public.companies set status = p_status where id = p_company_id;
  if not found then
    raise exception 'Company not found.' using errcode = 'P0002';
  end if;
  insert into public.moderation_log (admin_id, action, company_id)
  values ((select auth.uid()), 'company_' || p_status, p_company_id);
end;
$$;

create or replace function public.admin_review_job(p_job_id uuid, p_status text, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.is_admin() then
    raise exception 'Only admins can review jobs.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('draft', 'pending', 'published', 'closed', 'changes_requested', 'rejected') then
    raise exception 'Unknown job status: %', p_status using errcode = '22023';
  end if;
  if p_status in ('changes_requested', 'rejected') and v_note is null then
    raise exception 'Add a note for the employer when requesting changes or rejecting.' using errcode = '22023';
  end if;

  update public.jobs
  set status = p_status,
      review_note = v_note,
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = p_job_id;
  if not found then
    raise exception 'Job not found.' using errcode = 'P0002';
  end if;
  insert into public.moderation_log (admin_id, action, job_id, company_id, note)
  select (select auth.uid()), 'job_' || p_status, j.id, j.company_id, v_note
  from public.jobs j where j.id = p_job_id;
end;
$$;

-- Resolve an open report with a note. Unpublishing the job is a separate
-- decision (admin_review_job with 'closed').
create function public.admin_resolve_report(p_report_id uuid, p_note text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(p_note), '');
  v_job uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can resolve reports.' using errcode = '42501';
  end if;
  if v_note is null then
    raise exception 'Add a note saying how the report was resolved.' using errcode = '22023';
  end if;
  update public.job_reports
  set status = 'resolved',
      resolution_note = v_note,
      resolved_by = (select auth.uid()),
      resolved_at = now()
  where id = p_report_id and status = 'open'
  returning job_id into v_job;
  if not found then
    raise exception 'Open report not found.' using errcode = 'P0002';
  end if;
  insert into public.moderation_log (admin_id, action, report_id, job_id, note)
  values ((select auth.uid()), 'report_resolved', p_report_id, v_job, v_note);
end;
$$;

-- Admins only: how to apply for any job (to check it during review).
create function public.admin_job_contact(p_job_id uuid)
returns table (apply_url text, apply_email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can read job contacts.' using errcode = '42501';
  end if;
  return query
    select jc.apply_url, jc.apply_email from public.job_contacts jc where jc.job_id = p_job_id;
end;
$$;

-- Admins only: a company's contact email and the email its owner logs in with
-- (to judge whether the employer is who they say they are).
create function public.admin_company_contact(p_company_id uuid)
returns table (contact_email text, login_email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can read company contacts.' using errcode = '42501';
  end if;
  return query
    select c.contact_email, u.email::text
    from public.companies c
    left join auth.users u on u.id = c.owner_id
    where c.id = p_company_id;
end;
$$;


-- ===========================================================================
-- Function privileges
-- ===========================================================================

revoke all on function
  public.admin_resolve_report(uuid, text),
  public.admin_job_contact(uuid),
  public.admin_company_contact(uuid)
from public, anon, authenticated;

-- Each checks is_admin() itself.
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;
grant execute on function public.admin_job_contact(uuid) to authenticated;
grant execute on function public.admin_company_contact(uuid) to authenticated;
-- admin_set_company_status and admin_review_job keep their earlier grants
-- (create or replace keeps them): EXECUTE for authenticated only.
