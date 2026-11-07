# CLAUDE.md

## Project structure and commands

Vite + React + React Router, in JavaScript (no TypeScript), at the repo root.
Hosted on Cloudflare Workers (static assets) at https://gigome.org, built from
`main`.

- `npm install`, then `npm run dev` (local server), `npm run build` (writes
  `dist/`), `npm run preview` or `npx wrangler dev` (serves `dist/`, the second
  the way Cloudflare does).
- `index.html`: page shell only (`<head>`, fonts, `#root`).
- `src/main.jsx`, `src/App.jsx`: entry point and router. Routes: `/` (home),
  `/jobs`, `/jobs/:id`, `/login`, `/welcome`, `/privacy` and `*` (404). Don't
  add placeholder pages for features that aren't built.
- Job board: `src/pages/Jobs.jsx` (list, filters kept in the URL:
  `?type=&remote=yes|no&italian=none|basic&hours=`), `src/pages/JobDetail.jsx`
  (job, company, "How to apply"), logic in `src/lib/jobs.js`. Queries ask for
  live jobs explicitly (published, not expired, approved company), because
  company owners and admins can also read jobs that aren't live.
  `reveal_job_contact` counts a click on every call: call it only when a
  student presses "How to apply", never on page load. Logged-out visitors go
  to `/login?next=/jobs/<id>`; `safeNext()` in `src/lib/auth.js` only accepts
  paths on this site.
- `src/components/PageShell.jsx`: page frame (content and footer) for every
  React page except the home page.
- New features are React pages and components (`src/pages/`,
  `src/components/`), never code inside `src/legacy/`. Styles for them go in
  their own file (e.g. `src/styles/auth.css`) and reuse the tokens and
  classes in `site.css`. Check new class names don't clash with the demo's
  (`grep` `src/legacy/` and `site.css`).
- Student login: `src/pages/Login.jsx` (email, then 6-digit code),
  `src/pages/Welcome.jsx` (full_name, degree_level, graduation_year when the
  profile has no name yet), logic in `src/lib/auth.js`, session in
  `src/lib/useSession.js`. Only emails whose domain is in `universities` get
  a code. `/privacy` is a placeholder until the owner supplies the text.
- `src/components/SiteHeader.jsx`: the header on every page (rendered once in
  `App.jsx`): GigoMe, Jobs (`/jobs`), About, and "Log in" or the student's
  name and "Log out". Under 768px the links move into a Menu panel. About
  opens a demo screen: on `/` it must be a plain `#about` link (the demo
  routes on `hashchange`, which React Router's `<Link>` never fires);
  elsewhere a `<Link>` to `/#about`. Don't add links for features that don't
  exist yet (no "For employers", "Create profile" or "Post a role").
  `src/styles/header.css` keeps the demo's dark "Demo" bar above it on `/`.
- `src/pages/Home.jsx` mounts the original demo: `src/legacy/markup.html`
  (every screen, including the map SVG) and `src/legacy/app.js` (its script,
  unchanged apart from running inside `mountLegacyApp()`, registering
  window/document listeners through `on()` so they're removed on unmount, and
  having no header of its own: `renderAuth()` is a no-op).
  The demo's screens are hash links (`/#about`, `/#signup`, ...), all under
  `/`; its job links point to `/jobs`, and `Home.jsx` sends clicks on links
  to real paths through React Router. Keep new window/document listeners in
  that file going through `on()`.
- `src/styles/site.css`: the whole stylesheet. No CSS framework.
- `public/`: copied into `dist/` as is (`_headers` with the cache rules,
  and any favicon or images).
- `wrangler.jsonc`: assets from `./dist`, `not_found_handling`
  `"single-page-application"`.
- `src/lib/supabase.js`: the only Supabase client (publishable key). If the
  build variables are missing it exports `supabase = null` and
  `supabaseConfigError`; pages then show `ConfigError` instead of crashing.
  The home page (demo) works without Supabase.
- `src/lib/contact.js`: `CONTACT_EMAIL` for React pages. The demo has its own
  copy in `src/legacy/app.js`; keep both the same.

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
  never its `status`. Owners manage their own jobs and can set only `draft`,
  `pending` or `closed`. Only admins approve companies and publish jobs (with
  `admin_set_company_status` / `admin_set_job_status`, or in the dashboard).
- Job contacts are only revealed to logged-in students by
  `reveal_job_contact(job_id)`, which also writes `job_clicks`.

Security check
- `supabase/checks/security_check.sql` is pasted into the SQL Editor after a
  merge. It must end with one SELECT of `check_name, expected, actual,
  passed` and leave no data behind. When a migration adds a table, policy or
  function, add checks for it there too.
