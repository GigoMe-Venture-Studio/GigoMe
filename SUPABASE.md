# GigoMe database (Supabase)

A plain-English guide to the GigoMe database, for whoever looks after it next.
The rules that coding assistants must follow are in `CLAUDE.md`; the exact SQL
is in `supabase/migrations/`.

## Where things live

- **Project:** Supabase project `ukqqfryhmcgaralzybfs`, hosted in Frankfurt.
- **Changes:** every database change is a SQL file in `supabase/migrations/`.
  When a pull request with a new file there is merged into `main`, Supabase's
  GitHub integration runs it on the live database. Nobody runs SQL by hand to
  change the structure, and nobody edits a migration once it is on `main`:
  write a new one instead.
- **Settings that are not in the repo:** login, email sending (Brevo SMTP),
  email templates and rate limits are set in the Supabase dashboard only.
  There is deliberately no `supabase/config.toml`, so the repo can't overwrite
  them.
- **Keys:** the website uses two values, `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`. Both are safe to show in the browser. The
  secret (service_role) key bypasses every rule below and must never be put in
  the repo or the website.

## How people get an account

Everyone logs in with a 6-digit code sent to their email. The first time they
do, the database creates a **profile** for them automatically:

- If their email ends in a domain listed for a university (for Bocconi,
  `@studbocconi.it`), they become a **student** of that university. The match
  is exact and ignores capital letters: `name@studbocconi.it` counts,
  `name@notstudbocconi.it` doesn't.
- Everyone else becomes a **company** account.

Nobody can switch their own account type or university. Students of a
university that isn't in the list yet first get a company account. As soon
as their university is added (or its domain is added to an existing
university), they are upgraded to students automatically, unless they
already own a company. Nobody is ever downgraded automatically: removing a
domain changes no one.

## The tables

| Table | What it holds | Who can see it | Who can change it |
| --- | --- | --- | --- |
| `universities` | University names and their student email domains. Only Bocconi to start. | Everyone, including logged-out visitors | Only the team, in the dashboard. Not even admins can change it through the website |
| `profiles` | One row per user: account type, university, name, degree level, graduation year | Each user sees only their own; admins see all | Users edit only their name, degree level and graduation year |
| `admins` | The user IDs of admins | Nobody through the website or API | Only the team, in the dashboard |
| `companies` | Employers: name, website, description, contact email, a status (pending, approved or rejected), and when the owner accepted the terms (set by the database on creation) | Everyone sees approved companies; owners see their own; admins see all. The contact email only reaches the owner and admins, through `get_company_contact_email` | Company accounts create one company and edit its details. Only admins change the status |
| `jobs` | Job listings: title, description, type (gig, part-time, internship, other), location, remote, hours per week (1 to 40), pay, Italian level, start date, expiry date, status (draft, pending, published, closed, changes requested, rejected), and the reviewer's note, who reviewed it and when | Everyone sees published, unexpired jobs of approved companies; owners see their own (with the reviewer's note); admins see all. Who reviewed a job is not readable through the API | Owners create and edit their own jobs, but can only set draft, pending or closed, and submit (pending) only once their company is approved. Only admins publish, request changes or reject |
| `areas` | Milan areas for location search and the map: name and an approximate centre (see the list below). "Elsewhere in Milan" has no centre | Everyone, including logged-out visitors | Only the team, in the dashboard |
| `metro_stations` | Milan's M1–M5 metro stations: name, lines, coordinates, from OpenStreetMap (see "Metro stations" below) | Everyone | Only the team: a data migration made by `scripts/fetch-metro-stations.mjs`, or the dashboard |
| `saved_jobs` | Jobs a student saved to come back to: who, which job, when | Only the student who saved them | That student only (save a live job, remove). Deleted with their account and with the job |
| `job_contacts` | How to apply for each job: a link and/or an email address | Nobody directly | Owners, through `set_job_contact` |
| `job_clicks` | Apply clicks: one row each time a student presses "Apply" on a job. GigoMe can't see whether they then applied, so these are never "applications" | Admins only | Written automatically by `reveal_job_contact` |
| `feedback` | Messages users send about the site, with the page they were on | Admins only | Any logged-in user can send feedback |
| `job_reports` | Reports about a job: reason (scam or payment demanded, illegal or unsafe, misleading pay or hours, discriminatory, other), details, who reported it, status (open or resolved), and how and by whom it was resolved | Admins only | Logged-in users report jobs they can see, one open report per job each. Only admins resolve them, with `admin_resolve_report` |
| `moderation_log` | Every admin decision: company approved or rejected, job reviewed or unpublished, report resolved, with who, when and the note | Admins only | Nobody directly: the admin functions write it |

A few details worth knowing:

- **Jobs expire** 60 days after they are created unless the owner sets
  another date. Expired jobs disappear from the public list automatically.
- **Editing a published job** sends it back for review: an owner can't change
  a published job and keep it published, so admins see every change.
- **Review:** admins publish, request changes or reject a job with
  `admin_review_job`. Requesting changes or rejecting needs a note, which the
  owner sees on their dashboard. A job with changes requested can be edited
  and resubmitted; a rejected job can't be changed by its owner any more.
- **Pending companies** can prepare drafts, but their jobs can be submitted
  for review only once the company is approved.
- **Approved companies keep their name and website:** once a company is
  approved, its owner can no longer change them (the description and contact
  email stay editable). To rename a company, change it in the Table Editor.
- **Owners can delete only drafts.** Anything that went further gets closed
  instead, so the click history is kept.
- **One company per account.**
- **Job locations:** a job has an area and, optionally, an exact point
  (latitude and longitude) for the map. If the employer ticks "Only show the
  area" (`show_exact_location` false), the database stores the area's centre
  instead of the point they sent, so a private address is never saved. Points
  must lie inside the Milan metro area.

- **Nearest station:** when a job is saved with an exact location, the
  database stores its nearest metro station and the distance in metres. The
  site shows a badge like "M1 Porta Venezia · 4 min walk" when it is within
  about 1 km. Jobs that show only their area get no station.
- **Category** (hospitality, retail, tutoring & education, office & admin,
  marketing & social media, events, tech, other) is chosen by the employer.
- **Publication date:** set by the database the first time a job is
  published (editing and republishing keeps it). Jobs published in the last
  3 days get a "New" badge.

## Metro stations

The station list comes from OpenStreetMap:

> Data © OpenStreetMap contributors, available under the Open Database
> License (ODbL): https://www.openstreetmap.org/copyright

To load or refresh it (no terminal needed):

1. On GitHub: **Actions** tab > **Metro stations** (left column) > **Run
   workflow** > branch `main` > **Run workflow**. It runs
   `scripts/fetch-metro-stations.mjs` on GitHub's servers, which asks
   OpenStreetMap's Overpass API for the M1–M5 routes.
2. It fails, and changes nothing, unless it finds between 100 and 130
   stations with some on every line. Open the finished run: its summary shows
   the count per line and every station. Look for one station listed twice
   under two spellings.
3. If it passed, it pushed `supabase/migrations/<now>_metro_stations_data.sql`
   to a new branch, `data/metro-stations`. Open a pull request from it
   (the summary has the link). Merging it adds or updates the stations (by
   name) and recomputes every job's nearest station: it changes the live
   database, so the usual rules apply. Then delete the branch; the workflow
   stops if `data/metro-stations` already exists.

The script also runs on any computer with Node 20 or newer:
`node scripts/fetch-metro-stations.mjs` writes the same file.

Until it has run once, the table is empty and no job shows a metro badge.
Adding or moving a station in the dashboard doesn't update existing jobs:
rerun the script instead.

## Areas

Set up by the migration with these approximate centres. Change names or
centres in Table Editor > `areas` (keep "Elsewhere in Milan" without a
centre). Jobs keep their area when it is renamed. A job that shows only its
area keeps the centre it had when it was saved.

| id | Area | Centre (lat, lng) |
| --- | --- | --- |
| 1 | Duomo / Centro | 45.4642, 9.1900 |
| 2 | Brera | 45.4720, 9.1868 |
| 3 | Porta Venezia | 45.4745, 9.2050 |
| 4 | Centrale / Loreto | 45.4850, 9.2050 |
| 5 | Porta Nuova / Garibaldi | 45.4818, 9.1870 |
| 6 | Isola | 45.4885, 9.1895 |
| 7 | Sempione / Arco della Pace | 45.4760, 9.1730 |
| 8 | CityLife | 45.4775, 9.1560 |
| 9 | Navigli | 45.4510, 9.1760 |
| 10 | Porta Genova / Tortona | 45.4520, 9.1680 |
| 11 | Porta Romana / Bocconi | 45.4505, 9.1960 |
| 12 | Città Studi | 45.4780, 9.2270 |
| 13 | Lambrate | 45.4840, 9.2380 |
| 14 | NoLo | 45.4960, 9.2160 |
| 15 | Bicocca | 45.5150, 9.2110 |
| 16 | Elsewhere in Milan | (none) |

## When someone deletes their account

Users delete their own account on `/account`, which calls
`delete_my_account()`. This happens to their data:

- **Deleted:** their login, their profile, the feedback they sent and the
  jobs they saved.
- **Company accounts:** their company, its jobs, how to apply for those jobs,
  and the clicks on those jobs are deleted too.
- **Kept, but anonymous:** the apply clicks they made stay in
  `job_clicks` with `user_id` empty, so each job's click count stays right
  without pointing to a person. Reports they filed stay in `job_reports`
  with `reporter_id` empty, so a report about a bad job isn't lost.

Deleting a user in the dashboard (Authentication → Users) does the same,
except that their feedback is kept with `user_id` empty. Delete it by hand
in `feedback` if the person asked for everything to go.

## Functions the website calls

| Function | Who can call it | What it does |
| --- | --- | --- |
| `reveal_job_contact(job_id)` | Logged-in students | Returns how to apply for a published job and records an apply click. Anyone else gets an error. The job page calls it only when a student presses "Apply". |
| `set_job_contact(job_id, apply_url, apply_email)` | The job's owner | Sets how students apply. Two empty values remove it. |
| `get_own_job_contact(job_id)` | The job's owner | Shows the owner what they set. |
| `admin_set_company_status(company_id, status)` | Admins | Approves or rejects a company, and logs it. |
| `admin_review_job(job_id, status, note)` | Admins | Sets a job's status and records the review (note, who, when) in the job and in `moderation_log`. A note is required to request changes or reject; publishing clears an old note. Unpublishing a job is this with `closed`. |
| `admin_resolve_report(report_id, note)` | Admins | Resolves an open report with a note, and logs it. |
| `admin_job_contact(job_id)` | Admins | How to apply for any job, to check it during review. |
| `admin_company_contact(company_id)` | Admins | A company's contact email and the email its owner logs in with. |
| `admin_set_job_status(job_id, status)` | Admins | The same without a note (so it can't request changes or reject). |
| `my_job_stats()` | Company owners | Apply clicks on each of the caller's own jobs (how often students pressed "Apply"). Never other companies' numbers. |
| `my_saved_jobs()` | Logged-in users | The caller's saved jobs with title, company and whether each is still live (so a closed job can show "No longer available"). Never anyone else's. |
| `get_company_contact_email(company_id)` | The company's owner, admins | The company's contact email. Everyone else gets nothing. |
| `delete_my_account()` | Logged-in users | Deletes the caller's own account (it takes no arguments, so it can't touch anyone else). The account page calls it after the user types DELETE. |
| `is_admin()`, `current_account_type()` | Logged-in users | Small helpers used by the access rules. |

## Why it's safe

- Every table has row level security on, which means each row is checked
  against a rule before anyone sees or changes it.
- On top of that, the website's two roles (`anon` for logged-out visitors,
  `authenticated` for logged-in users) are given only the exact table and
  column permissions they need. `admins` and `job_contacts` get none at all.
- The functions that need extra power check who is calling them first, and
  can't be tricked into using someone else's tables (`search_path` is fixed).

## Checking it

After a migration is merged, open the Supabase **SQL Editor**, paste in all of
`supabase/checks/security_check.sql` and press Run. It creates test users,
companies and jobs, tries everything a logged-out visitor, a company user and
a student should and shouldn't be able to do, and then removes all of it. You
get one row per check; every row should say `passed = true`. If any says
`false`, don't build on top of it until it's fixed.

## Common tasks

- **Add a university:** Table Editor → `universities` → insert a row with the
  name and its student email domains, for example `{unimi.it}`. Anyone who
  already signed up with that domain becomes a student right away, unless they
  own a company. To check: Table Editor → `profiles`, filter by the new
  `university_id`.
- **Move someone back to a company account:** the database never does this on
  its own. Change their `profiles` row (`account_type` and `university_id`)
  in the Table Editor.
- **Make someone an admin:** find their user ID under Authentication → Users,
  then insert it into the `admins` table.
- **Approve a company, review a job, handle a report:** log in on the site
  with an admin account and open `/admin` (it isn't linked anywhere). Every
  decision there is recorded in `moderation_log`. Changing a status in the
  Table Editor works too, but isn't logged.
- **Change the structure:** write a new migration file and open a pull
  request. Update the security check if you add a table, rule or function.
- **See the numbers:** paste `supabase/queries/kpis.sql` into the SQL Editor
  (read-only).
- **Bot check on login:** Authentication > Attack Protection ("Bot and Abuse
  Protection" in some dashboard versions) > CAPTCHA, with
  Cloudflare Turnstile's secret key. See `HANDOVER.md` before changing it:
  turning it on before the site sends Turnstile tokens breaks every login.
