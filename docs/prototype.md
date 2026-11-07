# Front-end demo

Detailed notes on the clickable demo (the home page at `/`): what
each screen does, the design rules it follows and how to edit it. For general
information about GigoMe, see the [README](../README.md).

The site is a Vite + React app, but the demo itself is still the original
plain HTML and JavaScript, unchanged: React mounts it as the home page. Its
markup is [`src/legacy/markup.html`](../src/legacy/markup.html), its script
[`src/legacy/app.js`](../src/legacy/app.js) and its styles
[`src/styles/site.css`](../src/styles/site.css). There is no backend, and the
only external file is one Google Font (Schibsted Grotesk).

**How to open it**

- Online: https://gigome.org (Cloudflare Workers, built from `main`)
- Locally: run `npm install`, then `npm run dev`.

All companies, roles, profiles, reviews and map locations are **sample
data**. Everything you do (sign up, apply, review, post a role, approve in
admin) is saved in your browser's `localStorage` under the key
`gigome.demo.v2`, so it survives a reload. Nothing is ever sent to a server.
**Reset** in the dark bar at the top deletes it and restores the sample data.

## Design approach

The design follows a written redesign brief and the
[Impeccable](https://github.com/pbakaus/impeccable) anti-pattern checks
(`npx impeccable detect` reported 0 findings on the original single
`index.html`). In short:

- **Each screen is judged by its job.** Home persuades (understand the offer
  and search in five seconds). Jobs, role detail, sign-up, the employer
  dashboard and admin are tools (familiar controls, dense lists, no
  decoration). About is for reading (comfortable line length).
- **No template furniture.** No eyebrow labels, uppercase kickers, icon-tile
  grids, cards inside cards, gradients, glass effects or decorative
  animation. Content is grouped with spacing and hairline dividers. A box is
  used only for a clickable unit or a separate object.
- **One typeface**, Schibsted Grotesk, on a fixed size scale. Tool screens
  never go above 32px.
- **Honest data.** The map shows how many roles each company has open, not
  "people applying". Application counts appear only on the employer's own
  dashboard. Recommendations give a plain reason ("Fits your weekend
  availability") instead of a fake match percentage.
- **Signature detail: the metro line.** Every on-site role shows its area
  with the nearest Milan metro line as a small badge (M1, M2, M3, M5). A
  badge is left out wherever the nearest station is uncertain.
- **Copy rules:** no em dashes, "role" on public pages and "listing" on
  employer and admin pages, buttons that name their action.

## Colour palette

Cool greys with two accents. About 90% of every screen is grey and white, so
the accents stand out.

| Colour | Hex | Used for |
| --- | --- | --- |
| Orchid | `#A67CBA` | Actions (primary buttons), selection, focus rings and the verified mark. Text on orchid is always graphite: white on orchid is too low in contrast. |
| Gold | `#FFD700` | Pending and new only: the "New" tag, "In review", "Applied", unread alert counts and the admin queue count. Never as text on white. |
| Graphite | `#1D1B2E` | Text, the demo bar, toasts, metro badges, map pins |
| Slate | `#5F6478` | Secondary text, captions, form field borders |
| Mist | `#DCDDE8` | Borders and hairline dividers |
| Cloud | `#F6F6FA` | Second surface: sidebars, table headers, tags, footer |
| White | `#FFFFFF` | Main background |
| Error | `#B42318` | Form errors only |

Links are graphite text with an orchid underline, because orchid text on white
is too faint to read. No other colours are used anywhere, including the map.
Status tags use real states: Live and Accepted (orchid outline), In review
and Applied (gold), Draft, Rejected and Not verified (cloud, slate text). The colours are CSS variables at the top of `src/styles/site.css`.

## Navigation

The site header is no longer part of the demo: it's the React
`SiteHeader` (GigoMe, Jobs, About, and "Log in" or the real logged-in
student's name and "Log out"). It doesn't show the demo's sample accounts.
Under 768px the links collapse into a Menu button. The demo's student and
employer dashboards are reached through **Jump to**.

The dark demo bar has a **Jump to** menu for every screen and a **Reset**
button. Jumping to the student or employer dashboard signs in to the sample
account (Alex Kim, or Nebbia Coffee Bar) so every screen can be seen.

Actions that need a student account in the demo (apply, save, follow, save
search, review) open the demo's sign-in dialog: choose student or employer,
then any email and password (or "Demo account") signs in to the sample
account, and the action carries on.

The footer links to About, Privacy notice, Terms, Give feedback (a dialog that
reaches the admin "Latest feedback" list) and Contact (the About page contact
section).

| Link | Screen |
| --- | --- |
| `#home` | Home |
| `#jobs` | Roles in Milan |
| `#jobs/parttime`, `#jobs/day`, `#jobs/tutoring`, `#jobs/project`, `#jobs/internship` | Roles with that type pre-selected |
| `#jobs/high`, `#jobs/remote` | Roles paying €18/h or more, or remote roles |
| `#job/<id>` | Role detail, for example `#job/w1` (Weekend barista) |
| `#employer/<name>` | Public employer page, for example `#employer/nebbia-coffee-bar` |
| `#signup` | Student sign-up (or "Edit your profile" when signed in) |
| `#me` | Student dashboard (`#me/saved`, `#me/searches` jump to a section) |
| `#company` | Employer sign-up, or the employer dashboard when signed in |
| `#admin` | Admin (`#admin/queue`, `/students`, `/companies`, `/reports`, `/feedback`) |
| `#about`, `#about/contact` | About and team, contact section |
| `#privacy`, `#terms` | Draft privacy notice and terms |

## 1. Home (`#home`)

- **Hero**: a working one-row search (keyword, area, "No Italian needed") that
  opens the role list with the search applied.
- **Map of Milan** with a pin per company showing its number of open roles.
  Hover or focus a pin for each role's pay, schedule and posted date; click it
  to filter the role list by that employer (an "Employer: …" chip). Drag to pan, + / − / reset, double
  click to zoom, or click the map then scroll. Remote roles and employers who
  hide their area stay off the map. Below it: "Open Milan in Google Maps".
- **The five newest roles** and "See all roles".
- **How it works** (students and employers) and **About the project**.

## 2. Roles in Milan (`#jobs`)

- **Toolbar**: search by role or company, result count, sort (Best match,
  Highest pay, Newest) and **Save search**.
- **Filters**: Type with counts, minimum pay slider (day, project and monthly
  pay converted to an hourly estimate), When, Work mode and Language. Under
  900px they move into a **Filters (n)** drawer that keeps focus inside and
  closes on Escape.
- **Removable chips** for each active filter, and Clear all.
- **Rows**: title, employer with verified mark and star rating, "New" and
  "Basic Italian" tags, type · area with metro badge · schedule (and "Private
  employer" where it applies), pay and posted date. With Best match the top
  three rows give a one-line reason. Reasons say "your" (for example "Fits
  your weekend availability") only when a signed-in student's availability
  really matches; signed out, they describe the role instead.
- **Empty state**: names the filter that excludes the most roles, offers to
  remove it, and offers to save the search for alerts.
- **Save search** stores the current filters with an "Email me when a new
  role matches" switch. When the admin approves a matching role, the student
  gets an alert in their dashboard. Signed-in students see a "Your saved
  searches (n)" link next to the button.

## 3. Role detail (`#job/<id>`)

Every role has its own page. The barista role has hand-written text; the
others are built from the role's data (or the description the employer typed).

- Title, employer (links to its public page) with verified mark and rating,
  tags (New, type, language, work mode).
- Key facts: pay, schedule, location with metro badge (or "area on request"),
  start or length.
- About the role, What you'll do, Good to know.
- **Apply on company site** (explains the hand-off and adds the role to your
  applications) and **Email employer** (a prefilled email dialog). Once you've
  applied, the panel shows the date and status instead.
- **Save**, the employer block (sector, area, verification, rating, View
  employer, **Follow**) and **Report this role** (reason and details, which
  appear in admin "Reported listings").

## 4. Employer page (`#employer/<name>`)

Public page for each employer: verification, business or private employer,
sector, area (unless hidden), description, open roles, and **reviews from
students** with the average rating. **Follow** gives an alert when they post a
new role. Contact details (person, email, phone, website) show to signed-in
students only. "Write a review" appears only for a student who was accepted
for one of the employer's roles.

## 5. Student sign-up (`#signup`)

A three-step progress bar (verify email, build profile, check and finish) that
follows what you've filled in.

- **Student email with a 6-digit code**: enter a university address (personal
  addresses such as Gmail are refused), press Send code, type the code. In the
  demo the code is shown on screen. Wrong codes are rejected; you can resend
  or change the email. Employers never see this address.
- **About you**: full name, username, contact email (shown to employers you
  apply to), age and nationality (each with its own "Show to employers" box,
  off by default), programme, year, languages (add with a level, remove with
  ×, no duplicates), availability and a short intro. There is no CV upload.
- **Your background**: open text boxes for education, past experience,
  ambitions, personality, soft skills and hard skills. All optional, all shown
  on the profile employers see.
- **Privacy**: required consent, optional email alerts.
- **What employers see**: a live preview that updates as you type.
- **Save draft** keeps your progress. **Finish** checks the required fields,
  creates the account and signs you in. Signed-in students get the same form
  as "Edit your profile".

## 6. Student dashboard (`#me`)

- **Alerts**: one alert per new role that matches a saved search, comes from
  a followed employer, or fits your availability (the "Email me when new roles
  match my availability" choice from sign-up, which can be switched here),
  plus accepted or rejected applications and invites from past employers.
  Unread count on the dashboard.
- **My applications**: every role you applied to, with date and how (company
  site or email), filterable by Applied, Accepted and Rejected. You can update
  the status yourself (for applications on company sites); employers who use
  GigoMe update it for you. Accepted applications get **Review employer**:
  a 1 to 5 rating, a short text and an **anonymous** option that hides your
  name from the employer and other students.
- **Saved roles**, **Saved searches and email alerts** (switch alerts on or
  off, show roles, delete) and **Employers you follow**.
- **Your data**: download everything as JSON, or delete the account.

## 7. Employer sign-up and dashboard (`#company`)

**Signed out**: "Hire international students in Milan" and the account form.

- **Who is hiring?** A business or organisation, or a private person (a
  family looking for a tutor, someone who needs a dog walker). Private
  accounts don't get sector or website fields.
- Name, sector, area, **Show my area to students and on the map** (when off,
  roles say "Area on request" and stay off the map).
- **Contact information**: contact person, email, phone, website.
- Description, then **Verification**: ask the GigoMe team to verify you
  (goes to the admin queue) or not now (roles show as not verified).

**Signed in** (sample: Nebbia Coffee Bar):

- Header with verification mark, sector, area, website, description and
  rating, plus Post a role, Edit profile (the same form), View public page and
  Sign out. Unverified accounts can request verification from here.
- **Your listings**: type, status (Live, In review, Draft, Not approved),
  **number of applications** with how many are new, and updated date. **View
  applicants** opens the list: name, programme, date, how they applied, status,
  View profile, and **Accept** / **Reject**. The student is told either way,
  and accepted students are added to past employees. Drafts can be edited.
- **Post a role**: title, type, location, pay, schedule, language, description
  and how to apply (link or email, checked). Save as draft, Preview, and
  **Submit for review** (adds it to "Your listings" as In review and to the
  admin queue).
- **Past employees**: students who worked for you. Tick **Alert first** for
  recurring employees: they are told about your next role before everyone
  else when it goes live. **Invite to apply** sends one past employee a
  personal alert about a chosen live role, with a message.
- **Reviews from students**, and "Tell us how it went" feedback.

## 8. Admin (`#admin`)

- Sidebar links jump to each section.
- **Goal progress**: verified students and reviewed companies against the
  goal, and live listings. Approvals update them.
- **Review queue** with working Approve and Reject, and "All caught up" when
  empty. Approving a listing puts it live (role list, map, employer page) and
  sends alerts to recurring employees, matching saved searches and followers.
  Approving a verification request verifies the employer.
- **Reported listings** and **Latest feedback**, which fill from the site.
- **Students** and **Companies** tables (type, open roles, rating, status).

## 9. About, privacy and terms

About: why GigoMe exists, the four principles, a **contact section** for
students and for employers (email, phone and LinkedIn for each), a note about the demo and
the team. Privacy notice and Terms are short drafts, clearly marked as needing
legal review before launch.

## Sample data

| | |
| --- | --- |
| Roles | 24: 5 part-time, 5 day jobs, 5 tutoring, 5 short projects, 4 internships |
| Employers | 19 fictional employers (cafés, startups, studios); 2 are private families, 2 are not verified |
| Work mode | 13 on-site, 7 hybrid, 4 remote |
| Language | 22 with no Italian needed, 2 with basic Italian |
| Pay | €9.50 to €30 per hour (estimated); 6 roles pay €18/h or more |
| Reviews | 7 reviews across 5 employers, some anonymous |
| Review queue | 2 listings, 1 verification request, 1 student |

## What works and what is simulated

**Works (in this browser):** every screen and link, sign in and out, student
sign-up with code verification, profile editing, applying, saving, following,
saved searches with alerts, reporting, reviews (with anonymous option), the
student dashboard, data download and account deletion, employer sign-up as a
business or private person, hidden location, verification requests, posting
and editing roles, accepting and rejecting applicants, recurring past
employees, the admin queue and its effects, feedback.

**Simulated:** no emails are sent (the verification code is shown on screen,
and "email" alerts appear only in the dashboard); "Apply on company site"
doesn't open a real page; any email and password sign in to the sample
accounts; there is one student account and one employer account per browser.

## Editing the demo

All the content lives in [`src/legacy/app.js`](../src/legacy/app.js):

| What | Where in the script |
| --- | --- |
| Roles | `JOBS` (title, company, type, area, `metro`, work mode, schedule, pay, hourly `rate`, match score) |
| Hand-written role text | `DETAIL` (only the barista role; others are generated) |
| Employer sector, description, private or unverified | `COMPANY` |
| Map pin positions per company | `POS` (a company not listed here stays off the map) |
| Sample reviews | `SEED_REVIEWS` |
| Sample student and employer accounts | `DEMO_PROFILE`, `DEMO_EMPLOYER`, `SEED_LISTINGS`, `SEED_APPLICANTS`, `SEED_PAST` |
| Admin review queue | `SEED_QUEUE` |
| Contact details on About | `CONTACT` (**placeholders**: replace before launch) |
| Team members | `TEAM` |
| "High-paying" threshold for `#jobs/high` | `HIGH_PAY` (currently €18/h) |

After changing any seed data, press **Reset** (or clear the site's storage) to
see it, because saved state from an earlier visit takes priority. If you change
the shape of the saved data, bump `KEY` (`gigome.demo.v2`) so old saves are
ignored.

The stylesheet, `src/styles/site.css`, runs from tokens to base, layout,
components and pages. The screens' markup is `src/legacy/markup.html`. The map
is a large inline SVG (around 430 KB) inside `#map-stage` in that file.
