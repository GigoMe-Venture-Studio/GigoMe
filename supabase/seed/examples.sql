-- EXAMPLE LISTINGS for testers. NOT a migration: it is never applied
-- automatically. Remove them when testing ends, and before the public launch
-- at the latest, with supabase/seed/remove_examples.sql (SUPABASE.md,
-- "Example listings").
--
-- How to run: Supabase dashboard > SQL Editor > New query > paste this whole
-- file > Run. It needs migration 20261112120000_example_listings.sql to be
-- applied first (Database > Migrations). The result is one table: what was
-- loaded, by filter, so you can see every filter value is covered.
--
-- What it creates, all marked is_example = true (the site shows "Example
-- listing, not a real job" on every card and page, and search engines are
-- asked not to index them):
--   * 6 made-up companies, approved, with no owner account (nobody can log
--     in as them). Every name starts with "Example ". No website, phone or
--     address; the only contact detail is hello@gigome.org.
--   * 19 published jobs covering every filter: the 3 job types (gig,
--     part-time, other: GigoMe lists no internships), the 8 categories, all
--     16 areas, remote and on site, the 3 Italian levels, hours from 4 to 30
--     a week, every schedule and language, pay per hour, per month, per
--     project and a range (all paid), and the minimum-pay slider up to
--     €25/h. Edge cases: a 117-character title, one that
--     expires in 2 days, five "New" ones, pins with and without a metro
--     station within 1 km, area-only and remote jobs. Every database rule
--     applies to them as to real jobs (none is switched off), so all of them
--     have structured pay.
--   * Their "how to apply" is hello@gigome.org, but the site never reveals
--     it: Apply explains it's an example, and the database refuses
--     reveal_job_contact() for example jobs, so no apply click is recorded.
--
-- Dates are relative to when you run it ("New" badges, the job that expires
-- in 2 days). To refresh them, run remove_examples.sql, then this again. It
-- refuses to run twice (and then changes nothing).
--
-- Everything runs in one transaction: if any step fails, nothing is saved.

begin;

do $guard$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'jobs' and column_name = 'is_example') then
    raise exception 'Migration 20261112120000_example_listings.sql isn''t applied yet. Merge it first, then run this.';
  end if;
  if exists (select 1 from public.companies where is_example) or exists (select 1 from public.jobs where is_example) then
    raise exception 'Example listings are already loaded. To load them again, run supabase/seed/remove_examples.sql first.';
  end if;
end
$guard$;

-- ---------------------------------------------------------------------------
-- Companies (no owner, approved)
-- ---------------------------------------------------------------------------
insert into public.companies (id, owner_id, name, description, contact_email, status, is_example, created_at) values
  ('e0000000-0000-4000-8000-0000000000c1', null, 'Example Café Immaginario',
   E'A made-up café and bistro, invented to test GigoMe. It doesn''t exist.\n\nOn a real company page, this is where the employer describes what they do.',
   'hello@gigome.org', 'approved', true, now() - interval '70 days'),
  ('e0000000-0000-4000-8000-0000000000c2', null, 'Example Libreria Finta',
   E'A made-up bookshop ("finta" means fake), invented to test GigoMe. It doesn''t exist.',
   'hello@gigome.org', 'approved', true, now() - interval '70 days'),
  ('e0000000-0000-4000-8000-0000000000c3', null, 'Example Tutoring Lab',
   E'A made-up tutoring centre, invented to test GigoMe. It doesn''t exist.',
   'hello@gigome.org', 'approved', true, now() - interval '70 days'),
  ('e0000000-0000-4000-8000-0000000000c4', null, 'Example Social Studio',
   E'A made-up social media agency, invented to test GigoMe. It doesn''t exist.',
   'hello@gigome.org', 'approved', true, now() - interval '70 days'),
  ('e0000000-0000-4000-8000-0000000000c5', null, 'Example Associazione Eventi Inventati di Milano',
   E'A made-up events association with a long name ("inventati" means invented), to test how long company names look. It doesn''t exist.',
   'hello@gigome.org', 'approved', true, now() - interval '70 days'),
  ('e0000000-0000-4000-8000-0000000000c6', null, 'Example Startup Fittizia',
   E'A made-up tech start-up ("fittizia" means fictitious), invented to test GigoMe. It doesn''t exist.',
   'hello@gigome.org', 'approved', true, now() - interval '70 days');

-- ---------------------------------------------------------------------------
-- Jobs, published. The database fills in the nearest metro station (from the
-- pin), the hourly pay equivalent and the area centre for area-only jobs.
-- ---------------------------------------------------------------------------
insert into public.jobs (
  id, company_id, is_example, status, title, description, job_type, category, remote,
  area_id, show_exact_location, latitude, longitude, hours_per_week,
  pay_unit, pay_min, pay_max, pay, italian_level, schedule, languages,
  start_date, created_at, published_at, expires_at)
select
  ('e0000000-0000-4000-8000-0000000000' || lpad(v.n::text, 2, '0'))::uuid,
  ('e0000000-0000-4000-8000-0000000000' || v.co)::uuid,
  true, 'published', v.title,
  'Example listing, made up for testing GigoMe: this company and this job don''t exist, and there is nobody to apply to.'
    || E'\n\n' || v.body,
  v.job_type, v.category, v.remote,
  v.area_id, v.exact, v.lat, v.lng, v.hours,
  v.pay_unit, v.pay_min, v.pay_max, v.pay_note, v.italian, v.schedule, v.languages,
  current_date + v.start_in,
  now() - make_interval(secs => (v.posted_days_ago + 1) * 86400),
  now() - make_interval(secs => v.posted_days_ago * 86400),
  now() + make_interval(secs => coalesce(v.expires_in_days, 60 - v.posted_days_ago) * 86400)
from (values
  -- n, company, title, type, category, remote, area, exact pin?, lat, lng, hours,
  -- pay unit, min, max, pay note, Italian, schedule, languages, starts in (days), posted (days ago), expires in (days), body
  (1, 'c1', 'Weekend barista', 'part_time', 'hospitality', false, 3, true, 45.4752, 9.2062, 12,
   'hour', 10, 12, '+ tips', 'none', array['weekends'], array['en', 'it'], null::int, 0.3, null::numeric,
   E'Make coffee and serve customers on Saturday and Sunday mornings.\nNo experience needed: we train you on the espresso machine.'),
  (2, 'c1', 'Evening waiter or waitress', 'part_time', 'hospitality', false, 9, true, 45.4523, 9.1748, 16,
   'hour', 9.5, null, 'Dinner included on every shift', 'basic', array['weekday_evenings', 'weekends'], array['en', 'es', 'it'], null, 1.5, null,
   E'Take orders and serve tables in the evening, four shifts a week.\nBasic Italian helps with some customers.'),
  (3, 'c1', 'Kitchen helper for brunch service', 'gig', 'hospitality', false, 14, false, null, null, 6,
   'hour', 11, null, null, 'basic', array['weekends'], array['it'], null, 5, null,
   E'Prepare ingredients and keep the kitchen tidy during Sunday brunch.\nThe employer shows only the area, not the exact address.'),
  (4, 'c1', 'Weekend and evening front-of-house assistant for an imaginary bistro, with occasional catering at events across Milan', 'part_time', 'hospitality', false, 1, true, 45.4655, 9.1885, 20,
   'month', 650, null, null, 'fluent', array['weekday_evenings', 'weekends'], array['it'], 10, 12, null,
   E'This listing has a very long title and a longer description, to test how both wrap on cards and pages.\n\nWhat you do:\n- welcome guests and show them to their table\n- take bookings on the phone (in Italian)\n- help the catering team at events a few times a month\n\nWhat we offer:\n- a monthly pay for 20 hours a week\n- shifts planned two weeks ahead\n- a meal on every shift'),
  (5, 'c2', 'Bookshop assistant', 'part_time', 'retail', false, 2, true, 45.4728, 9.1880, 15,
   'hour', 9, null, null, 'basic', array['weekday_afternoons', 'weekends'], array['en', 'fr', 'it'], 20, 3.5, null,
   E'Help customers find books, run the till and unpack deliveries.\nWe have many customers who speak English or French.'),
  (6, 'c2', 'Christmas pop-up shop helper', 'gig', 'retail', false, 4, true, 45.4842, 9.2041, 25,
   'hour', 10, null, null, 'none', array['weekday_afternoons', 'weekday_evenings', 'weekends'], array['en', 'zh'], 14, 2, null,
   E'Four weeks in December at a pop-up stand: wrap gifts, restock shelves and help at the till.'),
  (7, 'c2', 'Stocktaking helper, one weekend', 'gig', 'retail', false, 13, true, 45.4848, 9.2368, 10,
   'project', 120, null, null, 'none', array['weekends'], array[]::text[], 3, 58, 2,
   E'Count and label stock over one weekend.\nThis listing expires in 2 days, to test how soon-ending jobs look.'),
  (8, 'c3', 'Maths and physics tutor for high-school students', 'part_time', 'tutoring_education', false, 12, true, 45.4786, 9.2282, 8,
   'hour', 20, 25, null, 'fluent', array['weekday_afternoons'], array['it'], null, 7, null,
   E'Help small groups of high-school students with homework and exam preparation, in Italian.'),
  (9, 'c3', 'English conversation tutor', 'other', 'tutoring_education', false, 11, true, 45.4512, 9.1945, 4,
   'hour', 25, null, null, 'none', array['weekday_evenings'], array['en'], null, 9, null,
   E'Lead relaxed conversation classes for adults, one or two evenings a week.\nThe best-paid example listing, to test the minimum pay filter at €25 an hour.'),
  (10, 'c3', 'Online homework helper', 'part_time', 'tutoring_education', true, null, true, null, null, 10,
   'hour', 12, null, null, 'none', array['flexible'], array['de', 'en', 'es', 'fr'], null, 20, null,
   E'Fully remote: answer students'' questions by video call, whenever suits you.\nRemote, with no location, to test the "Remote / no location" list next to the map.'),
  (11, 'c4', 'Social media content assistant', 'part_time', 'marketing_social', false, 6, true, 45.4893, 9.1903, 20,
   'month', 800, null, null, 'basic', array['weekday_mornings', 'weekday_afternoons'], array['en', 'it'], 56, 4, null,
   E'Plan and write posts for our (made-up) clients, and help film short videos.\nA six-month contract, 20 hours a week.'),
  (12, 'c4', 'Video editor for short clips', 'gig', 'marketing_social', true, 5, false, null, null, 8,
   'project', 250, 400, null, 'none', array['flexible'], array['en'], null, 15, null,
   E'Edit ten short vertical videos from our footage. Work from home, or from our office now and then.'),
  (13, 'c4', 'Studio administration assistant', 'part_time', 'office_admin', false, 7, true, 45.4768, 9.1742, 30,
   'hour', 11, null, null, 'fluent', array['weekday_mornings', 'weekday_afternoons'], array['en', 'it'], 80, 6, null,
   E'Invoices, scheduling and supplier emails for a small (made-up) studio, 30 hours a week.'),
  (14, 'c5', 'Event host at a gallery opening', 'gig', 'events', false, 10, true, 45.4528, 9.1665, 5,
   'project', 90, null, 'One evening, 18:00 to 23:00', 'basic', array['weekday_evenings'], array['en', 'fr', 'it'], 15, 1, null,
   E'Welcome guests, hand out programmes and answer questions at an exhibition opening.'),
  (15, 'c5', 'Festival volunteer coordinator assistant', 'part_time', 'events', false, 8, true, 45.4782, 9.1548, 24,
   'hour', 11, 13, null, 'none', array['weekday_evenings', 'weekends'], array['ar', 'en', 'other'], null, 10, null,
   E'Help coordinate volunteers for a three-day festival: shift plans, briefings and the info desk.'),
  (16, 'c5', 'Warehouse helper for event set-up', 'gig', 'other', false, 16, true, 45.5030, 9.1585, 30,
   'hour', 12, null, null, 'basic', array['weekday_mornings'], array['it'], null, 25, null,
   E'Load and unload stage equipment before events.\nIn "Elsewhere in Milan", more than 1 km from any metro station, so it has no metro badge.'),
  (17, 'c6', 'Junior web developer (React)', 'part_time', 'tech', false, 15, true, 45.5142, 9.2105, 20,
   'hour', 16, 18, null, 'none', array['flexible'], array['en'], null, 2.5, null,
   E'Build small features for our web app with React, with code review from a senior developer.'),
  (18, 'c6', 'Data analysis assistant', 'part_time', 'tech', true, null, true, null, null, 20,
   'month', 1000, 1200, null, 'none', array['weekday_mornings', 'weekday_afternoons'], array['de', 'en'], 63, 30, null,
   E'Part-time and remote, 20 hours a week: clean data, build dashboards and present findings to the team every week.'),
  (19, 'c6', 'Office assistant, mornings', 'part_time', 'office_admin', false, 5, true, 45.4830, 9.1885, 14,
   'hour', 10, null, null, 'fluent', array['weekday_mornings'], array['en', 'it'], null, 8, null,
   E'Answer the phone, greet visitors and keep the office running, Monday to Friday mornings.')
) as v(n, co, title, job_type, category, remote, area_id, exact, lat, lng, hours,
       pay_unit, pay_min, pay_max, pay_note, italian, schedule, languages, start_in, posted_days_ago, expires_in_days, body);

-- How to apply: only hello@gigome.org, and never shown (see the top).
insert into public.job_contacts (job_id, apply_email)
select j.id, 'hello@gigome.org' from public.jobs j where j.is_example;

commit;

-- ---------------------------------------------------------------------------
-- What was loaded: one row per filter, with the values covered.
-- ---------------------------------------------------------------------------
with ex as (
  select j.*, a.name as area_name, s.name as station_name
  from public.jobs j
  join public.companies c on c.id = j.company_id
  left join public.areas a on a.id = j.area_id
  left join public.metro_stations s on s.id = j.nearest_station_id
  where j.is_example and c.is_example and c.status = 'approved'
    and j.status = 'published' and j.expires_at > now()
)
select 1 as n, 'Example companies' as what, (select count(*) from public.companies where is_example)::text as covered
union all select 2, 'Live example jobs', count(*)::text from ex
union all select 3, 'Job types', string_agg(distinct job_type, ', ') from ex
union all select 4, 'Categories', count(distinct category) || ' of 8: ' || string_agg(distinct category, ', ') from ex
union all select 5, 'Areas', count(distinct area_id) || ' of ' || (select count(*) from public.areas) from ex
union all select 6, 'Remote / on site', count(*) filter (where remote) || ' remote, ' || count(*) filter (where not remote) || ' on site' from ex
union all select 7, 'Italian', string_agg(distinct italian_level, ', ') from ex
union all select 8, 'Hours per week', min(hours_per_week) || ' to ' || max(hours_per_week) from ex
union all select 9, 'Schedules', (select string_agg(distinct s, ', ') from ex, unnest(ex.schedule) s)
union all select 10, 'Languages', (select string_agg(distinct l, ', ') from ex, unnest(ex.languages) l)
union all select 11, 'Pay', string_agg(distinct coalesce(pay_unit, 'none'), ', ') || '; hourly equivalent '
                    || min(pay_hourly) || ' to ' || max(pay_hourly) from ex
union all select 12, 'Metro badge (exact pin within 1 km)', count(*) filter (where show_exact_location and nearest_station_m <= 1000)
                    || ' jobs; ' || count(*) filter (where show_exact_location and latitude is not null and (nearest_station_m is null or nearest_station_m > 1000))
                    || ' pinned without one' from ex
union all select 13, 'Area only (no exact pin)', count(*) filter (where not show_exact_location)::text from ex
union all select 14, 'New (published in the last 3 days)', count(*) filter (where published_at > now() - interval '3 days')::text from ex
union all select 15, 'Expiring within 3 days', count(*) filter (where expires_at < now() + interval '3 days')::text from ex
union all select 16, 'Longest title', max(char_length(title)) || ' characters' from ex
order by n;
