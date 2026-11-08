-- Structured pay on jobs, for the "Minimum pay" filter and "Highest pay".
--
--   * pay_unit: hour, month, project, or unpaid_curricular ("Curricular
--     internship (university credits)", internships only, no amount).
--   * pay_min (euros, above 0) and pay_max (optional, never below pay_min)
--     for hour, month and project; none for unpaid_curricular.
--   * pay_hourly: worked out by the database, never written by anyone. For
--     hourly pay, pay_min; for monthly pay, pay_min / (hours per week x 52 /
--     12). None for per-project and unpaid jobs. A range counts as its lower
--     end, so a filter never promises more than the job guarantees.
--   * Required to submit or publish (pending, published), admins included,
--     like the area and the schedule: it fires only when status or pay
--     change, so jobs published before it keep working (/admin lists them).
--   * The free-text pay column stays, as an optional "pay note" ("+ tips").

alter table public.jobs
  add column pay_unit text
    constraint jobs_pay_unit_values check (pay_unit in ('hour', 'month', 'project', 'unpaid_curricular')),
  add column pay_min numeric(9, 2)
    constraint jobs_pay_min_positive check (pay_min > 0 and pay_min <= 100000),
  add column pay_max numeric(9, 2)
    constraint jobs_pay_max_range check (pay_max <= 100000),
  add constraint jobs_pay_max_not_below_min check (pay_max is null or pay_max >= pay_min),
  -- An amount with every paid unit, none without a unit or when unpaid.
  add constraint jobs_pay_amount_with_unit check (
    case
      when pay_unit is null or pay_unit = 'unpaid_curricular' then pay_min is null and pay_max is null
      else pay_min is not null
    end
  ),
  -- Unpaid only as a curricular internship.
  add constraint jobs_pay_unpaid_internship_only check (pay_unit is distinct from 'unpaid_curricular' or job_type = 'internship');

alter table public.jobs
  add column pay_hourly numeric(9, 2) generated always as (
    case pay_unit
      when 'hour' then pay_min
      when 'month' then round(pay_min / (hours_per_week * 52.0 / 12), 2)
    end
  ) stored;

create index jobs_pay_hourly_idx on public.jobs (pay_hourly);

create function public.job_pay_required()
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
      using errcode = '23514', hint = 'Unpaid is possible only as a curricular internship.';
  end if;
  return new;
end;
$$;

create trigger job_pay_required
  before insert or update of status, pay_unit on public.jobs
  for each row execute function public.job_pay_required();

revoke all on function public.job_pay_required() from public, anon, authenticated;
-- Trigger only, no grants.

-- Everyone who can read a job reads its pay; owners write the unit and the
-- amounts, never pay_hourly.
grant select (pay_unit, pay_min, pay_max, pay_hourly) on table public.jobs to anon, authenticated;
grant insert (pay_unit, pay_min, pay_max) on table public.jobs to authenticated;
grant update (pay_unit, pay_min, pay_max) on table public.jobs to authenticated;
