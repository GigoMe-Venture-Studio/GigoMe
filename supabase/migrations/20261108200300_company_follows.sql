-- Part 4: following a company.
--
--   * company_follows (user_id, company_id, created_at): a student follows an
--     approved company, to see its new jobs on /saved. In the app only:
--     nothing is ever emailed.
--   * Only the follower can see or remove the row (user_id is always the
--     caller). Companies never see who follows them: the owner gets only the
--     number, from my_company_follower_count().
--   * Deleted with the account and with the company.

create table public.company_follows (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);
alter table public.company_follows enable row level security;
create index company_follows_company_id_idx on public.company_follows (company_id);

revoke all on table public.company_follows from public, anon, authenticated;
grant select, delete on table public.company_follows to authenticated;
grant insert (company_id) on table public.company_follows to authenticated;

create policy "Students read their own follows"
  on public.company_follows for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Students follow approved companies, for themselves"
  on public.company_follows for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_account_type()) = 'student'
    and exists (select 1 from public.companies c where c.id = company_id and c.status = 'approved')
  );

create policy "Students unfollow"
  on public.company_follows for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- How many students follow the caller's company: a number, never who.
create function public.my_company_follower_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.company_follows f
  join public.companies c on c.id = f.company_id
  where c.owner_id = (select auth.uid());
$$;

revoke all on function public.my_company_follower_count() from public, anon, authenticated;
grant execute on function public.my_company_follower_count() to authenticated;
