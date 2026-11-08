-- Employers accept the terms of use when they create their company.
--
--   * companies.terms_accepted_at: when the owner accepted the terms.
--   * Set only on creation: the company can't be created through the API
--     without it, the database stores its own time (whatever time the client
--     sends is replaced by now()), and there is no update grant, so nobody can
--     change it through the API afterwards.
--   * Companies created before this migration keep it empty.

alter table public.companies add column terms_accepted_at timestamptz;

-- The client says "accepted" by sending any value; the database records when.
create function public.stamp_company_terms_accepted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.terms_accepted_at is not null then
    new.terms_accepted_at := now();
  end if;
  return new;
end;
$$;

create trigger stamp_company_terms_accepted
  before insert on public.companies
  for each row execute function public.stamp_company_terms_accepted();

revoke all on function public.stamp_company_terms_accepted() from public, anon, authenticated;
-- Trigger only, no grants.

-- Insert only (no update grant): it is set once, on creation.
grant insert (terms_accepted_at) on table public.companies to authenticated;

drop policy "Company accounts create their own company" on public.companies;
create policy "Company accounts create their company, accepting terms"
  on public.companies for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and (select public.current_account_type()) = 'company'
    and terms_accepted_at is not null
  );
