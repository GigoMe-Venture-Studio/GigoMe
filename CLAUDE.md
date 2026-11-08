# CLAUDE.md

## Project structure and commands

Vite + React + React Router, in JavaScript (no TypeScript), at the repo root.
Hosted on Cloudflare Workers (static assets) at https://gigome.org, built from
`main`.

- `npm install`, then `npm run dev` (local server), `npm run build` (writes
  `dist/`), `npm run preview` or `npx wrangler dev` (serves `dist/`, the second
  the way Cloudflare does).
- `index.html`: page shell only (`<head>`, `#root`). The font (Schibsted
  Grotesk) is self-hosted: `@fontsource-variable/schibsted-grotesk`, imported
  in `src/main.jsx` and bundled into `/assets/`. Don't load fonts or other
  files from third-party servers (no Google Fonts): each one is another
  service visitors' browsers talk to (HANDOVER.md, section 7b).
- `src/main.jsx`, `src/App.jsx`: entry point and router. Routes: `/` (home),
  `/jobs`, `/jobs/:id`, `/companies/:id`, `/saved`, `/account`, `/login`, `/welcome`, `/privacy`, `/terms`,
  `/employers`, `/employers/setup`, `/dashboard`, `/dashboard/jobs/new`,
  `/dashboard/jobs/:id/edit`, `/admin` and `*` (404). `/about` only
  redirects to `/`: there is no About page, and no team names, biographies or
  anything suggesting a university's endorsement or affiliation anywhere. `ScrollToTop` (in `App.jsx`) starts each new path at the
  top, except on Back/Forward and query-only changes. Don't
  add placeholder pages for features that aren't built.
- Job board: `src/pages/Jobs.jsx` (list, filters kept in the URL:
  `?q=&area=&category=&type=&remote=yes|no&italian=none|basic&hours=`, plus `view=map`
  for the map, which isn't a filter; `q` matches title and
  description and goes through `cleanKeyword()`, which keeps only letters,
  numbers, spaces, hyphens and apostrophes so it can't break the PostgREST
  `or()` filter; on phones, under 768px, every filter except the keyword is
  folded behind a "Filters" button that shows how many are set, so the first
  job is visible without scrolling), `src/pages/JobDetail.jsx`
  (job, company, "How to apply"), logic in `src/lib/jobs.js`. Queries ask for
  live jobs explicitly (published, not expired, approved company), because
  company owners and admins can also read jobs that aren't live.
  One "Apply" button: for a logged-in student it calls `reveal_job_contact`
  and opens the destination at once (the application page in a new tab,
  opened during the click so pop-up blockers allow it, or the email app with
  the subject "Application: <title> (via GigoMe)"; a link wins over an
  email), and shows the contact underneath in case nothing opened.
  `reveal_job_contact` counts an apply click on every call: call it only when
  a student presses "Apply", never on page load. We count "apply clicks",
  never "applications": GigoMe doesn't see whether anyone applied. Logged-out visitors go
  to `/login?next=/jobs/<id>`; `safeNext()` in `src/lib/auth.js` only accepts
  paths on this site.
- Map: MapLibre GL (`src/lib/maplibre.js` sets its worker URL for Vite,
  `src/lib/map.js`) with OpenFreeMap's "positron" style and the
  OpenStreetMap attribution always visible. Only ever loaded with `import()` /
  `React.lazy` (`src/components/JobsMap.jsx`, `LocationPicker.jsx`), so list
  pages stay light. `/jobs` has List | Map (desktop: side by side; phone: one
  or the other); the map shows exactly the list's jobs, minus remote jobs and
  jobs without coordinates, clustered when zoomed out. Areas come from
  `src/lib/areas.js` (the `areas` table). The job form picks the area, then an
  optional pin (tap, drag, or "Find address": one Nominatim request per press
  from `src/lib/geocode.js`, bounded to Milan, never autocomplete, credited
  on the form), or "Only show the area".
- Badges on job cards and job pages: "New" (`isNew()`: published in the last
  3 days, gold), the category, and the metro badge (`metroLabel()`: only for
  an exact location within 1000 m of a station, at 80 m a minute walking).
  Company pages: `src/pages/Company.jsx` (`/companies/:id`): approved
  companies only (asked for explicitly), name, description, website and open
  jobs with the map when some have a location; never the contact email.
  Linked from job pages.
- Saved jobs: `src/lib/saved.js` (one shared list of the student's saved job
  ids, loaded once per login; `useSavedJobs()`, `setSaved()`),
  `src/components/SaveButton.jsx` (the bookmark on job cards, next to the
  card's link, not inside it, and on job pages; students only),
  `src/pages/Saved.jsx` (`/saved`, "Saved jobs" in the header for students;
  jobs that closed or expired show as "No longer available" from
  `my_saved_jobs()`).
- `src/components/PageShell.jsx`: the `<main>` frame for every page except
  the home page. `src/components/SiteFooter.jsx`: the footer on every page
  (rendered once in `App.jsx`). `src/components/JobCard.jsx`: the job card on
  `/jobs` and on the home page.
- New features are React pages and components (`src/pages/`,
  `src/components/`). Styles for them go in their own file (e.g.
  `src/styles/auth.css`) and reuse the tokens and classes in `site.css`.
  Check new class names don't clash with existing ones (`grep src/styles/`).
- The 6-digit code login lives in `src/components/CodeLogin.jsx`, used by
  `/login` (`audience="student"`: university emails only) and `/employers`
  (`audience="employer"`: any email except a listed university's, which are
  sent to `/login`). Change the flow there, once.
- Bot check: Cloudflare Turnstile (`src/components/Turnstile.jsx`,
  `src/lib/captcha.js`) on that same form, checked by Supabase Auth's CAPTCHA
  protection. Only on when the build variable `VITE_TURNSTILE_SITE_KEY` is
  set. Every Supabase Auth call (send code, resend, verify) passes the current
  token, then the widget is reset: tokens work once. The Turnstile secret key
  lives only in the Supabase dashboard.
- Student login: `src/pages/Login.jsx` (email, then 6-digit code),
  `src/pages/Welcome.jsx` (full_name, degree_level, graduation_year when the
  profile has no name yet), logic in `src/lib/auth.js`, session in
  `src/lib/useSession.js`. Only emails whose domain is in `universities` get
  a code. `/welcome` and `/account` share the profile fields and their rules
  (`src/components/ProfileFields.jsx`, `checkProfile()` in
  `src/lib/profile.js`); after saving they call `announceProfileChange()` so
  the header shows the new name.
- Account: `src/pages/Account.jsx` (`/account`, reached from the name in the
  header and the phone menu; logged out goes to `/login?next=/account`).
  Email and university are read-only. "Delete my account" first shows a
  reminder with "Keep my account" and "Delete my account" side by side, then
  needs DELETE typed,
  calls `delete_my_account()` (`src/lib/account.js`), goes to `/` with "Your
  account has been deleted" and then clears the session on this device.
  `/privacy` and `/terms` are placeholders until the owner supplies the text;
  each has a marked "Who operates GigoMe" section. Both are in the footer.
- Employer side: `src/pages/Employers.jsx` (`/employers`: pitch and employer
  login), `EmployerSetup.jsx` (`/employers/setup`: a company account without
  a company creates it, status pending; "I accept the terms" must be ticked,
  and the database stores `terms_accepted_at`), `Dashboard.jsx` (`/dashboard`:
  company details and status, jobs with status, review notes and apply
  clicks from `my_job_stats()`), `JobEditor.jsx` (new/edit job and how to
  apply). Logic in `src/lib/employer.js`, account state in
  `src/lib/useCompanyAccount.js`, gate in `src/components/EmployerGate.jsx`.
  A job is saved as a draft, then its contact (`set_job_contact`), then its
  status, so it is never submitted without a contact; a published job is
  edited in one update that sends it back to `pending`. Contact email is read
  only through `get_company_contact_email()`. Styles in `employer.css`.
- Moderation: `src/pages/Admin.jsx` (`/admin`, logic in `src/lib/admin.js`,
  styles in `admin.css`). Only admins (`is_admin()`); everyone else, logged
  out included, gets the 404 page, and the database refuses them anyway.
  Pending companies (approve/reject, with contact and login email from
  `admin_company_contact`), pending jobs (publish/request changes/reject, a
  note required for the last two, Publish only once the five-item review
  checklist is ticked; how to apply from `admin_job_contact`), open reports
  (unpublish the job = `admin_review_job(..., 'closed', note)`, reject the
  job's company = `admin_set_company_status(..., 'rejected')` for scams and
  payment demands, resolve with a note = `admin_resolve_report`), the newest
  50 feedback messages (time, page and message only, never the sender; the
  page is shown as text, not a link), and recent decisions from
  `moderation_log`. Not linked from the header.
- "Report this job": `src/components/ReportJob.jsx` at the bottom of each job
  page (logged out: "Log in to report it"); `src/lib/reports.js` inserts
  into `job_reports`.
- `src/components/SiteHeader.jsx`: the header on every page (rendered once in
  `App.jsx`): the logo (`public/brand/header-wordmark.webp`, 30px high, or
  `header-mark.webp` under 360px; alt "GigoMe", links to `/`), Jobs
  (`/jobs`), then: logged out, "For employers" and "Log in"; a
  student, "Saved jobs", their name (a link to `/account`, truncated when it doesn't fit)
  and "Log out"; a company account, "Dashboard", the company name (a link to
  `/account`) and "Log out". The footer shows "For employers" when logged
  out. Under 768px the links move into a Menu panel. Don't add links for
  features that don't exist yet (no "Create profile" or "Post a role").
- Feedback: `src/components/Feedback.jsx` (`FeedbackProvider` in `App.jsx`)
  puts a fixed "Feedback" button at the bottom right of every page and opens
  a panel (native `<dialog>`); the footer's "Give feedback" opens it too via
  `useOpenFeedback()`. Logged-in users insert `page` and `message` (max 2000)
  through `sendFeedback()` in `src/lib/feedback.js`; the database sets
  `user_id`. Logged-out visitors get "Log in ... or write to" instead, since
  the database refuses their feedback. The button fades out whenever it would
  overlap a button, link or field (`KEEP_CLEAR`, except the footer's "Give
  feedback", which opens the same panel), so it never covers "Apply" or
  "Search jobs" on a phone: keep that working when adding pages.
- `src/pages/Home.jsx`: hero (headline, keyword + "No Italian needed" search
  that opens `/jobs` with those filters), the 5 newest live jobs, "How it
  works". Show only real data: no sample listings, ratings, numbers or
  features that don't exist.
- `src/styles/site.css`: tokens, base styles and shared components; page
  styles live next to it (`auth.css`, `header.css`, `jobs.css`, `home.css`, `feedback.css`,
  `account.css`, `employer.css`, `admin.css`).
  No CSS framework.
- `public/`: copied into `dist/` as is: `_headers` (cache rules),
  `favicon.ico` (16 and 32 px, flat purple on a white tile),
  `apple-touch-icon.png`, `og-image.png` (link previews, referenced from
  `index.html` with absolute https://gigome.org URLs), and `brand/` (the
  original logo JPEGs, transparent PNGs cut from them, and the header WebPs).
  Don't put the logo or other images in auth emails: they get blocked and
  hurt deliverability.
- `wrangler.jsonc`: assets from `./dist`, `not_found_handling`
  `"single-page-application"`, a cron trigger (daily, 04:17 UTC) and
  `keep_vars: true`. `worker/index.js` is a tiny Worker script for the daily
  Supabase ping (`scheduled`: one read with the publishable key, from the
  runtime variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` set in the
  Cloudflare dashboard). Pages and files are served as static assets without
  running it; its `fetch` only hands the rare unmatched non-page request back
  to `env.ASSETS`. Never add `run_worker_first` or routing to it: every
  request that runs the script counts against the free plan.
- `supabase/queries/kpis.sql`: read-only KPIs for the SQL Editor (one table).
  `HANDOVER.md`: accounts, how changes go live, moderation, limits.
- `src/lib/supabase.js`: the only Supabase client (publishable key). If the
  build variables are missing it exports `supabase = null` and
  `supabaseConfigError`; pages then show `ConfigError` instead of crashing
  (the home page shows its hero and a short notice instead of the jobs).
- `src/lib/contact.js`: `CONTACT_EMAIL`, the only place the contact address
  is set.

A PR that only restructures must not change the look: compare screenshots
of the built site before and after.

## Email

- All auth emails are sent by Supabase Auth through Brevo SMTP. The SMTP
  settings live only in the Supabase dashboard. Never put SMTP keys, API keys
  or any Brevo credentials in the repo, or in env files committed to it.
- Login uses 6-digit email OTP codes (`signInWithOtp`, then `verifyOtp` with
  `type: 'email'`), never magic links. Brevo rewrites links in emails, so auth
  emails must not depend on a clickable link.
- The sender for auth emails is `no-reply@gigome.org`.
- Brevo's free plan allows 300 emails a day for the whole account. Don't build
  any feature that sends email in bulk (newsletters, notifications to all
  users) without asking first.

## Database (Supabase)

Project ref `ukqqfryhmcgaralzybfs` (Frankfurt). Plain-English overview of the
tables and rules: `SUPABASE.md`.

How changes reach the database
- Supabase's GitHub integration applies new files in `supabase/migrations`
  when a PR is merged into `main`. Merging such a PR changes the production
  database: never merge one without the owner's explicit go-ahead.
- `supabase/` stays at the repository root (the integration's working
  directory is `.`).
- Never log in to Supabase or connect to the database. Write migrations as
  files only, named `<YYYYMMDDHHMMSS>_<name>.sql`. Never edit a migration that
  is already on `main`; add a new one.
- No `supabase/config.toml` unless the integration strictly needs it. Auth,
  SMTP (Brevo), email templates and rate limits are set in the dashboard and
  must not be overwritten. If config.toml ever becomes necessary, explain why
  and keep every auth and email setting out of it.
- The project has "automatically expose new tables" OFF and automatic RLS ON.

Client
- `src/lib/supabase.js` reads `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` (names listed in `.env.example`, no values).
- No real keys anywhere in the repo. The secret / service_role key must never
  appear in the repo or in frontend code.

Security rules for every migration (non-negotiable)
- Enable RLS explicitly on every table in the same migration that creates it.
- Revoke all from `public`, `anon` and `authenticated`, then GRANT exactly
  what each needs, column by column where it matters. `admins` and
  `job_contacts` get no grants at all.
- SECURITY DEFINER functions: `set search_path = ''`, schema-qualify every
  name, revoke EXECUTE from `public`, `anon`, `authenticated`, then grant it
  only to the roles that call the function.
- `is_admin()` and other helpers used in policies are only granted to
  `authenticated`, so only use them in policies that are `to authenticated`.

Schema rules
- `profiles` rows are created by the `on_auth_user_created` trigger. A user is
  a `student` (with `university_id`) when the lowercased part of their email
  after the @ exactly matches one of `universities.email_domains`; everyone
  else is a `company`. Users can edit only `full_name`, `degree_level` and
  `graduation_year`; nobody can change `account_type` or `university_id` from
  the client.
- When a university is added or its `email_domains` change, the
  `on_university_domains_changed` trigger upgrades matching `company` accounts
  to `student` (with `university_id`), except accounts that own a company.
  Nothing ever downgrades an account automatically.
- `universities` is read-only for `anon` and `authenticated` (no write grants,
  no write policies). It is changed only in the dashboard.
- Company accounts create and edit their own company (one per account) but
  never its `status`. Creating it requires `terms_accepted_at` (the owner
  ticked "I accept the terms"); a trigger replaces whatever time is sent with
  the database's `now()`, and there is no update grant, so it is set only on
  creation. Once it is approved, its owner can't change `name` or
  `website` any more (trigger `lock_approved_company_identity`: API callers
  who aren't admins are refused; the dashboard and admin functions are not);
  `description` and `contact_email` stay editable, and the dashboard shows
  name and website read-only with "To change these, write to hello@gigome.org.". Nobody reads `companies.contact_email` directly:
  `get_company_contact_email(company_id)` returns it to the owner and admins.
- Job statuses: `draft`, `pending` (in review), `published`, `closed`,
  `changes_requested`, `rejected`. Owners can set only `draft`, `closed` or
  `pending`, and `pending` only once their company is approved. They can't
  edit `rejected` jobs at all, delete only drafts, and can't keep a published
  job published while editing it. Only admins publish, request changes or
  reject, with `admin_review_job(job_id, status, note)` (a note is required
  for `changes_requested` and `rejected`; publishing clears it), which also
  sets `reviewed_by` and `reviewed_at`. `review_note`, `reviewed_by` and
  `reviewed_at` have no insert or update grants; anon can't read them and
  nobody reads `reviewed_by` through the API (jobs have column-level SELECT
  grants: list columns explicitly, never `select=*`).
- `my_job_stats()` returns apply clicks (not applications) for the caller's own jobs only.
- `areas` is read-only for `anon` and `authenticated`, changed only in the
  dashboard. Jobs have `area_id`, `latitude`, `longitude` and
  `show_exact_location`; the `job_location_privacy` trigger replaces the point
  with the area's centre (or null) whenever `show_exact_location` is false,
  and checks keep points in pairs and inside the Milan metro box (lat
  45.25–45.70, lng 8.70–9.60).
- `metro_stations` is read-only for everyone; its rows come from
  `scripts/fetch-metro-stations.mjs` (OpenStreetMap, ODbL) as a data
  migration, run on GitHub by the hand-started workflow
  `.github/workflows/metro-stations.yml`: it fails unless it finds 100 to 130
  stations with some on every line, writes the count per line in the run's
  summary, and pushes the migration to a new branch `data/metro-stations`
  (it stops if that branch exists). A pull request from it is a migration
  like any other. `job_nearest_station` (runs after `job_location_privacy`: triggers
  fire in name order) stores `nearest_station_id`/`nearest_station_m` for
  exact locations only. `job_published_at` sets `published_at` on the first
  publication. Neither column has insert or update grants. `category` is one
  of the eight values in `CATEGORIES` (`src/lib/jobs.js`).
- `saved_jobs`: students insert only `job_id` (`user_id` is the caller, by
  default and by policy) for a job they can see; they read and delete only
  their own rows; no updates. Rows go with the account (`auth.users`, on
  delete cascade) and with the job. `my_saved_jobs()` lists the caller's own
  only.
- `job_reports`: logged-in users insert `job_id`, `reason`, `details` for a
  job they can see (RLS), one open report per user per job (unique index);
  only admins read them, and only `admin_resolve_report(id, note)` resolves
  them. `moderation_log`: every admin decision (who, when, what, note),
  written only by the admin functions (`admin_set_company_status`,
  `admin_review_job`, `admin_resolve_report`), read only by admins. A new
  admin action must write to it too.
- Job contacts are only revealed to logged-in students by
  `reveal_job_contact(job_id)`, which also writes `job_clicks`.
- `delete_my_account()` deletes only the caller (no arguments, `auth.uid()`):
  their feedback explicitly, then the `auth.users` row, which cascades to the
  profile, their saved jobs and, for a company account, its company, jobs, job contacts and
  those jobs' clicks (and reports on those jobs). Their own clicks and the
  reports they filed stay, with `user_id` / `reporter_id` set to null. Keep
  it that way if you add a table that points at a user: decide whether it is
  deleted or kept anonymous, and add a check.

Security check
- `supabase/checks/security_check.sql` is pasted into the SQL Editor after a
  merge. It must end with one SELECT of `check_name, expected, actual,
  passed` and leave no data behind. When a migration adds a table, policy or
  function, add checks for it there too.
