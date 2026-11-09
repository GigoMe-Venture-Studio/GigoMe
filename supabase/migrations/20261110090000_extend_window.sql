-- "Extend by 60 days" only for live jobs and for jobs that expired at most
-- 14 days ago. A job that expired longer ago has to go through review again:
-- its owner edits it and submits it (status pending), like any other change.
--
-- extend_my_job(job_id) keeps its other rules: a published job of the
-- caller's own approved company, moved to 60 days from now without a new
-- review. Refusals use errcode 42501 with a message the dashboard shows.

create or replace function public.extend_my_job(p_job_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_new timestamptz := now() + interval '60 days';
  v_job record;
begin
  select j.status, j.expires_at, c.status as company_status
    into v_job
  from public.jobs j
  join public.companies c on c.id = j.company_id
  where j.id = p_job_id
    and c.owner_id = (select auth.uid())
  for update of j;

  if not found or v_job.company_status <> 'approved' or v_job.status <> 'published' then
    raise exception 'Only a published job of your own approved company can be extended.' using errcode = '42501';
  end if;

  if v_job.expires_at < now() - interval '14 days' then
    raise exception 'This job expired more than 14 days ago. Edit it and submit it again for review.' using errcode = '42501';
  end if;

  update public.jobs j set expires_at = v_new where j.id = p_job_id;
  return v_new;
end;
$$;

revoke all on function public.extend_my_job(uuid) from public, anon, authenticated;
grant execute on function public.extend_my_job(uuid) to authenticated;
