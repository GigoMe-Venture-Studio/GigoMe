-- GigoMe lists only paid part-time jobs and gigs: no internships, and no
-- unpaid jobs (pay_unit 'unpaid_curricular', the "curricular internship").
--
--   * No job can be created as an internship (job_type 'internship') or
--     unpaid (pay_unit 'unpaid_curricular'), and no job can be changed to
--     either. Admins included, like the other job rules.
--   * A job that already has either value (written before this rule) can
--     still be closed, deleted, have its other details changed and be
--     cleaned up by run_retention(), but it can't be submitted or published
--     again until both are changed (type gig, part-time or other; pay per
--     hour, month or project).
--   * Why a trigger and not a check constraint: a check would refuse to be
--     added while any row still has the old values (the example listings
--     loaded on the live project, for one), and as NOT VALID it would refuse
--     every later update of such a row, closing it and the nightly
--     run_retention() included. The old values stay in the check constraints
--     (jobs_job_type_check, jobs_pay_unit_values,
--     jobs_pay_unpaid_internship_only) so existing rows stay valid; a later
--     migration can drop them once no row uses them.
--   * job_pay_required keeps its rule; only its hint, which pointed to the
--     curricular internship, goes.

create function public.job_no_internships()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.job_type = 'internship'
     and (tg_op = 'INSERT'
          or old.job_type is distinct from 'internship'
          or (new.status in ('pending', 'published') and new.status is distinct from old.status)) then
    raise exception 'GigoMe lists only paid part-time jobs and gigs, not internships. Choose gig, part-time or other as the type of job.'
      using errcode = '23514';
  end if;
  if new.pay_unit = 'unpaid_curricular'
     and (tg_op = 'INSERT'
          or old.pay_unit is distinct from 'unpaid_curricular'
          or (new.status in ('pending', 'published') and new.status is distinct from old.status)) then
    raise exception 'GigoMe lists only paid jobs. Set the pay per hour, month or project.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger job_no_internships
  before insert or update of job_type, pay_unit, status on public.jobs
  for each row execute function public.job_no_internships();

revoke all on function public.job_no_internships() from public, anon, authenticated;
-- Trigger only, no grants.

-- Same rule as before, without the hint about unpaid curricular internships.
create or replace function public.job_pay_required()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('pending', 'published') and new.pay_unit is null
     and (tg_op = 'INSERT'
          or new.status is distinct from old.status
          or new.pay_unit is distinct from old.pay_unit) then
    raise exception 'Set the pay (amount and per hour, month or project) before the job is submitted or published.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.job_pay_required() from public, anon, authenticated;
