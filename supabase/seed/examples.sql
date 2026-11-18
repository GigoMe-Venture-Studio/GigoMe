-- EXAMPLE LISTINGS for testers. NOT a migration: it is never applied
-- automatically. Remove them when testing ends, and before the public launch
-- at the latest, with supabase/seed/remove_examples.sql (SUPABASE.md,
-- "Example listings").
--
-- How to run: Supabase dashboard > SQL Editor > New query > paste this whole
-- file > Run. It needs migration 20261112120000_example_listings.sql to be
-- applied first (Database > Migrations). The result is one table: what was
-- loaded, by filter.
--
-- What it creates, all marked is_example = true (the site shows a small
-- "Example" tag on every card, map card and job page, Apply opens a demo
-- instead of anything real, and search engines are asked not to index them):
--   * 5 made-up companies with realistic, invented names (not real Milan
--     businesses or brands), approved, with no owner account (nobody can log
--     in as them). No website, phone or street address; the only contact
--     detail stored is hello@gigome.org, never shown.
--   * 10 published jobs that read like real Milan student jobs, with pay in
--     line with what cafés, shops, tutoring centres and events pay students
--     (about €9 to €16 an hour), covering the 3 job types, 7 of the 8
--     categories, remote and on site, and the 3 Italian levels. Every
--     description starts with "Example listing: this job isn't real. It's
--     here so you can try GigoMe during our test." and then follows the job
--     form's structure (What you'll do / Who we're looking for / Practical
--     details).
--   * Locations: either the area only, or a pin exactly on a metro station
--     (a public place). Never a street address, so nobody is sent to
--     someone's actual shop or home.
--   * Every database rule applies to them as to real jobs (none is switched
--     off). The database refuses reveal_job_contact() for example jobs, so
--     no apply click is recorded, and they're left out of the numbers.
--
-- Dates are relative to when you run it ("New" badges, start dates). To
-- refresh them, run remove_examples.sql, then this again. It refuses to run
-- while examples are loaded (and then changes nothing).
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
-- Companies (invented, no owner, approved)
-- ---------------------------------------------------------------------------
insert into public.companies (id, owner_id, name, description, contact_email, status, is_example, created_at) values
  ('e1000000-0000-4000-8000-0000000000c1', null, 'Caffè Lumetto',
   E'A small café and bistro near Porta Venezia: coffee and pastries in the morning, aperitivo and simple dinners in the evening. A team of eight, most of them students.',
   'hello@gigome.org', 'approved', true, now() - interval '70 days'),
  ('e1000000-0000-4000-8000-0000000000c2', null, 'Libreria Pennalunga',
   E'An independent bookshop and stationery shop in Città Studi, with a children''s corner and readings every month.',
   'hello@gigome.org', 'approved', true, now() - interval '70 days'),
  ('e1000000-0000-4000-8000-0000000000c3', null, 'Centro Studi Lavagnetta',
   E'After-school help and exam preparation for secondary school students, in small groups or one to one, at our centre and online.',
   'hello@gigome.org', 'approved', true, now() - interval '70 days'),
  ('e1000000-0000-4000-8000-0000000000c4', null, 'Brusio Eventi',
   E'An events and communication agency in Isola: product launches, trade fair stands and the social media around them.',
   'hello@gigome.org', 'approved', true, now() - interval '70 days'),
  ('e1000000-0000-4000-8000-0000000000c5', null, 'Ordito Labs',
   E'A small software company in Bicocca that builds production planning tools for small manufacturers.',
   'hello@gigome.org', 'approved', true, now() - interval '70 days');

-- ---------------------------------------------------------------------------
-- Jobs, published. Pins are exactly on a metro station (Porta Venezia, Porta
-- Romana, Isola, Bicocca); the database fills in the nearest station, the
-- hourly pay equivalent, and nothing for area-only jobs.
-- ---------------------------------------------------------------------------
insert into public.jobs (
  id, company_id, is_example, status, title, description, job_type, category, remote,
  area_id, show_exact_location, latitude, longitude, hours_per_week,
  pay_unit, pay_min, pay_max, pay, italian_level, schedule, languages,
  start_date, created_at, published_at, expires_at)
select
  ('e1000000-0000-4000-8000-0000000000' || lpad(v.n::text, 2, '0'))::uuid,
  ('e1000000-0000-4000-8000-0000000000' || v.co)::uuid,
  true, 'published', v.title,
  'Example listing: this job isn''t real. It''s here so you can try GigoMe during our test.'
    || E'\n\n' || v.body,
  v.job_type, v.category, v.remote,
  v.area_id, v.exact, v.lat, v.lng, v.hours,
  v.pay_unit, v.pay_min, v.pay_max, v.pay_note, v.italian, v.schedule, v.languages,
  current_date + v.start_in,
  now() - make_interval(secs => (v.posted_days_ago + 1) * 86400),
  now() - make_interval(secs => v.posted_days_ago * 86400),
  now() + make_interval(secs => (60 - v.posted_days_ago) * 86400)
from (values
  -- n, company, title, type, category, remote, area, exact pin?, lat, lng, hours,
  -- pay unit, min, max, pay note, Italian, schedule, languages, starts in (days), posted (days ago), body
  (1, 'c1', 'Barista, weekend mornings', 'part_time', 'hospitality', false, 3, true, 45.474419, 9.205046, 12,
   'hour', 9, null::numeric, '+ tips', 'basic', array['weekends'], array['en', 'it'], null::int, 0.5,
   E'What you''ll do:\n- Make espresso, cappuccino and the rest of our coffee menu\n- Serve breakfast pastries at the counter and at the tables\n- Keep the bar clean and restocked between rushes\n\nWho we''re looking for:\n- Bar experience is welcome, but we train you on the espresso machine\n- Friendly, and quick when it gets busy on Sunday mornings\n- Basic Italian: most regulars order in Italian\n\nPractical details:\n- Saturday and Sunday, 7:30 to 13:30\n- €9 an hour, tips shared between the team\n- Near M1 Porta Venezia'),
  (2, 'c1', 'Waiter or waitress, evening shifts', 'part_time', 'hospitality', false, 3, true, 45.474419, 9.205046, 16,
   'hour', 9.5, null, 'Staff meal on every shift', 'basic', array['weekday_evenings', 'weekends'], array['en', 'es', 'it'], null, 2.5,
   E'What you''ll do:\n- Take orders and serve tables during aperitivo and dinner\n- Set up the room before service and clear it after\n- Suggest dishes and wines from our short menu\n\nWho we''re looking for:\n- A few months in a bar or restaurant\n- Basic Italian; English or Spanish helps with our international guests\n- Free at least one weekend evening a week\n\nPractical details:\n- Four evening shifts a week, 18:00 to 22:00, one of them at the weekend\n- €9.50 an hour, with a staff meal on every shift\n- Near M1 Porta Venezia'),
  (3, 'c2', 'Bookshop assistant, Saturdays and two afternoons', 'part_time', 'retail', false, 12, false, null, null, 10,
   'hour', 9, null, null, 'fluent', array['weekday_afternoons', 'weekends'], array['it'], null, 4,
   E'What you''ll do:\n- Help customers find books, and order the ones we don''t have\n- Run the till and wrap gifts\n- Unpack deliveries and keep the shelves in order\n\nWho we''re looking for:\n- You love books and like talking about them\n- Fluent Italian: most of our customers are local families and teachers\n\nPractical details:\n- Saturdays 10:00 to 14:00, plus two afternoons a week, 3 hours each\n- €9 an hour\n- In Città Studi'),
  (4, 'c2', 'Christmas gift wrapping and shop help', 'gig', 'retail', false, 12, false, null, null, 20,
   'hour', 9.5, null, null, 'basic', array['weekday_afternoons', 'weekends'], array['en', 'it', 'zh'], 12, 1.5,
   E'What you''ll do:\n- Wrap gifts at our Christmas counter\n- Help at the till and restock the shelves in the busiest weeks of the year\n\nWho we''re looking for:\n- Neat with your hands and calm with a queue\n- Basic Italian is enough; English or Chinese is a plus\n\nPractical details:\n- From early December to 24 December, about 20 hours a week\n- Afternoon and weekend shifts\n- €9.50 an hour\n- In Città Studi'),
  (5, 'c3', 'Maths tutor for secondary school students', 'part_time', 'tutoring_education', false, 11, true, 45.451434, 9.2034, 8,
   'hour', 14, 16, null, 'fluent', array['weekday_afternoons'], array['it'], null, 6,
   E'What you''ll do:\n- Help students aged 14 to 18 with maths homework, one to one or in pairs\n- Prepare them for tests and the maturità\n\nWho we''re looking for:\n- A student of maths, physics, engineering or economics\n- Fluent Italian: the lessons are in Italian\n- Patient, and good at explaining the same thing in more than one way\n\nPractical details:\n- Weekday afternoons, 15:00 to 19:00, about 8 hours a week to start\n- €14 to €16 an hour, depending on experience\n- At our centre near M3 Porta Romana'),
  (6, 'c3', 'English conversation tutor (online)', 'other', 'tutoring_education', true, null, true, null, null, 4,
   'hour', 15, null, null, 'none', array['weekday_evenings'], array['en'], null, 11,
   E'What you''ll do:\n- Lead 45-minute conversation lessons by video call, for teenagers and adults\n- Follow the topics we prepare and give each student short feedback\n\nWho we''re looking for:\n- Fluent English (native, or C1 to C2)\n- No Italian needed\n\nPractical details:\n- Two evenings a week, 18:00 to 20:00, from home\n- €15 an hour, paid monthly'),
  (7, 'c4', 'Trade fair stand host (3 days)', 'gig', 'events', false, 16, false, null, null, 27,
   'project', 300, null, '€100 a day, lunch included', 'none', array['weekday_mornings', 'weekday_afternoons'], array['de', 'en', 'fr'], 20, 3.5,
   E'What you''ll do:\n- Welcome visitors to a client''s stand at a trade fair\n- Hand out brochures, scan badges and book meetings for the sales team\n\nWho we''re looking for:\n- Confident with people, well presented and punctual\n- Good English; German or French is a plus\n- No Italian needed\n\nPractical details:\n- Three weekdays, 9:00 to 18:30, at the trade fair centre in Rho (M1 Rho Fieramilano)\n- €300 for the three days, lunch included\n- We provide the outfit'),
  (8, 'c4', 'Social media assistant', 'part_time', 'marketing_social', false, 6, true, 45.487608, 9.191263, 20,
   'month', 800, null, null, 'basic', array['weekday_mornings'], array['en', 'it'], 30, 1,
   E'What you''ll do:\n- Plan and schedule posts for the events we organise for our clients\n- Film and edit short videos at events\n- Answer comments and messages on Instagram and LinkedIn\n\nWho we''re looking for:\n- You use Instagram and TikTok every day and know what works\n- Basic Italian and good English\n- A few examples of content you''ve made (your own account is fine)\n\nPractical details:\n- 20 hours a week, weekday mornings, at our office near M5 Isola\n- €800 a month (about €9 an hour), six-month contract\n- Now and then an evening event, agreed in advance'),
  (9, 'c5', 'Junior frontend developer (React), remote', 'part_time', 'tech', true, null, true, null, null, 15,
   'hour', 13, 15, null, 'none', array['flexible'], array['en'], null, 9,
   E'What you''ll do:\n- Build and fix screens in our React web app\n- Write tests and take part in code reviews\n\nWho we''re looking for:\n- You''ve built something with React or another JavaScript framework, even a university project\n- Comfortable with Git\n- English is our working language: no Italian needed\n\nPractical details:\n- About 15 hours a week, whenever suits you around your lectures\n- Fully remote, with an optional team day in Bicocca once a month\n- €13 to €15 an hour, depending on experience'),
  (10, 'c5', 'Office assistant, mornings', 'part_time', 'office_admin', false, 15, true, 45.514734, 9.20537, 15,
   'hour', 10, null, null, 'fluent', array['weekday_mornings'], array['en', 'it'], 14, 14,
   E'What you''ll do:\n- Answer the phone and emails from customers and suppliers\n- Keep the team''s calendar, book meeting rooms and order office supplies\n- Help with simple invoicing in a spreadsheet\n\nWho we''re looking for:\n- Fluent Italian and good English\n- Organised, and at ease with Google Sheets or Excel\n\nPractical details:\n- Monday to Friday, 9:00 to 12:00 (15 hours a week)\n- €10 an hour\n- At our office near M5 Bicocca')
) as v(n, co, title, job_type, category, remote, area_id, exact, lat, lng, hours,
       pay_unit, pay_min, pay_max, pay_note, italian, schedule, languages, start_in, posted_days_ago, body);

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
select 1 as n, 'Example companies' as what,
       (select count(*) || ': ' || string_agg(name, ', ' order by name) from public.companies where is_example) as covered
union all select 2, 'Live example jobs', count(*)::text from ex
union all select 3, 'Job types', string_agg(distinct job_type, ', ') from ex
union all select 4, 'Categories', count(distinct category) || ' of 8: ' || string_agg(distinct category, ', ') from ex
union all select 5, 'Areas', count(distinct area_id) || ' of ' || (select count(*) from public.areas) from ex
union all select 6, 'Remote / on site', count(*) filter (where remote) || ' remote, ' || count(*) filter (where not remote) || ' on site' from ex
union all select 7, 'Italian', string_agg(distinct italian_level, ', ') from ex
union all select 8, 'Hours per week', min(hours_per_week) || ' to ' || max(hours_per_week) from ex
union all select 9, 'Schedules', (select string_agg(distinct s, ', ') from ex, unnest(ex.schedule) s)
union all select 10, 'Languages', (select string_agg(distinct l, ', ') from ex, unnest(ex.languages) l)
union all select 11, 'Pay', string_agg(distinct pay_unit, ', ') || '; hourly equivalent '
                    || min(pay_hourly) || ' to ' || max(pay_hourly) from ex
union all select 12, 'Exact pins (each on a metro station)', count(*) filter (where show_exact_location and latitude is not null)
                    || ' pins, ' || count(*) filter (where show_exact_location and nearest_station_m = 0) || ' on a station: '
                    || coalesce(string_agg(distinct station_name, ', ') filter (where show_exact_location), 'none') from ex
union all select 13, 'Area only (no exact pin)', count(*) filter (where not show_exact_location)::text from ex
union all select 14, 'New (published in the last 3 days)', count(*) filter (where published_at > now() - interval '3 days')::text from ex
union all select 15, 'Descriptions starting with the example line',
                    count(*) filter (where description like 'Example listing: this job isn''t real. It''s here so you can try GigoMe during our test.%')
                    || ' of ' || count(*) from ex
order by n;
