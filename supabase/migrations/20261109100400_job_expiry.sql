-- How long jobs stay live.
--
--   * A non-admin (an owner) can set expires_at at most 61 days ahead (60
--     days plus the rest of the last day, as the job form ends a date at
--     23:59). Admins and the database itself are free.
--   * extend_my_job(job_id): "Extend by 60 days" on the dashboard. Only the
--     owner, only on a published job of an approved company, sets the expiry
--     to exactly 60 days from now. The content doesn't change, so it doesn't
--     go back to review.

create function public.job_expiry_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not coalesce((select public.is_admin()), false)
     and new.expires_at > now() + interval '61 days'
     and (tg_op = 'INSERT' or new.expires_at is distinct from old.expires_at) then
    raise exception 'A job can be shown for at most 60 days from today. Extend it again later.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger job_expiry_limit
  before insert or update of expires_at on public.jobs
  for each row execute function public.job_expiry_limit();

revoke all on function public.job_expiry_limit() from public, anon, authenticated;
-- Trigger only, no grants.

create function public.extend_my_job(p_job_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_new timestamptz := now() + interval '60 days';
begin
  update public.jobs j
  set expires_at = v_new
  from public.companies c
  where j.id = p_job_id
    and c.id = j.company_id
    and c.owner_id = (select auth.uid())
    and c.status = 'approved'
    and j.status = 'published';
  if not found then
    raise exception 'Only a published job of your own approved company can be extended.' using errcode = '42501';
  end if;
  return v_new;
end;
$$;

revoke all on function public.extend_my_job(uuid) from public, anon, authenticated;
grant execute on function public.extend_my_job(uuid) to authenticated;
