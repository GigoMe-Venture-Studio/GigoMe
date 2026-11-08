-- Part 1: when a job happens (schedule).
--
--   * jobs.schedule: any of weekday_mornings, weekday_afternoons,
--     weekday_evenings, weekends, flexible. Stored sorted, without repeats.
--   * Required to submit or publish a job (pending, published), like the
--     area for on-site jobs: a job can't enter review or publication without
--     one, or lose it while there. Drafts are free. The rule fires only when
--     status or schedule change, so jobs published before it keep working
--     (/admin lists them).
--   * Everyone who can read a job reads its schedule; owners write it.

alter table public.jobs
  add column schedule text[] not null default '{}'
    constraint jobs_schedule_values check (
      schedule <@ array['weekday_mornings', 'weekday_afternoons', 'weekday_evenings', 'weekends', 'flexible']::text[]
    );

create index jobs_schedule_idx on public.jobs using gin (schedule);

create function public.job_schedule_required()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Sorted, no repeats.
  new.schedule := coalesce(array(select distinct s from unnest(new.schedule) s order by s), '{}');
  if new.status in ('pending', 'published') and cardinality(new.schedule) = 0
     and (tg_op = 'INSERT'
          or new.status is distinct from old.status
          or new.schedule is distinct from old.schedule) then
    raise exception 'Choose when the job happens before it is submitted or published.'
      using errcode = '23514', hint = 'Weekday mornings, afternoons, evenings, weekends or flexible.';
  end if;
  return new;
end;
$$;

create trigger job_schedule_required
  before insert or update of status, schedule on public.jobs
  for each row execute function public.job_schedule_required();

revoke all on function public.job_schedule_required() from public, anon, authenticated;
-- Trigger only, no grants.

grant select (schedule) on table public.jobs to anon, authenticated;
grant insert (schedule) on table public.jobs to authenticated;
grant update (schedule) on table public.jobs to authenticated;
