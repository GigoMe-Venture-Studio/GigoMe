-- Part 3: saved searches.
--
--   * saved_searches: a student's /jobs filters under a name, and when they
--     last opened it (to count "N new since your last visit"). In the app
--     only: nothing is ever emailed.
--   * Only the student who saved a search can see, rename or delete it
--     (user_id is always the caller). At most 20 per student (trigger).
--   * params is the /jobs query string (q=barista&area=3...), limited to the
--     characters an encoded query string uses.
--   * last_seen_at is always the database's now() when it changes.
--   * Deleted with the account (auth.users, on delete cascade).

create table public.saved_searches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 60),
  params       text not null check (char_length(params) <= 500 and params ~ '^[A-Za-z0-9_=&%.+*-]*$'),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.saved_searches enable row level security;
create index saved_searches_user_id_idx on public.saved_searches (user_id);

revoke all on table public.saved_searches from public, anon, authenticated;
grant select, delete on table public.saved_searches to authenticated;
grant insert (name, params) on table public.saved_searches to authenticated;
grant update (name, last_seen_at) on table public.saved_searches to authenticated;

create policy "Students read their own saved searches"
  on public.saved_searches for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Students save searches for themselves"
  on public.saved_searches for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.current_account_type()) = 'student'
  );

create policy "Students rename or mark their own saved searches"
  on public.saved_searches for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Students delete their own saved searches"
  on public.saved_searches for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- At most 20 per student (a trigger: a policy can't count its own table).
create function public.saved_searches_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.saved_searches s where s.user_id = new.user_id) >= 20 then
    raise exception 'You can save up to 20 searches. Delete one to save another.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger saved_searches_limit
  before insert on public.saved_searches
  for each row execute function public.saved_searches_limit();

revoke all on function public.saved_searches_limit() from public, anon, authenticated;
-- Trigger only, no grants.

-- Whatever time is sent, last_seen_at becomes now().
create function public.saved_search_seen_now()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.last_seen_at is distinct from old.last_seen_at then
    new.last_seen_at := now();
  end if;
  return new;
end;
$$;

create trigger saved_search_seen_now
  before update of last_seen_at on public.saved_searches
  for each row execute function public.saved_search_seen_now();

revoke all on function public.saved_search_seen_now() from public, anon, authenticated;
-- Trigger only, no grants.
