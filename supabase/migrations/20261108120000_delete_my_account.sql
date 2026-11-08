-- delete_my_account(): a logged-in user deletes their own account.
--
-- It takes no arguments and only ever acts on auth.uid(), so nobody can
-- delete anyone else. What happens to the user's data:
--   * feedback: deleted here (its foreign key would only clear user_id);
--   * auth.users row: deleted here, and with it, through the existing foreign
--     keys (on delete cascade): the profile, an admins row, and for a company
--     account its company, the company's jobs, their job_contacts and the
--     clicks on those jobs;
--   * job_clicks the user made on other jobs: kept, with user_id set to null
--     (existing foreign key, on delete set null), so click counts stay right
--     without pointing to a person.
-- The website calls it from /account after the user types DELETE.

create function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Log in to delete your account.' using errcode = '42501';
  end if;

  delete from public.feedback where user_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
