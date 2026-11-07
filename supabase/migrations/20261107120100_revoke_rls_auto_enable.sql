-- Lock down public.rls_auto_enable().
--
-- Supabase creates this function for the "Enable automatic RLS" setting: an
-- event trigger runs it after every CREATE TABLE and turns on row level
-- security. It lives in the public schema and is SECURITY DEFINER, and like
-- every new function it was executable by PUBLIC, so anon and authenticated
-- could call it through the API. security_check.sql flagged it.
--
-- This only revokes EXECUTE. The function and its event trigger are left as
-- they are: Postgres doesn't check EXECUTE when an event trigger fires, so
-- automatic RLS keeps working (security_check.sql checks that too).
--
-- If the function doesn't exist (a local database, or a project without the
-- setting), this does nothing.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is null then
    raise notice 'public.rls_auto_enable() does not exist; nothing to revoke.';
    return;
  end if;

  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

  -- A REVOKE by a role that doesn't own the function only warns and changes
  -- nothing. Fail instead, so a migration that didn't work can't look applied.
  if has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE') then
    raise exception 'Could not revoke EXECUTE on public.rls_auto_enable() from anon/authenticated. The function is owned by %, and this migration ran as %.',
      (select pg_get_userbyid(p.proowner) from pg_proc p where p.oid = 'public.rls_auto_enable()'::regprocedure),
      current_user;
  end if;
end;
$$;
