-- More Milan universities for student accounts.
--
-- Only Bocconi was listed, so students of every other university were
-- refused at the student login. This adds the universities whose STUDENT
-- email domain is confirmed by the university itself (researched in November
-- 2026; sources in the pull request). Staff domains (polimi.it, unimi.it,
-- unicatt.it, unimib.it, iulm.it, hunimed.eu, unisr.it) are deliberately left
-- out: they would let staff, not only students, get student accounts.
--
-- NABA and IED Milano are not added: their student domains couldn't be
-- confirmed from an official source. Add them in the dashboard once they are.
--
-- The rule doesn't change: only an exact, lowercased match of a listed domain
-- makes a student (university_for_email). Look-alikes and sub-domains
-- (notmail.polimi.it, sub.studenti.unimi.it, icatt.it.example) stay companies.
--
-- Safe to run on a database where some were already added in the dashboard:
-- a domain that some university already lists is skipped (so no domain is
-- ever listed twice), and a university that already exists under the same
-- name only gets the domains it is missing. Inserting or updating fires
-- on_university_domains_changed, which upgrades company accounts that signed
-- up with these addresses to students (except those that own a company).

insert into public.universities as u (name, email_domains)
select v.name, array[v.domain]
from (values
  ('Politecnico di Milano',                 'mail.polimi.it'),
  ('University of Milan (La Statale)',      'studenti.unimi.it'),
  ('Università Cattolica del Sacro Cuore',  'icatt.it'),
  ('University of Milano-Bicocca',          'campus.unimib.it'),
  ('IULM University',                       'studenti.iulm.it'),
  ('Humanitas University',                  'st.hunimed.eu'),
  ('Vita-Salute San Raffaele University',   'studenti.unisr.it')
) as v(name, domain)
where not exists (
  select 1 from public.universities x, unnest(x.email_domains) as d(domain)
  where lower(btrim(d.domain)) = v.domain
)
on conflict (name) do update
  set email_domains = u.email_domains || excluded.email_domains;
