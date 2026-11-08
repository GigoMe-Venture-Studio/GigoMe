-- An on-site job needs an area before it can be reviewed or published.
--
--   * A job that is not remote can't be submitted (status pending) or
--     published without an area_id, and a job that is pending or published
--     can't lose its area or stop being remote without one. Drafts and
--     remote jobs are free. The exact pin stays optional.
--   * The rule applies when one of those columns changes, not to every
--     update: live jobs created before areas existed keep working (they can
--     be edited as drafts, closed, and touched by data migrations), and
--     /admin lists them so an admin can ask for an area.
--   * Admins are held to it too: admin_review_job can't publish an on-site
--     job without an area; request changes instead.

create function public.job_area_required()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('pending', 'published') and not new.remote and new.area_id is null
     and (tg_op = 'INSERT'
          or new.status is distinct from old.status
          or new.remote is distinct from old.remote
          or new.area_id is distinct from old.area_id) then
    raise exception 'An on-site job needs an area before it is submitted or published.'
      using errcode = '23514', hint = 'Choose the area, or "Elsewhere in Milan".';
  end if;
  return new;
end;
$$;

create trigger job_area_required
  before insert or update of status, remote, area_id on public.jobs
  for each row execute function public.job_area_required();

revoke all on function public.job_area_required() from public, anon, authenticated;
-- Trigger only, no grants.
