-- The numbers at the top of /admin, the same as supabase/queries/kpis.sql:
-- students registered, approved companies, companies with at least one live
-- job, live jobs, apply clicks this week and distinct students who clicked
-- this week (weeks start on Monday, UTC). Admins only.

create function public.admin_stats()
returns table (
  students bigint,
  companies_approved bigint,
  companies_with_live_job bigint,
  live_jobs bigint,
  apply_clicks_this_week bigint,
  students_clicked_this_week bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can read the numbers.' using errcode = '42501';
  end if;
  return query
  with live as (
    select j.id, j.company_id
    from public.jobs j
    join public.companies c on c.id = j.company_id
    where j.status = 'published' and j.expires_at > now() and c.status = 'approved'
  ),
  week as (
    select k.id, k.user_id from public.job_clicks k where k.created_at >= date_trunc('week', now())
  )
  select
    (select count(*) from public.profiles p where p.account_type = 'student'),
    (select count(*) from public.companies c where c.status = 'approved'),
    (select count(distinct l.company_id) from live l),
    (select count(*) from live),
    (select count(*) from week),
    (select count(distinct w.user_id) from week w);
end;
$$;

revoke all on function public.admin_stats() from public, anon, authenticated;
grant execute on function public.admin_stats() to authenticated;
