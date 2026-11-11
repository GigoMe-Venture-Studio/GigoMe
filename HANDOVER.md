# Handover for the next CTO

Everything you need to keep GigoMe running. Read `README.md` (what GigoMe is),
`SUPABASE.md` (the database in plain English) and `CLAUDE.md` (the rules for
code changes) next. Anything marked **[fill in]** is something only the
current team knows: fill it in before you hand over again.

## Launch checklist

Everything that must be done before real users arrive. Tick each one; don't
skip any because "it worked in testing".

**Legal (the team's legal person)**
- [x] Privacy Notice (v1.0) and Terms and Conditions (v2.0) published on
      `/privacy` and `/terms`, word for word from `docs/legal/published/`
      (November 2026). Updating them: CLAUDE.md, "`/privacy` and `/terms`".
- [ ] The points where the texts and the app don't match yet
      (`docs/legal/text-vs-app.md`) are settled by the legal person: the
      text changes, or the app does.
- [x] Who operates GigoMe: named in both texts.
- [ ] `privacy@gigome.org` (named in both texts) receives mail and someone
      reads it, like `hello@gigome.org`.
- [ ] Retention periods decided. Either set them in `retention_settings`
      (SUPABASE.md, "Data retention") or write down that GigoMe keeps data
      until accounts are deleted, and say the same in the privacy notice.

**Accounts and settings**
- [ ] Every **[fill in]** in this file is filled in.
- [ ] At least two people have admin rights (`admins` table) and can open
      `/admin`.
- [ ] Cloudflare build variables set for **both** production and preview
      (section 2).
- [ ] Turnstile: site key in Cloudflare's build variables first, a new
      deploy, then the secret key in Supabase's CAPTCHA setting. Log in once
      as a student and once as an employer afterwards.
- [ ] Supabase Auth: Site URL `https://gigome.org`; email templates show the
      6-digit code (no links); rate limits below Brevo's 300 emails a day
      (section 7).
- [ ] Brevo: SMTP key's creation date noted and a renewal reminder set
      (section 6); the gigome.org DNS records Brevo asked for (SPF, DKIM,
      DMARC) verified in Brevo.
- [ ] Domain auto-renew on, renewal date filled in (section 10).
- [ ] `hello@gigome.org` is read by someone, at least weekly.
- [ ] `universities` holds the right domains (Bocconi's student domain(s)).

**Data**
- [ ] Test users, companies and jobs made while building are deleted from
      the live database (Authentication > Users; Table Editor).
- [ ] A first manual backup is made and stored safely (section 9).
- [ ] The last migration's security check ran on the live database with
      every row `passed = true` (section 3).

**On the live site, on a phone and a laptop**
- [ ] Open every page with the browser's console open (desktop: F12 >
      Console). No red "Content Security Policy" messages. If there are, the
      page loads something new that isn't in `public/_headers` yet.
- [ ] Student: log in with a real university email, search, open the map,
      "Use my location", save a job, press "Apply", report a job, send
      feedback, "Download my data", delete the account.
- [ ] Employer: sign up, create the company, an admin approves it, write a
      job, preview, submit, an admin publishes it, "Extend by 60 days",
      close it.
- [ ] Cookies: the browser's site settings for gigome.org show no cookies
      set by GigoMe (Cloudflare can add its own if bot protection features
      are on for the domain: list them in the privacy notice if so).
- [ ] The "Tests" check on GitHub is green on `main`.

## 1. Accounts

Every login lives in the team's **Bitwarden** vault, one item per account,
named as in the first column. Nobody keeps a password only in their head or
browser. Turn on two-factor login everywhere it's offered, and store the
recovery codes in the same Bitwarden item.

| Bitwarden item | What it's for | Notes |
| --- | --- | --- |
| Bitwarden (organisation) | The vault itself | Who can open it, and the emergency-access contact: **[fill in]** |
| GitHub: GigoMe-Venture-Studio | The code (`GigoMe-Venture-Studio/GigoMe`), pull requests | Organisation owners: **[fill in]**. Keep at least two. |
| Cloudflare | Hosting (Worker `gigome`, built from `main`), the daily Supabase ping, Turnstile (bot check on login) | Whether DNS for gigome.org is also here: **[fill in]** |
| Supabase | Database, logins, the GitHub integration that applies migrations | One project, in Frankfurt (its name and ID are on the dashboard's project list). Free plan. |
| Brevo | Sends the login-code emails (SMTP), from `no-reply@gigome.org` | The SMTP key is pasted only in Supabase (see section 6). Free plan. |
| Domain registrar for gigome.org | The domain | Registrar and renewal date: **[fill in]**. Turn on auto-renew. |
| Mailbox hello@gigome.org | The public contact address on the site | Where it's hosted and who reads it: **[fill in]** |

Never put a password, the Supabase secret / service_role key, the Brevo SMTP
key or the Turnstile secret key in the repo or in a chat. The only values the
website itself uses are public: the Supabase URL and publishable key, and the
Turnstile site key.

## 2. How a change goes live

1. Make a branch, change the code, open a pull request against `main`.
2. Cloudflare builds the branch (check "Workers Builds: gigome" on the pull
   request) and gives it a preview URL. "Supabase Preview" shows as skipped:
   that's normal.
3. Merge into `main` (a normal merge commit). Cloudflare builds `main` and
   deploys it to https://gigome.org within a few minutes.
4. If the pull request adds a file in `supabase/migrations/`, Supabase's
   GitHub integration runs it on the **live database** when it is merged.
   Never merge such a pull request without the owner's go-ahead, and never
   edit a migration that is already on `main`: add a new one.

Every pull request runs the tests on GitHub ("Tests": unit, database and
browser checks, with stand-ins for Supabase and the other services, so no
keys are needed). A red check means something broke: open it, find the
failed step and the line starting with `FAIL`. Don't merge a red pull
request. Dependabot opens dependency-update pull requests every Monday: one
for all minor and patch updates of npm packages, one for those of GitHub
Actions, and a separate one for each major update. Merge the grouped ones
when the tests are green; read a major update's release notes first (they
can break things), and after merging an Actions major, start the hand-run
"Metro stations" workflow once to check it still works. Cloudflare doesn't
always post a preview check on Dependabot's pull requests; the build of
`main` is what deploys, and a failed one leaves the live site as it was. To run the
tests on your own computer: `node --test tests/unit/*.test.mjs`,
`tests/e2e/run.sh` (needs Playwright's Chromium) and `tests/db/run-check.sh`
(needs a throwaway PostgreSQL 16; never point it at the real project).

The security headers (Content-Security-Policy and others) are in
`public/_headers`. They list exactly which other sites a page may load from
or talk to. Adding a new service (a font, a widget, analytics) means adding
it there, to section 7b and to the privacy notice; otherwise the browser
blocks it.

Build settings live in Cloudflare: Workers & Pages > `gigome` > Settings >
Build. The build needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
and (once Turnstile is on) `VITE_TURNSTILE_SITE_KEY` as **build** variables.
Production and preview builds each have their own variables (one set per
trigger): set them on both, or previews show "Jobs can't be shown right now"
and a configuration error on the login pages.

## 3. The check-script habit

After every merge that touches `supabase/migrations/`:

1. Wait until Supabase has applied it (Supabase dashboard > Database >
   Migrations shows the new file).
2. Open the SQL Editor, paste **all** of `supabase/checks/security_check.sql`
   and press Run.
3. Every row must say `passed = true`, and the number of rows must match the
   count the pull request said. If anything is false, stop: don't build on
   top of it until it's fixed.

The script creates test users, companies and jobs, tries everything a
logged-out visitor, a student, a company and an admin should and shouldn't be
able to do, and then undoes all of it. It leaves nothing behind.

For numbers, paste `supabase/queries/kpis.sql` into the SQL Editor:
students, students per university, approved companies, companies with a live
job, live jobs, apply clicks per week and distinct students who clicked per
week. It only reads.

## 4. Everyday tasks

- **Add a university:** Supabase > Table Editor > `universities` > insert a
  row with its name and student email domains, e.g. `{unimi.it}`. Anyone who
  already signed up with that domain becomes a student at once, unless they
  own a company. Check: Table Editor > `profiles`, filter by the new
  `university_id`.
- **Make someone an admin:** find their user ID under Authentication > Users,
  insert it into the `admins` table.
- **Load or refresh the metro stations:** GitHub > Actions > Metro stations >
  Run workflow. If the summary says "No changes, nothing pushed", you're
  done; otherwise open a pull request from `data/metro-stations` (SUPABASE.md,
  "Metro stations", has the steps). Merging it changes the live database.
- **Rename an approved company:** only in the Table Editor (owners can't, by
  design). It isn't recorded in the moderation log, so add a note somewhere.
- **Ban an abusive user:** first act on what they posted (reject their
  company on `/admin` if they're an employer; resolve their reports). Then, in
  the SQL Editor (replace the email):

  ```sql
  update auth.users set banned_until = 'infinity' where email = 'person@example.com';
  delete from auth.sessions where user_id = (select id from auth.users where email = 'person@example.com');
  ```

  They can't log in again with that email, and their open sessions stop
  within an hour at most. Their account and data stay (deleting them instead
  would let them sign up again with the same email). To lift the ban, set
  `banned_until` to `null`. They can still sign up with another email:
  watch for the same names, websites or apply addresses. Write down who you
  banned and why (the moderation log doesn't record it).
- **Change a company's owner** (the person leaves the company): the new
  person logs in once at `/employers` with their work email, which creates
  their account. They must not own a company already (one per account).
  Find their user ID under Authentication > Users, the company's ID in Table
  Editor > `companies`, then in the SQL Editor:

  ```sql
  update public.companies set owner_id = '<new user id>' where id = '<company id>';
  ```

  The new owner sees the company and its jobs on their dashboard; ask them
  to update the contact email. The old owner's account is then a company
  account without a company: delete it if they ask. Note the change
  somewhere (it isn't in the moderation log).
- **Someone asks for their data or its deletion:** they can do both
  themselves on `/account` ("Download my data", "Delete my account"). If
  they can't log in, check it's really them (a reply from that email
  address), then do it for them: delete under Authentication > Users (and
  their `feedback` rows, see SUPABASE.md, "When someone deletes their
  account").

## 5. Moderation (`/admin`)

Log in on the site with an admin account and open https://gigome.org/admin
(it isn't linked anywhere). Everyone else gets the 404 page. Every decision
made there is recorded with who and when ("Recent decisions" at the bottom,
the `moderation_log` table).

- **Companies waiting:** compare the login email, contact email, website and
  description. A Gmail login with no website for a "company" is a reason to
  look harder. Approve or reject.
- **Jobs waiting:** tick the five checklist items honestly; Publish stays off
  until all five are ticked. Request changes or reject with a note: the
  employer sees it on their dashboard.
- **Live jobs missing an area, a schedule or structured pay:** published
  before those became required. They stay live, but don't show up in the
  map, "When" or "Minimum pay" searches. Ask the employer to edit the job
  (it goes back to review). Pending jobs missing any of them are flagged and
  can't be published.
- **Open reports:** read the report and the job.
  - **Scam, or payment demanded from students** (registration fee, deposit,
    training paid by the student, documents up front): press **Reject the
    company**, not just "Unpublish the job". Rejecting the company hides all
    its jobs at once and stops it from submitting new ones. Then resolve the
    report with a note. A scammer can sign up again with another email: watch
    for the same names, websites or apply addresses.
  - **Something wrong with one job only:** "Unpublish the job" with a note
    the employer will see; they can fix it and resubmit (it goes through
    review again).
  - **Nothing wrong:** resolve the report with a note saying why.

## 6. Email (Brevo) and the key that expires

- Login codes are sent by Supabase Auth through Brevo's SMTP. The SMTP
  settings (host, login, key) are only in Supabase > Authentication > Emails >
  SMTP Settings. The sender is `no-reply@gigome.org`.
- **The Brevo SMTP key expires** after 90 days without use, and after 1 year
  at the most. When it expires, nobody can log in. Put a calendar reminder 11
  months after the key was created. To replace it: Brevo > SMTP & API > create
  a new SMTP key > paste it into Supabase's SMTP settings > log in on the site
  to check a code arrives > delete the old key in Brevo > update Bitwarden.
  Current key created on: **[fill in]**.
- Brevo's free plan sends at most 300 emails a day for the whole account.
  Each login sends one email. Don't build anything that emails users in bulk.

## 7. Limits

Numbers change: check each provider's pricing page once a term, and update
this section.

- **Supabase Auth rate limits** (Authentication > Rate Limits): how many
  emails are sent per hour, how many code checks per IP. Current values:
  **[fill in]**. They must stay below Brevo's 300 a day.
- **Turnstile** (bot check on the login form): free. If it's ever turned off
  in Supabase, the form still works without it.
- **Daily limits against abuse** (the database): per user 20 feedback
  messages, 10 reports and 50 saves, searches and follows together a day;
  per company 10 jobs sent for review a day. See SUPABASE.md.
- **Supabase free plan:** a free project pauses after about a week without
  activity; the daily ping (below) prevents that. Also limited database size,
  monthly active users and egress: check the dashboard's Usage page.
- **Cloudflare Workers free plan:** static assets (every page and file of the
  site) are free and unlimited. Only requests that run the Worker script
  count against the daily request limit, and almost none do: the script only
  runs for the daily ping and for rare requests for files that don't exist.
- **The daily ping:** every day at 04:17 UTC the Worker reads one row from
  Supabase. It needs `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as runtime
  variables (Worker > Settings > Variables and Secrets). Check that it runs:
  Workers & Pages > `gigome` > Observability (or Logs): search for "Supabase
  ping" and look for "Supabase ping OK" once a day around 04:17 UTC. Workers
  Logs is switched on in `wrangler.jsonc` ("observability"). On the free plan
  logs are kept for **3 days** (200,000 log events a day; the Worker writes a
  handful), so check within 3 days of a run. A failed ping shows as an error
  there ("Supabase ping failed" or "skipped").

## 7b. Outside services a visitor's browser talks to

The privacy notice has to name these. Each one sees the visitor's IP address
and browser details when it is used.

| Service | When | What it gets |
| --- | --- | --- |
| Supabase (Frankfurt) | Every page with jobs, every login | Everything the site stores (see SUPABASE.md) |
| Cloudflare (hosting, Turnstile) | Every page; Turnstile on the login form | Page requests; Turnstile checks the browser to tell people from bots |
| Cloudflare Web Analytics (static.cloudflareinsights.com, cloudflareinsights.com) | Every page. **Active:** Cloudflare adds its beacon script to every page it serves to a browser (checked on the live site in November 2026). It's switched on in Cloudflare (Analytics & Logs > Web Analytics), not in this repo | Which pages are visited, how fast they load, the referring site, browser and country. No cookies or browser storage. If it's ever switched off, remove its two hosts from `public/_headers` and from the privacy notice |
| OpenFreeMap (tiles.openfreemap.org) | Only when a map is shown (`/jobs` map view, company pages, the job form) | Which map tiles are viewed, so roughly which part of Milan |
| OpenStreetMap Nominatim | Only when an employer presses "Find address" | The address typed in the job's Location field |
| Google Maps | Only when someone clicks "Open in Google Maps" on a job page (a plain link, opened without telling Google which page it came from) | The job's point (or its area's centre), as for any Google Maps visit |
| The browser's own location service | Only when someone presses "Use my location" on `/jobs` and allows it | Up to the browser (Chrome, Safari...): it may ask its maker's location service. GigoMe never receives or stores the position: it stays in the open tab, and the map then loads OpenFreeMap tiles around it, like any area someone looks at |

The font (Schibsted Grotesk) is served from gigome.org itself, so loading a
page no longer contacts Google. Keep it that way: anything new loaded from
another server belongs in this table, in the privacy notice and in
`public/_headers` (the Content-Security-Policy blocks everything that isn't
listed there).

Map data © OpenStreetMap contributors (ODbL), shown on every map. The metro
lines, stations, badges and walking distances come from the City of Milan's
open data: "Metro: Comune di Milano, CC BY 4.0", also shown on every map
(see SUPABASE.md, "Metro stations"). They're fetched by a GitHub Actions
workflow into our database and our own site
(`public/metro/milan-metro.geojson`), not by visitors' browsers. CC BY
needs that credit to stay visible: keep it if the map changes.

## 7c. What GigoMe stores about each student

**In the visitor's browser** (checked by `tests/e2e/launch.test.js` after a
login, a map and the Metro button). GigoMe sets **no cookies**.

| Where | Name | What | When | How long |
| --- | --- | --- | --- | --- |
| localStorage | `sb-<project>-auth-token` | The login session: access and refresh tokens, user ID and email | After logging in | Until "Log out", or the session expires |
| sessionStorage | `gigome.login.pending` (and `.employer`) | The email a code was just sent to, and when, so a reload doesn't lose it | Between "Send me a code" and entering it | Until the code is used or the tab is closed |
| sessionStorage | `gigome.metro` | "off" when someone hides the metro lines on a map | After pressing "Metro" | Until the tab is closed |
| Turnstile's frame (challenges.cloudflare.com) | Cloudflare's own | Whatever Cloudflare's bot check keeps, inside its own frame, not readable by GigoMe | On the login forms, when Turnstile is on | Cloudflare's rules |

Everything else (filters, the map position) is in the page address or the
open page only. "Use my location" is never stored. "Download my data" builds
its file in the browser and stores nothing.

**In the database.** Also for the privacy notice. Everything is in Supabase
(Frankfurt), visible only to that student (and admins where noted), and
nothing is ever emailed. "Kept until" is how it works today: once retention
periods are set (SUPABASE.md, "Data retention"), old feedback, resolved
reports, ended jobs and long-inactive accounts are also deleted after those
periods. Supabase also keeps its own technical logs (logins, API requests
with IP addresses) for a short time on the free plan.

| What | Kept until |
| --- | --- |
| Profile: email, university, name, degree level, graduation year | The account is deleted |
| Saved jobs | Removed, or the account is deleted |
| Saved searches: a name, the filters, when last opened | Deleted, or the account is deleted |
| Companies followed (the company sees only a count) | Unfollowed, the company is deleted, or the account is deleted |
| Apply clicks: which job and when "Apply" was pressed. The student sees their own as "Jobs you opened"; admins see all; employers see counts only | Kept after the account is deleted, without the user (anonymous) |
| Job reports they filed (admins only) | Kept after the account is deleted, without the reporter |
| Feedback they sent (admins only) | The account is deleted |
| Login details kept by Supabase Auth: email, when the account was created, last login | The account is deleted |
| For company accounts: the company (name, website, description, contact email, when the terms were accepted), its jobs, how to apply, apply-click counts, moderation notes | The account is deleted (moderation decisions stay in `moderation_log` without the job or company) |

"Share" on a job page hands the job's link to the phone's own share sheet
(the student picks the app) or copies it; GigoMe sees nothing. "Use my
location" is never stored (section 7b).

## 8. Not built on purpose

These come up again and again. Don't add them without checking with the
team's legal person first.

- **Student profiles visible to employers** and **applying through GigoMe:**
  either would bring GigoMe under Italian job-intermediation rules.
  Applications happen directly with the employer, and GigoMe only counts
  "apply clicks" (presses of "Apply"), never "applications": it can't see
  whether anyone applied.
- **Employer ratings or reviews:** they need moderation the team can't
  provide.
- **Email to all users** (newsletters, alerts): Brevo's free plan allows 300
  emails a day, and those are needed for login codes.

## 9. Backups: there are none

What would be lost, the options with cost and privacy, and the
recommendation for the test phase and for launch: `docs/BACKUPS.md`.

The Supabase free plan makes **no backups**. If a bad migration, a mistaken
delete in the Table Editor or a problem at Supabase destroys data, it's gone:
every account, company and job. Paying for Supabase's Pro plan adds daily
backups; until then, make one by hand:

- **When:** before merging any pull request with a migration, and once a
  month.
- **How (simplest):** in the SQL Editor run `select * from public.<table>`
  for each table (`profiles`, `companies`, `jobs`, `job_contacts`,
  `job_clicks`, `saved_jobs`, `saved_searches`, `company_follows`,
  `feedback`, `job_reports`, `moderation_log`, `admins`, `universities`,
  `areas`, `retention_settings`) and download each result as CSV. Logins
  (`auth.users`) can't be restored from a CSV; people would simply log in
  again with their email, which recreates their account (but not their
  links to companies and saved jobs).
- **How (complete):** with the Supabase CLI on your own computer and the
  database connection string from Project Settings > Database:
  `supabase db dump --db-url "<connection string>" -f schema.sql`, then
  `... --data-only -f data.sql`. This includes `auth.users`.
- **Where:** an encrypted place only the team can open (e.g. a Bitwarden
  attachment or an encrypted drive). Backups hold everyone's personal data:
  never in the repo, never in a shared folder, never on a laptop
  unencrypted. Delete old ones in line with the retention periods.

## 10. The domain

gigome.org must be renewed every year at the registrar (**[fill in]**). If it
lapses, the site stops working, login emails from `no-reply@gigome.org` stop
arriving (Brevo relies on the domain's DNS records), and anyone can buy the
name. Turn on auto-renew, check the payment card on file hasn't expired,
keep the registrar's contact email one the team reads, and put the renewal
date in a calendar a month ahead. Renewal date: **[fill in]**. Where the DNS
is managed: **[fill in]** (Cloudflare or the registrar); keep the records
Brevo asked for (SPF, DKIM, DMARC) when changing anything there.

## 11. Before you leave

- Every **[fill in]** above is filled in.
- Bitwarden access is handed over, and you are removed from GitHub,
  Cloudflare, Supabase and Brevo (or demoted) once the next person has
  logged in to each.
- The Brevo key's age is noted, and the reminder is in the next person's
  calendar.
