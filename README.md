# Venture Studio 1st prototype

First prototype of the **International Student Jobs Platform**, a student-run
project (Milan, autumn 2026).

> Status: clickable front-end prototype ("GigoMe"). All roles, companies and
> numbers in it are simulated; nothing is stored and there is no backend.

## The prototype

[`index.html`](index.html) is a clickable front-end prototype of the platform,
branded **GigoMe**. It is one self-contained file: plain HTML, CSS and
JavaScript, with no frameworks, no build step and no backend. Everything is
inline except one Google Font (Schibsted Grotesk).

**How to open it**

- Online, via GitHub Pages: https://emildavidzzon.github.io/bsmc-jobs-platform-prototype/
- Locally: download `index.html` and open it in any browser.

All companies, roles, profiles and map locations are **simulated**. Nothing is
saved, nothing is sent anywhere, and no personal data is collected. The site
says this once, in the dark prototype bar at the top of every page.

### Design approach

The design follows a written redesign brief and the
[Impeccable](https://github.com/pbakaus/impeccable) anti-pattern checks
(`npx impeccable detect index.html` reports 0 findings). In short:

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
  "people applying", because applications happen off-platform and GigoMe
  cannot know them. Recommendations give a plain reason ("Fits your weekend
  availability") instead of a fake match percentage.
- **Signature detail: the metro line.** Every on-site role shows its area
  with the nearest Milan metro line as a small badge (M1, M2, M3, M5). A
  badge is left out wherever the nearest station is uncertain.
- **Copy rules:** no em dashes, "role" on public pages and "listing" on
  employer and admin pages, buttons that name their action.

### Colour palette

Cool greys with two accents. About 90% of every screen is grey and white, so
the accents stand out.

| Colour | Hex | Used for |
| --- | --- | --- |
| Orchid | `#A67CBA` | Actions (primary buttons), selection, focus rings and the verified mark. Text on orchid is always graphite: white on orchid is too low in contrast. |
| Gold | `#FFD700` | Pending and new only: the "New" tag, "In review" and the admin queue count. Never as text on white. |
| Graphite | `#1D1B2E` | Text, the prototype bar, metro badges, map pins |
| Slate | `#5F6478` | Secondary text, captions, form field borders |
| Mist | `#DCDDE8` | Borders and hairline dividers |
| Cloud | `#F6F6FA` | Second surface: sidebars, table headers, tags, footer |
| White | `#FFFFFF` | Main background |
| Error | `#B42318` | Form errors only |

Links are graphite text with an orchid underline, because orchid text on white
is too faint to read. No other colours are used anywhere, including the map.
Status tags use real states: Live (orchid outline), In review (gold), Draft
(cloud, slate text). The colours are CSS variables at the top of `index.html`.

### Navigation

The header has Jobs, For employers and About, plus Sign in and Create
profile. Under 768px the links collapse into a Menu button. The prototype bar
has a "Jump to" menu for every screen, including Admin. Every screen also has
its own link:

| Link | Screen |
| --- | --- |
| `#home` | Home |
| `#jobs` | Roles in Milan |
| `#jobs/parttime`, `#jobs/day`, `#jobs/tutoring`, `#jobs/project`, `#jobs/internship` | Roles with that type pre-selected |
| `#jobs/high`, `#jobs/remote` | Roles paying €18/h or more, or remote roles |
| `#job` | Role detail (sample) |
| `#signup` | Student sign-up |
| `#company` | Employer dashboard |
| `#admin` | Admin |
| `#about` | About and team |

### 1. Home (`#home`)

- **Hero**: "Part-time work and internships in Milan, in English." A working
  search in one row: role or keyword, area, "No Italian needed" (on by
  default) and **Search roles**, which opens the role list with the search
  applied. Under it: "Hiring? Post a role".
- **Map and newest roles side by side.** The map of Milan has 17 company pins
  (20 on-site and hybrid roles). Each pin shows how many roles that company
  has open. Hovering over or focusing a pin lists the roles with pay, schedule
  and when they were posted, and clicking it opens the role list for that company. You can
  drag to pan, use the + / − / reset buttons, double-click to zoom, or click
  the map and then scroll. Below the map: "Open Milan in Google Maps". Next
  to it: the six newest roles and "See all 24 roles".
- **How it works**: three short steps for students and three for employers.
- **About the project**: one paragraph (student-run, non-profit, free,
  launching 18 December) with a link to About.

### 2. Roles in Milan (`#jobs`)

- **Toolbar**: search by role or company, the result count and a sort menu
  (Best match, Highest pay, Newest).
- **Filters** in a sidebar: Type (Part-time, Day job, Tutoring, Short
  project, Internship, with counts), Minimum pay (a slider; day, project and
  monthly pay are converted to an hourly estimate), When, Work mode and
  Language. Under 900px the sidebar becomes a **Filters (n)** button that
  opens a drawer with a live "Show 12 roles" button. The drawer keeps
  keyboard focus inside and closes on Escape.
- **Active filters** appear as removable chips with "Clear all".
- **One list of roles**: title, company and verified mark, then type · area
  with metro badge · schedule, and on the right the pay and how long ago it
  was posted. "New" and "Basic Italian" are the only tags. With Best match,
  the top three rows give a one-line reason.
- **Empty state**: says which filter excludes the most roles and offers to
  remove it.

### 3. Role detail (`#job`)

A sample role: **Weekend barista at Nebbia Coffee Bar**.

- Title, company with verified mark, and tags (New, Part-time, No Italian
  needed).
- Key facts in one row: pay (€11 per hour), schedule (Sat and Sun, 8:00 to
  14:00), location (Porta Venezia, M1) and start (November). Two by two on
  phones.
- About the role, What you'll do, Good to know.
- A side panel: **Apply on company site**, Email employer, Save, the note
  "Applications go straight to the employer", the employer (reviewed by the
  GigoMe team) with a link to the company, and "Report this role".

### 4. Student sign-up (`#signup`)

"Step 2 of 3: Build your profile" with a three-part progress bar.

- **Student email**: a verified address. Only verified student addresses can
  join (confirmed with a 6-digit code), and employers never see it.
- **About you**: name, contact email shown to employers, programme, year of
  study, languages as removable tags with "Add language", availability
  checkboxes, a short intro and an optional CV (PDF up to 5 MB).
- **Privacy**: required consent to the privacy notice, optional email
  alerts, and a note that you can download or delete your data.
- **What employers see**: a preview card of the profile (name, programme,
  verified student, languages, availability, CV).

### 5. Employer dashboard (`#company`)

Shown as the sample employer **Nebbia Coffee Bar** (reviewed employer), with
its sector, area, website and a short description.

- **Your listings**: a table with type, status (Live, In review, Draft) and
  last update.
- **Post a role**: title, type of work, location, pay, schedule, language
  requirement, description, and how students should apply (link or email).
  **Submit for review** changes to "Submitted, in review". GigoMe doesn't
  handle applications, contracts or payments.
- A one-line link to give feedback after hiring a student.

### 6. Admin (`#admin`)

- A sidebar with Overview, Review queue (with a gold count), Students,
  Companies, Reports and Feedback.
- **Goal progress**: 64 / 100 verified students, 7 / 10 reviewed companies
  and 18 live listings.
- **Review queue** as a table (type, item, details, submitted). Approve and
  Reject work: the row disappears, the counts update, and "All caught up"
  shows when it is empty.
- **Reported listings** and **Latest feedback**.

### 7. About (`#about`)

Why GigoMe exists (the language barrier, scattered roles, small businesses
that can't reach students, learning by building), the four principles
(Student-first, Trust-based, Discovery only, Non-profit), a short prototype
note, and the team.

### Sample data

| | |
| --- | --- |
| Roles | 24: 5 part-time, 5 day jobs, 5 tutoring, 5 short projects, 4 internships |
| Companies | 19 fictional employers (cafés, startups, studios, families) |
| Work mode | 13 on-site, 7 hybrid, 4 remote |
| Language | 22 with no Italian needed, 2 with basic Italian |
| Pay | €9.50 to €30 per hour (estimated); 6 roles pay €18/h or more |
| Metro | M1, M2, M3 and M5 badges; none for Ortica, where the nearest station is unclear |

### What works and what is a mock-up

**Works:** navigation and links to every screen, the header menu on phones,
search from Home, the map (pan, zoom, tooltips, company filter), all filters,
sorting, removable filter chips, the empty state, the mobile filter drawer,
removing language tags, the admin queue and "Submit for review".

**Mock-up only:** every role opens the same barista page; apply, email, save,
report, sign in, CV upload, add language, save draft, preview and edit do
nothing; sign-up fields aren't saved and verification is shown as done; admin
sections other than Overview have no content; footer links (privacy notice,
terms, give feedback, contact) go back to Home.

### Editing the prototype

All the content lives in the `<script>` at the bottom of `index.html`:

| What | Where in the script |
| --- | --- |
| Roles | `JOBS` (title, company, type, area, `metro`, work mode, schedule, pay, hourly `rate`, match score) |
| Map pin positions per company | `POS` (a company not listed here is counted as remote) |
| Admin review queue | `queue` |
| Team members | `TEAM` |
| "High-paying" threshold for `#jobs/high` | `HIGH_PAY` (currently €18/h) |

`APPL` (simulated applicant counts) is kept in the data but deliberately not
shown. The stylesheet is in one block at the top: tokens, then base, layout,
components and pages. The map is a large inline SVG (around 430 KB) inside
`#map-stage`, which makes up most of the file size.

## Semester goal

Launch a working platform with **100+ registered students and 10+ registered
companies by 18 December 2026**.

## The problem

International and English-speaking university students in Milan often struggle
to find flexible, student-friendly work, because many opportunities require
Italian or are scattered across informal channels.

## The solution

A simple platform where students create verified profiles and companies publish
English-friendly opportunities. Discovery happens on the platform; applications,
contracts and payments stay outside it.

## Product principles

- **Student-first**: free, low-friction access and flexible opportunities that
  fit around university life.
- **Trust-based**: verified student status, clear employer profiles and
  transparent job information.
- **Simple MVP**: prioritise discovery, profiles and external contact over
  complex integrations.
- **Non-profit first**: build utility and adoption before any monetisation
  discussion.

## Core MVP features

| Students | Companies | Platform |
| --- | --- | --- |
| Sign-up and profile creation | Company registration and profile | Admin dashboard for moderation |
| University-student verification | Job / gig posting | Basic usage tracking and feedback collection |
| Job browsing with basic filters | | |
| External application or contact flow | | |

## Roadmap

| Dates | Phase | Focus | Owners |
| --- | --- | --- | --- |
| 5-31 Oct | Research + V1 + legal clearance | Validate student interest, narrow the first employer segments, define acquisition ideas for both sides. Build the first usable version in parallel. Close legal, privacy and verification questions. | Research, Product, Partnerships |
| 1-14 Nov | Test + marketing activation | Focused 1-2 week test with a small user group, fix the main friction points, launch the first student and employer acquisition initiatives. | Product, Growth, Partnerships |
| 15 Nov-10 Dec | Scale + iterate | Push student and company acquisition in parallel; keep improving the platform from real usage. | All workstreams |
| 11-18 Dec | Final push + delivery | Close remaining product issues, intensify outreach, deliver a stable platform that hits the semester goal. | All workstreams |

## Open questions (to close by 31 October)

- **Access scope**: international students only, or open from day one? If
  broader, define a simple eligibility filter.
- **Student verification**: university email domains / patterns plus email
  verification, unless a stronger integration is actually needed.
- **Legal status**: confirm whether registration or other formal steps are
  required, and complete them before launch.
- **Data & GDPR**: define data collected, privacy notice, consent, retention
  and controller / processor responsibilities.
- **External support**: identify a lawyer, university office, alumnus or
  trusted professional to validate legal and privacy choices.

## Working model

- **Weekly studio session**: about 2 hours together each week, ideally on a
  weekend, to review progress, unblock decisions and work on the project.
- **Flexible individual work**: outside the session, contribute individually or
  in small groups according to availability. Team leads remain available for
  support.

## Definition of success

Validated demand + working product + real users + real companies + compliant
operating model.

---

Source: *International Student Jobs Platform, project brief, October 2026*
(internal working document).
