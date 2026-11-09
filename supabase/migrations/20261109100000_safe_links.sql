-- Links and email addresses written by users: http(s) links and plain email
-- addresses only, enforced by the database.
--
--   * companies.website and job_contacts.apply_url: http:// or https://, a
--     host name with a dot, no spaces, quotes or angle brackets. javascript:,
--     data:, mailto: and every other scheme are refused.
--   * companies.contact_email and job_contacts.apply_email: a plain address
--     (letters, digits and . _ % + ' - before the @; a domain with a dot),
--     so nothing can ride along into a mailto: link (no ?, &, quotes, spaces).
--   * Existing values are tidied first: a website saved without a scheme
--     gets https:// in front; anything that still isn't an http(s) link
--     (another scheme, spaces) is removed. Existing emails and apply links
--     that don't fit the stricter pattern are left alone and reported by the
--     security check: the new rules apply to every new or changed value.

update public.companies
  set website = 'https://' || btrim(website)
  where website is not null
    and btrim(website) !~* '^[a-z][a-z0-9+.-]*:'
    and btrim(website) ~ '^[^[:space:]/]+\.[^[:space:]]+$';

update public.companies
  set website = null
  where website is not null
    and website !~* '^https?://[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]{1,5})?([/?#][^[:space:]<>"''`]*)?$';

alter table public.companies
  add constraint companies_website_http check (
    website ~* '^https?://[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]{1,5})?([/?#][^[:space:]<>"''`]*)?$'
  );

-- The stricter patterns for links and emails people already saved: checked
-- on every new or changed value (NOT VALID), and validated now when the
-- existing rows allow it.
alter table public.job_contacts
  add constraint job_contacts_apply_url_http check (
    apply_url ~* '^https?://[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]{1,5})?([/?#][^[:space:]<>"''`]*)?$'
  ) not valid,
  add constraint job_contacts_apply_email_plain check (
    apply_email ~* '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$'
  ) not valid;

alter table public.companies
  add constraint companies_contact_email_plain check (
    contact_email ~* '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$'
  ) not valid;

do $$
begin
  alter table public.job_contacts validate constraint job_contacts_apply_url_http;
exception when check_violation then
  raise notice 'Some saved apply links don''t fit the stricter pattern; they stay until changed.';
end $$;

do $$
begin
  alter table public.job_contacts validate constraint job_contacts_apply_email_plain;
exception when check_violation then
  raise notice 'Some saved apply emails don''t fit the stricter pattern; they stay until changed.';
end $$;

do $$
begin
  alter table public.companies validate constraint companies_contact_email_plain;
exception when check_violation then
  raise notice 'Some saved contact emails don''t fit the stricter pattern; they stay until changed.';
end $$;
