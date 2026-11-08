# Handover for the next CTO

Everything you need to keep GigoMe running. Read `README.md` (what GigoMe is),
`SUPABASE.md` (the database in plain English) and `CLAUDE.md` (the rules for
code changes) next. Anything marked **[fill in]** is something only the
current team knows: fill it in before you hand over again.

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
| Supabase | Database, logins, the GitHub integration that applies migrations | Project `ukqqfryhmcgaralzybfs`, Frankfurt. Free plan. |
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
  Run workflow, then a pull request from `data/metro-stations` (SUPABASE.md,
  "Metro stations", has the steps). Merging it changes the live database.
- **Rename an approved company:** only in the Table Editor (owners can't, by
  design). It isn't recorded in the moderation log, so add a note somewhere.

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
  Worker > Logs or the cron events show "Supabase ping OK".

## 7b. Outside services a visitor's browser talks to

The privacy notice has to name these. Each one sees the visitor's IP address
and browser details when it is used.

| Service | When | What it gets |
| --- | --- | --- |
| Supabase (Frankfurt) | Every page with jobs, every login | Everything the site stores (see SUPABASE.md) |
| Cloudflare (hosting, Turnstile) | Every page; Turnstile on the login form | Page requests; Turnstile checks the browser to tell people from bots |
| OpenFreeMap (tiles.openfreemap.org) | Only when a map is shown (`/jobs` map view, company pages, the job form) | Which map tiles are viewed, so roughly which part of Milan |
| OpenStreetMap Nominatim | Only when an employer presses "Find address" | The address typed in the job's Location field |

The font (Schibsted Grotesk) is served from gigome.org itself, so loading a
page no longer contacts Google. Keep it that way: anything new loaded from
another server belongs in this table and in the privacy notice.

Map data © OpenStreetMap contributors (ODbL), shown on every map. The metro
stations (badges and walking distances) come from the City of Milan's open
data: "Metro stations: Comune di Milano, CC BY 4.0", also shown on every map
(see SUPABASE.md, "Metro stations"). They're fetched by a GitHub Actions
workflow and stored in our database, not by visitors' browsers. CC BY needs
that credit to stay visible: keep it if the map changes.

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

## 9. Before you leave

- Every **[fill in]** above is filled in.
- Bitwarden access is handed over, and you are removed from GitHub,
  Cloudflare, Supabase and Brevo (or demoted) once the next person has
  logged in to each.
- The Brevo key's age is noted, and the reminder is in the next person's
  calendar.
