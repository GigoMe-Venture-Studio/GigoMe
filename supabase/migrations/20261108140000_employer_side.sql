-- Employer side: review states for jobs, reviewer notes, owner rules and
-- apply-click numbers for company owners.
--
--   * jobs.status can also be 'changes_requested' (the owner edits and
--     resubmits) or 'rejected' (final: the owner can no longer change it).
--   * review_note, reviewed_by and reviewed_at are set only by admins, through
--     admin_review_job(). Nobody can write them through the API, and the
--     reviewer's user id (reviewed_by) can't be read through it either.
--   * Owners can prepare drafts while their company is pending, but submit
--     (status 'pending') only once the company is approved.
--   * my_job_stats(): apply clicks per job, for the caller's own jobs only.
--   * A company's contact_email is for the GigoMe team: nobody reads it
--     directly through the API any more. get_company_contact_email() returns
--     it to the company's owner and to admins. Logged-out visitors also no
--     longer read owner_id (they never needed it).


-- ===========================================================================
-- Job statuses and review fields
-- ===========================================================================

alter table public.jobs drop constraint jobs_status_check;
alter table public.jobs add constraint jobs_status_check
  check (status in ('draft', 'pending', 'published', 'closed', 'changes_requested', 'rejected'));

alter table public.jobs
  add column review_note text check (char_length(review_note) <= 2000),
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add column reviewed_at timestamptz;


-- ===========================================================================
-- Column privileges
-- ===========================================================================

-- jobs: the public columns for everyone; the review note and date for
-- logged-in users (RLS still limits them to live jobs and their own); the
-- reviewer's id for nobody. Insert and update grants are unchanged and never
-- included the review fields.
revoke select on table public.jobs from anon, authenticated;
grant select (id, company_id, title, description, job_type, location, remote, hours_per_week,
              pay, italian_level, start_date, expires_at, status, created_at)
  on table public.jobs to anon, authenticated;
grant select (review_note, reviewed_at) on table public.jobs to authenticated;

-- companies: logged-out visitors read what the job board shows; logged-in
-- users also read owner_id (owners find their own company by it). Nobody
-- reads contact_email directly: see get_company_contact_email().
revoke select on table public.companies from anon, authenticated;
grant select (id, name, website, description, status, created_at) on table public.companies to anon;
grant select (id, owner_id, name, website, description, status, created_at) on table public.companies to authenticated;


-- ===========================================================================
-- Owner rules for jobs
-- ===========================================================================

drop policy "Owners create jobs as draft or pending" on public.jobs;
create policy "Owners create drafts; submit once company is approved"
  on public.jobs for insert
  to authenticated
  with check (
    (status = 'draft'
      and exists (select 1 from public.companies c
                  where c.id = company_id and c.owner_id = (select auth.uid())))
    or (status = 'pending'
      and exists (select 1 from public.companies c
                  where c.id = company_id and c.owner_id = (select auth.uid()) and c.status = 'approved'))
  );

-- Owners edit their own jobs, except rejected ones. The new status can only be
-- draft, closed, or pending (submit, resubmit after changes were requested,
-- or send a published job back to review); pending needs an approved company.
-- They can never publish, request changes or reject.
drop policy "Owners edit their own jobs but never publish" on public.jobs;
create policy "Owners edit own jobs except rejected; never publish"
  on public.jobs for update
  to authenticated
  using (
    status <> 'rejected'
    and exists (select 1 from public.companies c
                where c.id = company_id and c.owner_id = (select auth.uid()))
  )
  with check (
    (status in ('draft', 'closed')
      and exists (select 1 from public.companies c
                  where c.id = company_id and c.owner_id = (select auth.uid())))
    or (status = 'pending'
      and exists (select 1 from public.companies c
                  where c.id = company_id and c.owner_id = (select auth.uid()) and c.status = 'approved'))
  );


-- ===========================================================================
-- Admin review
-- ===========================================================================

-- Admins only: set a job's status and record the review. A note is required
-- to request changes or reject; publishing clears any earlier note unless a
-- new one is given.
create function public.admin_review_job(p_job_id uuid, p_status text, p_note text)
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
end;
$$;

-- The older two-argument version now records the review too (no note).
create or replace function public.admin_set_job_status(p_job_id uuid, p_status text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.admin_review_job(p_job_id, p_status, null);
end;
$$;


-- ===========================================================================
-- Apply clicks for owners
-- ===========================================================================

-- The caller's own jobs and how many times students opened "How to apply" on
-- each. Other companies' jobs are never included.
create function public.my_job_stats()
returns table (job_id uuid, apply_clicks bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select j.id, count(k.id)
  from public.jobs j
  join public.companies c on c.id = j.company_id
  left join public.job_clicks k on k.job_id = j.id
  where c.owner_id = (select auth.uid())
  group by j.id;
$$;


-- ===========================================================================
-- Company contact email, for the owner and admins
-- ===========================================================================

create function public.get_company_contact_email(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.contact_email
  from public.companies c
  where c.id = p_company_id
    and (c.owner_id = (select auth.uid()) or (select public.is_admin()));
$$;


-- ===========================================================================
-- Function privileges
-- ===========================================================================

revoke all on function
  public.admin_review_job(uuid, text, text),
  public.my_job_stats(),
  public.get_company_contact_email(uuid)
from public, anon, authenticated;

-- Each checks who is calling.
grant execute on function public.admin_review_job(uuid, text, text) to authenticated;
grant execute on function public.my_job_stats() to authenticated;
grant execute on function public.get_company_contact_email(uuid) to authenticated;
