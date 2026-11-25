-- Password login: the email code is needed only once, at sign-up.
--
-- Passwords themselves are handled entirely by Supabase Auth: the site sets
-- one with supabase.auth.updateUser({ password }) right after a code login
-- and logs in with signInWithPassword(). Supabase stores only a bcrypt hash
-- in auth.users.encrypted_password. Nothing here reads, writes or returns
-- that hash.
--
-- The site only needs to know whether the logged-in account has a password
-- yet (accounts from before this change have none), to ask for one after a
-- code login, on /welcome and on the employer setup. The browser can't
-- tell from the session, and user metadata is editable by its user, so it
-- asks the database:
--
--   my_has_password()  true when the caller's own account has a password.
--                      No arguments: it can't be asked about anyone else.
--                      Logged-in users only.

create function public.my_has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select coalesce(u.encrypted_password, '') <> ''
       from auth.users u
      where u.id = (select auth.uid())),
    false);
$$;

revoke all on function public.my_has_password() from public, anon, authenticated;
grant execute on function public.my_has_password() to authenticated;
