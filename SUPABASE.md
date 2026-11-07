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
| `companies` | Employers: name, website, description, contact email, and a status (pending, approved or rejected) | Everyone sees approved companies; owners see their own; admins see all | Company accounts create one company and edit its details. Only admins change the status |
| `jobs` | Job listings: title, description, type (gig, part-time, internship, other), location, remote, hours per week (1 to 40), pay, Italian level, start date, expiry date and status (draft, pending, published, closed) | Everyone sees published, unexpired jobs of approved companies; owners see their own; admins see all | Owners create and edit their own jobs, but can only set draft, pending or closed. Only admins publish |
| `job_contacts` | How to apply for each job: a link and/or an email address | Nobody directly | Owners, through `set_job_contact` |
| `job_clicks` | One row each time a student reveals how to apply for a job | Admins only | Written automatically by `reveal_job_contact` |
| `feedback` | Messages users send about the site, with the page they were on | Admins only | Any logged-in user can send feedback |

A few details worth knowing:

- **Jobs expire** 60 days after they are created unless the owner sets
  another date. Expired jobs disappear from the public list automatically.
- **Editing a published job** sends it back for review: an owner can't change
  a published job and keep it published, so admins see every change.
- **Owners can delete only drafts.** Anything that went further gets closed
  instead, so the click history is kept.
- **One company per account.**

## Functions the website calls

| Function | Who can call it | What it does |
| --- | --- | --- |
| `reveal_job_contact(job_id)` | Logged-in students | Returns how to apply for a published job and records a click. Anyone else gets an error. |
| `set_job_contact(job_id, apply_url, apply_email)` | The job's owner | Sets how students apply. Two empty values remove it. |
| `get_own_job_contact(job_id)` | The job's owner | Shows the owner what they set. |
| `admin_set_company_status(company_id, status)` | Admins | Approves or rejects a company. |
| `admin_set_job_status(job_id, status)` | Admins | Sets any job status, including published. |
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
- **Approve a company or publish a job:** change its `status` in the Table
  Editor, or use the admin functions above from an admin page.
- **Change the structure:** write a new migration file and open a pull
  request. Update the security check if you add a table, rule or function.
