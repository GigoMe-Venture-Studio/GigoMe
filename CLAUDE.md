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
  anything suggesting a university's endorsement or affiliation anywhere
  (the legal texts on `/privacy` and `/terms` name the operator, as the law
  requires). The one place a university is named is the student login's list
  of who can log in, shown only when an address is refused, under the line
  "GigoMe is an independent student project, not affiliated with or endorsed
  by any university." (always on the student login; it never names a
  university). `ScrollToTop` (in `App.jsx`) starts each new path at the
  top, except on Back/Forward and query-only changes. Don't
  add placeholder pages for features that aren't built.
- Job board: `src/pages/Jobs.jsx` (list, filters kept in the URL:
  `?q=&area=&category=&type=&remote=yes|no&italian=none|basic&hours=&when=&lang=`
  (`when` and `lang`: comma lists from `SCHEDULES` and `LANGUAGES` in
  `src/lib/jobs.js`, written in list order, matched with PostgREST `ov`;
  flexible jobs always match a `when` filter; `minpay` = 1–30 €/h on
  `pay_hourly` (a slider, `MinPay` in `Jobs.jsx`, in the folded panel on
  phones), which hides every job without an hourly equivalent (paid per
  project, pay not specified): the page says e.g. "5 jobs hidden:
  paid per project or pay not specified" naming only the kinds
  present (`fetchHiddenByPay()` reads only their pay unit, `hiddenKinds()`)
  with "Show them" = `nohourly=yes` (older links' `projects=yes` still
  works). Jobs paying less than the minimum aren't counted: hiding them is
  the point; `sort=pay` = "Highest pay", by
  `pay_hourly`, nulls last; sorting isn't a filter), plus `view=map`
  for the map, which isn't a filter; `q` matches title and
  description and goes through `cleanKeyword()`, which keeps only letters,
  numbers, spaces, hyphens and apostrophes so it can't break the PostgREST
  `or()` filter; on phones, under 768px, every filter except the keyword is
  folded behind a "Filters" button that shows how many are set, so the first
  job is visible without scrolling), `src/pages/JobDetail.jsx`
  (job, company, "How to apply"), logic in `src/lib/jobs.js`. Queries ask for
  live jobs explicitly (published, not expired, approved company), because
  company owners and admins can also read jobs that aren't live. Lists are
  newest first by `published_at` (when the job went live), then
  `created_at`; "Posted ..." counts from `postedAt()` (`published_at`, else
  `created_at`), never from when the draft was started.
  One "Apply" button: for a logged-in student it calls `reveal_job_contact`
  and opens the destination at once (the application page in a new tab,
  opened during the click so pop-up blockers allow it, or the email app with
  the subject "Application: <title> (via GigoMe)"; a link wins over an
  email), and shows the contact underneath in case nothing opened.
  `reveal_job_contact` counts an apply click on every call: call it only when
  a student presses "Apply", never on page load. We count "apply clicks",
  never "applications": GigoMe doesn't see whether anyone applied. Logged-out visitors go
  to `/login?next=/jobs/<id>`; `safeNext()` (`src/lib/links.js`, re-exported
  by `auth.js`) only accepts paths on this site (no `//`, backslashes,
  control characters or other origins).
- Links and emails from users: `src/lib/links.js` (no imports, unit-tested in
  `tests/unit/`). `safeHttpUrl()` before any user link goes into an `href` or
  is opened (the apply link, websites via `websiteHref()`), `mailtoHref()`
  only for plain addresses, `normalizeUrl()`/`isPlainEmail()` in forms: the
  same patterns as the database's checks. No `innerHTML` or
  `dangerouslySetInnerHTML` anywhere: user text is rendered as text.
- Daily limits: the database refuses with errcode 54000 and a message for
  people ("Daily limit reached: ..."); `dailyLimitMessage()`
  (`src/lib/limits.js`) shows it as it is (feedback, reports, saves,
  searches, follows, job submissions).
- Map: MapLibre GL (`src/lib/maplibre.js` sets its worker URL for Vite,
  `src/lib/map.js`) with OpenFreeMap's "positron" style and the
  OpenStreetMap attribution always visible, with the metro credit next to it
  (`STATIONS_CREDIT`: "Metro: Comune di Milano, CC BY 4.0"; keep it).
  Every map (`createMap()`) draws M1–M5 in their colours (`LINE_COLOURS`),
  station dots from zoom 12 and names from 13.5, from the static file
  `public/metro/milan-metro.geojson` (built by `scripts/build-metro-map.mjs`
  from DS535 + DS533; no database), with a "Metro" button to hide them
  (kept in sessionStorage, per tab, only). Only ever loaded with `import()` /
  `React.lazy` (`src/components/JobsMap.jsx`, `LocationPicker.jsx`,
  `JobPlaceMap.jsx`), so list pages stay light; helpers a page needs without
  a map (distances, the `?map=` param) live in `src/lib/geo.js`, never in
  `map.js`. `/jobs` has List | Map (desktop, from 900px: side by side; phone:
  one or the other); the map shows exactly the list's jobs, minus remote jobs
  and jobs without coordinates, clustered with counts when zoomed out; single
  jobs are button markers that show `shortPay()` from zoom 13 and open a
  popup (desktop) or a bottom card (phones, `.map-sheet`). The map position
  is in the URL (`?map=zoom/lat/lng`), and filters don't move a map the
  person chose. Desktop: "Search as I move the map" (on by default) limits
  the list to the visible area; phones: "Search this area" after moving it.
  Either way remote and unlocated jobs stay listed under "Remote / no
  location". "Use my location" asks the browser only when pressed; the
  position stays in React state (never in the URL, storage, or any request:
  `?map=` isn't written while it is shown), centres the map with a "You are
  here" dot and offers "Sort by distance"; keep the line "Stays on your
  device: never sent to GigoMe or saved." next to the button. Job pages
  (`JobPlaceMap.jsx`, loaded when within 300px of the screen) show the pin
  and nearest station, or a dashed circle for area-only jobs, and a plain
  "Open in Google Maps" link (`googleMapsHref()`, rel noreferrer; nothing is
  sent to Google unless clicked). Areas come from
  `src/lib/areas.js` (the `areas` table). The job form picks the area, then an
  optional pin (tap, drag, or "Find address": one Nominatim request per press
  from `src/lib/geocode.js`, bounded to Milan, never autocomplete, credited
  on the form), or "Only show the area".
- Badges on job cards and job pages: "New" (`isNew()`: published in the last
  3 days, gold), the category, and the metro badge (`metroLabel()`: only for
  an exact location within 1000 m of a station, at 80 m a minute walking).
- Example listings (made up for testers until the public launch; loaded and
  removed by hand with `supabase/seed/examples.sql` / `remove_examples.sql`,
  SUPABASE.md "Example listings"): `isExample()` in `src/lib/jobs.js` (the
  job's or its company's `is_example`; every job and company query reads
  it). Real listings always come before examples in every list, each group
  in its usual order: `fetchJobs()` orders by `is_example` first (so limits
  like the home page's 5 take real ones first), and any list re-sorted on
  the page goes through `realFirst()` (distance, saved order, followed
  companies, the map's multi-job card). Every
  card (`JobCard`, first, before the title), map card and page shows the
  graphite badge `EXAMPLE_JOB_LABEL` "Example listing, not a real job"
  (`.tag-example`); job and company pages also start with
  `ExampleNotice.jsx` (companies: "Example company, not a real employer").
  Their pages are noindex and get no JobPosting data. "Apply" on an example
  never calls `reveal_job_contact` (the database refuses it too) and opens
  nothing: it explains instead. Anything new that shows a job or company
  must show the badge too.
  Company pages: `src/pages/Company.jsx` (`/companies/:id`): approved
  companies only (asked for explicitly), name, description, website and open
  jobs with the map when some have a location; never the contact email.
  Linked from job pages.
- Saved jobs: `src/lib/saved.js` (one shared list of the student's saved job
  ids, loaded once per login; `useSavedJobs()`, `setSaved()`),
  `src/components/SaveButton.jsx` (the bookmark on job cards, next to the
  card's link, not inside it, and on job pages; for students; logged out
  it's a link to `/login?next=/jobs/<id>` that saves nothing; company
  accounts get none; never on the home page's cards (`JobCard save={false}`),
  for anyone, so the Feedback button is fully visible there at first load;
  on job pages it holds its place, invisible, until the login state is
  known),
  `src/pages/Saved.jsx` (`/saved`, "Saved jobs" in the header for students;
  jobs that closed or expired show as "No longer available" from
  `my_saved_jobs()`). `/saved` also holds, from `src/lib/student.js`: saved
  searches ("Save this search" on `/jobs` when filters are set, students
  only; "N new since your last visit" = live matches published after
  `last_seen_at`, which opening the search resets), "New from companies you
  follow" (live jobs of followed companies from the last 14 days; "Follow"
  on company pages, students only) and "Jobs you opened" from
  `my_opened_jobs()`, labelled exactly "You opened the application on
  <date>": never "applied" anywhere. All in the app only: nothing is
  emailed.
- Paid part-time jobs and gigs only: no internships and nothing unpaid
  anywhere (job types gig, part-time, other; pay per hour, month or
  project). The tagline is "Part-time jobs and gigs in Milan, in English."
  (home page headline, titles, meta and the share image). An older job
  with `internship` or `unpaid_curricular` shows no type and "Pay not
  listed", and the job form starts both fields empty so the owner chooses
  again.
- Pay: `payLabel()` in `src/lib/jobs.js` everywhere ("€11–13/h",
  "€600/month (≈ €12/h)", "€500 per project"; jobs from before structured
  pay show their pay text);
  `payNote()` shows the free-text `pay` as a note once pay is structured;
  `markerPay()` for map markers. The job form asks how it's paid
  (`PAY_UNITS`), the amount(s), shows the hourly equivalent live for monthly
  pay, and keeps "Pay note". Keep `monthlyHours()` the same formula as the
  database.
- Job page body: `src/components/JobView.jsx`, in three parts: head (title
  to the facts), "How to apply", body. From 900px "How to apply" is the
  right-hand column; on phones the parts stack in that order, so "Apply"
  comes right after the pay and hours. Nothing below "How to apply" may move
  when the login state arrives (the map would load too early and the page
  jumps): while it loads the box holds the logged-out content, invisible,
  and then keeps at least that height until the width changes
  (`HowToApply` in `JobDetail.jsx`; a map-finish check measures it). Used by `/jobs/:id` and by
  the job form's "Preview" (same component, so the preview is exactly what
  students see; in a preview Save, Share, Report and Apply are shown but do
  nothing, nothing is saved, and the metro badge is worked out from
  `public/metro/milan-metro.geojson` as the database will). "Share"
  (`ShareButton.jsx`): the phone's share sheet on touch screens with
  `navigator.share`, else "Copy link" with a confirmation (or the link shown
  to copy by hand). Schedule tags sit next to the Italian tag on cards so the
  first job still fits on a 320×568 screen.
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
  profile has no name yet, and the Terms box until the current version is
  accepted), logic in `src/lib/auth.js`, session in
  `src/lib/useSession.js`. Only emails whose domain is in `universities` get
  a code. Under the email field: what the email is used for and a link to
  the Privacy Notice (people don't "agree" to a privacy notice: never write
  that). When an address is refused, the student login reads `universities`
  (readable logged out) and lists each university with its domains and "Is
  your university missing? Email hello@gigome.org" (a mailto link). `/welcome` and `/account` share the profile fields and their rules
  (`src/components/ProfileFields.jsx`, `checkProfile()` in
  `src/lib/profile.js`); after saving they call `announceProfileChange()` so
  the header shows the new name.
- Terms acceptance: every account (students and companies) ticks "I'm 18 or
  older and I accept the Terms" (`TermsCheckbox.jsx`: "Terms" links to
  `/terms`, a hint links to `/privacy`, both in a new tab) on `/welcome` or on
  the employer setup, which calls `accept_terms(TERMS_VERSION)`
  (`src/lib/terms.js`). `TERMS_VERSION` there is the only place the version
  is set: change it with a new Terms file and everyone is asked again.
  `TermsGate` (`src/components/TermsGate.jsx`, around the routes in
  `App.jsx`) sends a logged-in account that hasn't accepted the current
  version to `/welcome?next=<page>` once (checked once per login), except on
  `/welcome`, `/login`, `/employers`, `/employers/setup`, `/privacy`, `/terms`
  and `/account` (to read the texts, download the data or delete the account
  without accepting). `/welcome` asks only the Terms ("Before you continue")
  when the details are already there or it's a company account. The test
  mocks accept the current version by default (`termsVersion` option).
- Account: `src/pages/Account.jsx` (`/account`, reached from the name in the
  header and the phone menu; logged out goes to `/login?next=/account`).
  Email and university are read-only. "Delete my account" first shows a
  reminder with "Keep my account" and "Delete my account" side by side, then
  needs DELETE typed,
  calls `delete_my_account()` (`src/lib/account.js`), goes to `/` with "Your
  account has been deleted" and then clears the session on this device.
  "Download my data" (`src/lib/myData.js`) builds a JSON file in the browser
  from the user's own rows and RPCs (`my_feedback`, `my_reports`,
  `my_saved_jobs`, `my_opened_jobs`, and for companies their company, jobs,
  contacts and clicks); nothing is stored. A new table holding user data
  must be added to it.
  `/privacy` and `/terms` show the legal texts word for word as supplied:
  the files in `docs/legal/published/` (never edit their wording; a new
  version is a new file from the team's legal person), turned into
  `src/legal/*.json` by `node scripts/legal-to-json.mjs <in.html> <out.json>`
  and rendered by `src/components/LegalDocument.jsx` with React elements
  (never as HTML), in our layout (`legal.css`), keeping the section ids
  (`/privacy#section-10`), with tables that scroll sideways on phones.
  `tests/unit/legal.test.mjs` checks the wording word for word against the
  supplied file. Both pages are loaded only when opened, and are in the
  footer.
- Employer side: `src/pages/Employers.jsx` (`/employers`: pitch and employer
  login), `EmployerSetup.jsx` (`/employers/setup`: a company account without
  a company creates it, status pending; "I'm 18 or older and I accept the
  Terms" must be ticked: the account records the version (`accept_terms`)
  and the database stores the company's `terms_accepted_at`), `Dashboard.jsx` (`/dashboard`:
  company details and status, jobs with status, review notes and apply
  clicks from `my_job_stats()`, "Expires in N days" and "Extend by 60 days"
  (`extend_my_job()`, no new review; for jobs expired more than 14 days a
  message to edit and resubmit instead)), `JobEditor.jsx` (new/edit job and how
  to apply; "Show until" at most 60 days ahead, an unchanged date isn't sent
  again). Logic in `src/lib/employer.js`, account state in
  `src/lib/useCompanyAccount.js`, gate in `src/components/EmployerGate.jsx`.
  A job is saved as a draft, then its contact (`set_job_contact`), then its
  status, so it is never submitted without a contact; a published job is
  edited in one update that sends it back to `pending`. Contact email is read
  only through `get_company_contact_email()`. Styles in `employer.css`.
- Moderation: `src/pages/Admin.jsx` (`/admin`, logic in `src/lib/admin.js`,
  styles in `admin.css`). Only admins (`is_admin()`); everyone else, logged
  out included, gets the 404 page, and the database refuses them anyway.
  At the top, the numbers from `admin_stats()` (same definitions as
  `supabase/queries/kpis.sql`).
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
  puts a fixed "Feedback" button at the bottom right of every page (under
  768px a round 44px icon, its label kept for screen readers) and opens
  a panel (native `<dialog>`); the footer's "Give feedback" opens it too via
  `useOpenFeedback()`. Logged-in users insert `page` and `message` (max 2000)
  through `sendFeedback()` in `src/lib/feedback.js`; the database sets
  `user_id`. Logged-out visitors get "Log in ... or write to" instead, since
  the database refuses their feedback. The button fades out whenever it would
  overlap a button, link or field (`KEEP_CLEAR`, except the footer's "Give
  feedback", which opens the same panel), so it never covers "Apply" or
  "Search jobs" on a phone: keep that working when adding pages.
- `src/pages/Home.jsx`: hero (headline, keyword + "No Italian needed" search
  that opens `/jobs` with those filters), the 5 newest live jobs (cards
  without Save buttons), "How it works". Show only real data: no sample
  listings, ratings, numbers or features that don't exist (the example
  listings from the database are the one exception: badged, never indexed,
  removed before launch). The Feedback
  button must be fully visible at first load, logged in or out, on desktop
  and at 375px (checked in `feedback.test.js`).
- `src/styles/site.css`: tokens, base styles and shared components; page
  styles live next to it (`auth.css`, `header.css`, `jobs.css`, `home.css`, `feedback.css`,
  `account.css`, `employer.css`, `admin.css`, `error.css`).
  No CSS framework. The accent is the logo's purple `#A46BD6` (`--purple`,
  `--accent`): text on it is graphite (4.5:1), never white. No inline
  `style` attributes in `index.html` (the CSP has no 'unsafe-inline').
  `.tap-44` (site.css) gives a small text button a 44px-tall tap area
  without changing the layout ("Clear filters", "Use a different email",
  "Report this job").
- Errors: `src/components/ErrorBoundary.jsx`: `PageErrorBoundary` around the
  routes (header, footer and feedback keep working; any navigation tries
  again) and `AppErrorBoundary` around everything (plain fallback). Job
  lists (`fetchJobs()`) give up after 15 seconds (`JOBS_TIMEOUT_MS`), so a
  stalled connection shows the list's error and "Try again", never
  "Loading jobs…" for ever.
- Titles and search engines: `src/lib/seo.js`. `RouteMeta` (in `App.jsx`)
  sets each fixed page's title, description, canonical link and "noindex"
  for private pages from `PAGES`; job and company pages use `usePageMeta()`;
  job pages add schema.org JobPosting with `useJsonLd(jobPostingData(job))`
  (`<` escaped). `index.html` has a static schema.org WebSite block (`name`
  "GigoMe", `url` https://gigome.org/) so search results show "GigoMe" as
  the site name; it's a data block, never run, so the CSP allows it.
  `public/robots.txt` and `public/sitemap.xml` (fixed pages only). Add a new
  page to `PAGES`.
- `public/_headers`: cache rules and the security headers for every path:
  Content-Security-Policy (only gigome.org, Supabase, OpenFreeMap,
  Nominatim, Turnstile and Cloudflare Web Analytics; no inline scripts or
  styles, `frame-ancestors 'none'`), Referrer-Policy, nosniff,
  X-Frame-Options, Permissions-Policy (geolocation only for our own pages),
  HSTS. `__SUPABASE_ORIGIN__` is replaced at build time from
  `VITE_SUPABASE_URL` by the plugin in `vite.config.js`. A new outside
  service needs a line there, in HANDOVER.md 7b and in the privacy notice;
  the browser tests fail on any CSP violation.
- `public/`: copied into `dist/` as is: `_headers` (above),
  `favicon.ico` (16, 32 and 48 px) and `favicon-192.png` (192x192, linked
  from `index.html`): the G mark with flat purple `#8A55C4` on a white tile
  with rounded corners (padding 1/16 of the size, corner radius 1/5),
  `apple-touch-icon.png`, `og-image.png` (link previews: 1200x630, the logo
  and the home page headline on a white card framed in the brand purple;
  rebuilt with `node scripts/build-og-image.mjs` when the headline changes;
  referenced from `index.html` with absolute https://gigome.org URLs, with
  `og:image:alt`; `tests/unit/share-preview.test.mjs` checks both and that
  the line matches the headline), and `brand/` (the
  original logo JPEGs, transparent PNGs cut from them, and the header WebPs).
  Don't put the logo or other images in auth emails: they get blocked and
  hurt deliverability.
- `wrangler.jsonc`: assets from `./dist`, `not_found_handling`
  `"single-page-application"`, a cron trigger (daily, 04:17 UTC),
  `keep_vars: true` and Workers Logs (`observability`, sampling 1): only runs
  of the Worker script are logged (the ping and rare unmatched requests,
  never static assets), so it stays far inside the free plan's 200,000
  events a day; logs are kept 3 days. `worker/index.js` is a tiny Worker script for the daily
  Supabase ping (`scheduled`: one read with the publishable key, from the
  runtime variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` set in the
  Cloudflare dashboard). Pages and files are served as static assets without
  running it; its `fetch` only sees the rare unmatched non-page request: a
  missing file under `/assets/` gets a plain 404 with `Cache-Control:
  no-store` (`assetNotFound()`, unit-tested), everything else goes back to
  `env.ASSETS`. A missing `/assets/` URL typed into the address bar still
  gets the home page (page loads never run the script). Never add
  `run_worker_first` or routing to it: every request that runs the script
  counts against the free plan.
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

One project, in Frankfurt (its ID is in the Supabase dashboard; keep IDs out
of the repo). Plain-English overview of the tables and rules: `SUPABASE.md`.

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
  the client. `terms_version` / `terms_accepted_at` (both or neither) are
  written only by `accept_terms(version)` (a version number like `2.0`, the
  database's `now()`, the caller's own row).
- When a university is added or its `email_domains` change, the
  `on_university_domains_changed` trigger upgrades matching `company` accounts
  to `student` (with `university_id`), except accounts that own a company.
  Nothing ever downgrades an account automatically.
- `universities` is read-only for `anon` and `authenticated` (no write grants,
  no write policies). It is changed only in the dashboard.
- Company accounts create and edit their own company (one per account) but
  never its `status`. Creating it requires `terms_accepted_at` (the owner
  ticked the Terms box); a trigger replaces whatever time is sent with
  the database's `now()`, and there is no update grant, so it is set only on
  creation. Once it is approved, its owner can't change `name` or
  `website` any more (trigger `lock_approved_company_identity`: API callers
  who aren't admins are refused; the dashboard and admin functions are not);
  `description` and `contact_email` stay editable, and the dashboard shows
  name and website read-only with "To change these, write to hello@gigome.org.". Nobody reads `companies.contact_email` directly:
  `get_company_contact_email(company_id)` returns it to the owner and admins.
- An on-site job (`remote` false) needs an `area_id` to be submitted or
  published (trigger `job_area_required`, admins included); drafts and remote
  jobs don't, the pin stays optional. It only fires when status, remote or
  area_id change, so old live jobs without an area keep working; /admin lists
  them ("Live jobs without an area") and flags pending ones (Publish off).
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
- Example listings: `companies.is_example` / `jobs.is_example` (default
  false), readable by everyone, no insert or update grants (only the SQL
  Editor sets them). Example companies have no owner: `owner_id` may be
  empty only when `is_example` (check `companies_owner_unless_example`).
  `reveal_job_contact` refuses example jobs (no click recorded);
  `my_saved_jobs()` returns `is_example`; `admin_stats()` and `kpis.sql`
  leave example companies, jobs and their clicks out (keep both the same).
  The seed never switches a database rule off: example jobs meet every
  rule real jobs do. `supabase/seed/` holds the hand-run
  load and removal scripts: never a migration, never applied
  automatically. `tests/db/run-check.sh` loads them, runs the security
  check with them in, removes them and checks only the example side went:
  keep both scripts working when the schema changes (a new required
  column or rule, a new table pointing at jobs or companies).
- `areas` is read-only for `anon` and `authenticated`, changed only in the
  dashboard. Jobs have `area_id`, `latitude`, `longitude` and
  `show_exact_location`; the `job_location_privacy` trigger replaces the point
  with the area's centre (or null) whenever `show_exact_location` is false,
  and checks keep points in pairs and inside the Milan metro box (lat
  45.25–45.70, lng 8.70–9.60).
- `metro_stations` is read-only for everyone; its rows come from
  `scripts/fetch-metro-stations.mjs` (City of Milan open data, dataset
  DS535, Comune di Milano, CC BY 4.0) as a data migration, run on GitHub by
  the hand-started workflow `.github/workflows/metro-stations.yml`: it fails
  unless every check passes (115 to 130 stations, at least 15 per line, no
  station twice or under two names, no unknown abbreviation, Duomo, Porta
  Venezia, Garibaldi FS and Centrale FS with the right lines in the right
  place), writes the count per line in the run's summary, compares the
  result with main (`scripts/metro-changed.mjs`: the newest station
  migration minus its header comment, and the map file) and, only if
  something changed, pushes what changed to a new branch
  `data/metro-stations` (it stops if that branch exists); otherwise it ends
  green with "No changes, nothing pushed". The security check's station test uses its own stations at
  45.30, 8.80, far from real ones: keep it there. A pull request from it is a migration
  like any other. `job_nearest_station` (runs after `job_location_privacy`: triggers
  fire in name order) stores `nearest_station_id`/`nearest_station_m` for
  exact locations only. `job_published_at` sets `published_at` on the first
  publication. Neither column has insert or update grants. `category` is one
  of the eight values in `CATEGORIES` (`src/lib/jobs.js`).
- `jobs.schedule` (weekday_mornings, weekday_afternoons, weekday_evenings,
  weekends, flexible) is required to submit or publish (trigger
  `job_schedule_required`, admins included; fires only when status or
  schedule change, so older live jobs keep working and /admin lists them);
  `jobs.languages` (en, it, es, fr, de, zh, ar, other) is optional. Both are
  stored sorted without repeats and readable like the rest of a job. The
  security check gives every test job a schedule (and an area): keep doing
  that for new test jobs.
- No internships, nothing unpaid: trigger `job_no_internships` (admins and
  the dashboard included) refuses any new job with `job_type` `internship`
  or `pay_unit` `unpaid_curricular`, any change to either value, and
  submitting or publishing a job that still has one. Older rows with them
  can still be closed, edited otherwise, deleted and cleaned up by
  `run_retention()` (`tests/db/legacy-internships.sql`). The values are
  still in the check constraints so those rows stay valid; drop them in a
  later migration once no row uses them.
- Structured pay: `pay_unit` (hour, month, project; `unpaid_curricular`
  only on older rows, see above), `pay_min` (> 0) and `pay_max` (optional,
  never below min). Required
  to submit or publish (trigger `job_pay_required`, admins included; fires
  only when status or pay_unit change). `pay_hourly` is a generated column
  (hour: pay_min; month: pay_min ÷ (hours × 52 ÷ 12); none otherwise): a
  range counts as its lower end; nobody writes it. The free-text `pay` stays
  as an optional note. The security check gives every test job €10/h.
- `saved_searches` (name, `params` = the /jobs query string, last_seen_at)
  and `company_follows` (company_id): students only, for themselves only
  (`user_id` has no insert grant), read and deleted only by their owner,
  deleted with the account (and follows with the company). At most 20
  saved searches (trigger `saved_searches_limit`); `last_seen_at` is always
  the database's now() (trigger `saved_search_seen_now`). Only approved
  companies can be followed. Companies never see who follows them, only
  `my_company_follower_count()` on their dashboard.
- Students read their own `job_clicks` rows (and nobody else's);
  `my_opened_jobs()` returns them per job with title, company and whether
  it's still live.
- `saved_jobs`: students insert only `job_id` (`user_id` is the caller, by
  default and by policy) for a job they can see; they read and delete only
  their own rows; no updates. Rows go with the account (`auth.users`, on
  delete cascade) and with the job. `my_saved_jobs()` lists the caller's own
  only.
- `job_reports`: logged-in users insert `job_id`, `reason`, `details` for a
  job they can see (RLS), one open report per user per job (unique index);
  only admins read them, and only `admin_resolve_report(id, note)` resolves
  them. A report outlives its job and company: triggers
  `job_reports_keep_job` / `job_reports_keep_company` (SECURITY DEFINER,
  before delete) copy only the job title and company name into
  `job_title` / `company_name` (no grants) and empty `job_id`; /admin and
  `my_reports()` show them. `moderation_log`: every admin decision (who, when, what, note),
  written only by the admin functions (`admin_set_company_status`,
  `admin_review_job`, `admin_resolve_report`), read only by admins. A new
  admin action must write to it too.
- Job contacts are only revealed to logged-in students by
  `reveal_job_contact(job_id)`, which also writes `job_clicks`.
- `delete_my_account()` deletes only the caller (no arguments, `auth.uid()`):
  their feedback explicitly, then the `auth.users` row, which cascades to the
  profile (with the Terms acceptance), their feedback, saved jobs, saved
  searches and follows and, for a company account, its company, jobs, job
  contacts and those jobs' clicks (reports on those jobs stay, with only the
  job title and company name). Their own
  clicks and the reports they filed stay, with `user_id` / `reporter_id` set
  to null; admins' decisions, reviews and resolutions stay without them.
  Deleting a user in the dashboard (Authentication > Users > Delete) does
  exactly the same, through the foreign keys alone (table by table in
  SUPABASE.md, "When someone deletes their account"). Keep it that way if
  you add a table that points at a user: `on delete cascade` or `set null`,
  never a rule that blocks the delete; the security check lists every such
  column and fails on a new one until its expected list is updated.

- Links and emails: `companies.website` and `job_contacts.apply_url` only
  `http(s)://` with a dotted host and no spaces, quotes or angle brackets;
  `contact_email` and `apply_email` plain addresses (checks; older apply
  values were left alone and are counted by the security check).
- Daily limits (rolling 24 hours, triggers, errcode 54000): feedback 20,
  reports 10, saved jobs + saved searches + follows 50 together, per user;
  jobs sent to `pending` 10 per company (`jobs.submitted_at`, no grants).
- Job expiry: a non-admin can't set `expires_at` more than 60 days ahead
  (trigger `job_expiry_limit`, only when it changes); `extend_my_job(id)`
  sets it to now + 60 days for a published job of the caller's own approved
  company, without a new review, only while it's live or expired at most 14
  days ago (`EXTEND_GRACE_DAYS` / `canExtend()` in `src/lib/employer.js` match
  it); older expired jobs are refused and must be edited and resubmitted.
- `my_feedback()` / `my_reports()`: the caller's own rows only (reports
  without the resolution note or resolver). `admin_stats()`: admins only.
- Retention: `retention_settings` (one row, no grants) and `run_retention()`
  (no grants), run daily at 03:37 UTC by pg_cron job `gigome-retention`.
  On (Privacy Notice section 9, owner's go-ahead in November 2026; each a
  day under the Notice's limit, set in migrations so the values are in
  git): incomplete sign-ups deleted after 29 days without a login (no
  Terms, no name, no company, not an admin); listings closed, rejected or
  expired 89 days ago lose contact, saves, description, pay note, free-text
  location and pin, unless reported (`jobs.ended_at`: trigger
  `job_ended_at`, no grants); apply clicks lose `user_id` and keep only the
  day after 179 days (counts unchanged); resolved reports deleted 730 days
  after resolution. The other periods (ended jobs, feedback, inactive
  accounts) stay empty. Never set or shorten a period without the owner's
  go-ahead; change one in a new migration. Never touch Supabase's `auth`
  tables other than `auth.users` from it (`auth.audit_log_entries`: the
  dashboard setting, by hand). The rest (24-month inactivity, security logs,
  email) is done by hand by Emil: `HANDOVER.md` section 7d.

Security check
- `supabase/checks/security_check.sql` is pasted into the SQL Editor after a
  merge. It must end with one SELECT of `check_name, expected, actual,
  passed` and leave no data behind. When a migration adds a table, policy or
  function, add checks for it there too, and add a new function callable by
  `authenticated` to the list in "Logged-in users can call exactly these
  functions".

Tests (CI: `.github/workflows/tests.yml` on every pull request; no secrets)
- `tests/unit/` (`node --test tests/unit/*.test.mjs`).
- `tests/db/run-check.sh`: a throwaway PostgreSQL 16 with
  `tests/db/supabase-stand-in.sql`, every migration, then the security
  check; fails on any false row (except "Automatic RLS") or leftover data.
  Never point it at the real project.
- `tests/e2e/run.sh`: builds the site three ways (test Supabase, none,
  Turnstile), serves them with `_headers` applied (`tests/e2e/serve.mjs`)
  and runs every `tests/e2e/*.test.js` with the mocks in `tests/e2e/lib/`.
  A suite fails on any CSP violation. New features get a suite or checks in
  one. Dependabot (`.github/dependabot.yml`) opens weekly update PRs: minor
  and patch grouped per ecosystem (npm, GitHub Actions), every major alone.
- `docs/legal/`: drafts of the privacy notice and terms for the team's legal
  person, not published.
