# GigoMe

**Part-time work and internships in Milan, in English.**

GigoMe is a job discovery platform for international and English-speaking
university students in Milan. Employers list English-friendly roles, students
log in with their university email and apply directly with the employer. It is a
student-run project built by the GigoMe Venture Studio team. Free for
students. No monetisation before the platform is useful.

**Website:** https://gigome.org

## The problem

International students in Milan often struggle to find flexible,
student-friendly work. Many opportunities require Italian, and the ones that
don't are scattered across informal channels: group chats, word of mouth and
notice boards. At the same time, small businesses that would happily hire an
English-speaking student have no simple way to reach them.

## What GigoMe does

- **For students:** browse part-time jobs, gigs, tutoring and internships
  that don't need Italian, filtered by keyword, job type, remote work, Italian
  level and hours.
- **For employers:** businesses and private people (a family looking for a
  tutor, someone who needs a dog walker) list roles for free by writing to
  hello@gigome.org.
- **Direct contact:** students apply on the employer's site or by email.
  Contracts and pay are agreed directly between them, outside the platform.

## Principles

- **Student-first:** free, low-friction access and flexible opportunities
  that fit around university life.
- **Trust-based:** verified student status, reviewed employer profiles and
  transparent role information.
- **Simple:** focus on discovery and direct contact rather
  than complex integrations.
- **Useful first:** free for students. No monetisation before the platform
  is useful and widely used.

## Features

What exists today:

| Students | Employers | Platform |
| --- | --- | --- |
| Log in with a university email and a 6-digit code, no password | Log in at `/employers` with a work email and a 6-digit code, set up the company | The team approves companies and reviews every job (publish, request changes, reject) |
| Browse live jobs by keyword, area, category, job type, remote, Italian level and hours, as a list or on a map with the metro lines (search as the map moves, sort by distance from your location, which stays on your device); "New" and nearest-metro badges; a small map on each job page; public company pages | Company name, description and website shown on each job | Only emails from listed university domains get a student account |
| "Apply" on each job once logged in: opens the employer's application page or an email to them | Dashboard: company status, jobs with their status and reviewer notes, apply clicks on live jobs | Jobs disappear from the site when they expire or are closed |
| | Write jobs (drafts while the company is in review), with the area (required for on-site jobs) and an optional pin on the map (or the area only, for a private home), submit, edit, close, delete drafts | |
| Free, always | | Apply clicks are counted per job (never "applications": GigoMe doesn't see whether anyone applied) |
| Send feedback from any page (logged-in users) | | Feedback is readable only by admins |
| Save jobs, save searches (with "N new since your last visit"), follow companies, and see the jobs you opened, all under "Saved jobs" and only for you; no emails | Follower count on the dashboard (never who) | |
| Filter by when the job happens and the languages used at work; share a job (the phone's share sheet, or "Copy link") | Preview a job exactly as students will see it before submitting | |
| Report a job (scam, illegal, misleading, discriminatory, other) | | `/admin`: review companies and jobs with a checklist, handle reports; every decision logged with who and when |
| Edit your profile and delete your account on `/account` | | Deleting an account removes the profile and feedback; apply clicks stay, anonymous |


## Not built on purpose

- Student profiles visible to employers.
- Applying through GigoMe.
- Employer ratings or reviews.

The first two would bring GigoMe under Italian job-intermediation rules, and
reviews need moderation we can't provide. Anyone who wants to add one of these
should check with the team's legal person first.

## Goal

Launch with **100+ registered students and 10+ registered companies by
18 December 2026**.

## Roadmap

| Dates | Phase | Focus |
| --- | --- | --- |
| 5-31 Oct | Research, first version, legal clearance | Validate student interest, choose the first employer segments, build the first usable version, close legal, privacy and verification questions. |
| 1-14 Nov | Test and marketing | Test with a small group of users, fix the main friction points, start student and employer acquisition. |
| 15 Nov-10 Dec | Scale and iterate | Grow both sides in parallel and keep improving the platform from real usage. |
| 11-18 Dec | Final push and launch | Close remaining issues, intensify outreach and deliver a stable platform. |

## Open questions

- **Access scope:** international students only, or open to all students from
  day one?
- **Student verification:** university email domains plus email
  verification, unless a stronger integration turns out to be needed.
- **Legal status:** confirm whether registration or other formal steps are
  required before launch.
- **Data and GDPR:** what data is collected, privacy notice, consent,
  retention, and controller and processor responsibilities.
- **External support:** a lawyer, university office, alumnus or trusted
  professional to validate legal and privacy choices.

## How the team works

- **Weekly studio session:** about two hours together each week to review
  progress, unblock decisions and build.
- **Individual work:** outside the session, contribute alone or in small
  groups as availability allows. Team leads stay available for support.

Success means validated demand, a working product, real students, real
companies and a compliant way of operating.

## This repository

| Path | What it is |
| --- | --- |
| [`index.html`](index.html) | The page shell: `<head>` (title, link previews) and the `#root` element React mounts into. The font is self-hosted (`@fontsource-variable/schibsted-grotesk`, imported in `src/main.jsx`). |
| [`src/main.jsx`](src/main.jsx), [`src/App.jsx`](src/App.jsx) | React entry point and router: `/` (home), `/jobs`, `/jobs/:id`, `/companies/:id`, `/saved`, `/account`, `/employers`, `/employers/setup`, `/dashboard` (and its job form), `/admin`, `/login`, `/welcome`, `/privacy`, `/terms`, and a 404 page for any other path. `/about` redirects to the home page. |
| [`src/pages/`](src/pages) | `Home.jsx` (hero search, the newest jobs, how it works), `Jobs.jsx` and `JobDetail.jsx` (the job board), `Company.jsx` (public company pages, with Follow), `Saved.jsx` (saved jobs, saved searches, followed companies, jobs you opened), `Login.jsx` (student login with a 6-digit email code), `Welcome.jsx` (first-time profile details), `Account.jsx` (edit your profile, delete your account), `Employers.jsx`, `EmployerSetup.jsx`, `Dashboard.jsx` and `JobEditor.jsx` (the employer side), `Admin.jsx` (moderation, admins only), `Privacy.jsx` and `Terms.jsx` (placeholders) and `NotFound.jsx`. |
| [`src/components/`](src/components) | Shared React parts: the site header and footer (every page), the feedback button and panel (every page), the page frame, the job card used on the home page and `/jobs`, the configuration error message. |
| [`src/lib/`](src/lib) | `supabase.js` (the Supabase client), `auth.js` (login logic), `jobs.js` (job board queries), `feedback.js` (sends feedback), `useSession.js`, `contact.js`. |
| [`src/styles/`](src/styles) | `site.css` (tokens, base styles and shared components), `auth.css` (login, privacy and terms pages), `header.css` (the site header), `jobs.css` (the job board), `home.css` (the home page), `feedback.css` (the feedback button and panel), `account.css` (the account page), `employer.css` (the employer side) and `admin.css` (moderation and job reports). |
| [`public/`](public) | Copied into `dist/` as is. `_headers` holds the cache rules: pages are always checked for a new version, hashed files in `/assets/` are cached for a year. Also the favicon, the Apple touch icon, the link preview image (`og-image.png`), `brand/`: the logo files (the original JPEGs and transparent PNGs), and `metro/milan-metro.geojson`: the metro lines and stations drawn on every map. |
| [`wrangler.jsonc`](wrangler.jsonc), [`vite.config.js`](vite.config.js) | Build and hosting config: Vite builds the site into `dist/`, Cloudflare Workers serves it as static assets. |
| [`worker/index.js`](worker/index.js) | A tiny Worker script for one job: a daily ping to Supabase so the free project never pauses. Pages don't run it. |
| [`scripts/fetch-metro-stations.mjs`](scripts/fetch-metro-stations.mjs), [`scripts/build-metro-map.mjs`](scripts/build-metro-map.mjs), [`.github/workflows/metro-stations.yml`](.github/workflows/metro-stations.yml) | Build the metro station data migration and the metro map file (`public/metro/milan-metro.geojson`) from the City of Milan's open data (datasets DS535 and DS533, CC BY 4.0). The workflow runs it on GitHub when started by hand from the Actions tab. See SUPABASE.md. |
| [`supabase/queries/kpis.sql`](supabase/queries/kpis.sql) | The numbers (students, companies, live jobs, apply clicks per week) to paste into the Supabase SQL Editor. Read-only. |
| [`HANDOVER.md`](HANDOVER.md) | For the next CTO: every account, how a change goes live, moderation, limits. |
| [`supabase/migrations/`](supabase/migrations) | The database schema. Supabase applies new files here when they are merged into `main`. |
| [`supabase/checks/security_check.sql`](supabase/checks/security_check.sql) | Security check to paste into the Supabase SQL Editor after a migration. |
| [`.env.example`](.env.example) | The build variables: the two the Supabase client needs, and the optional Turnstile site key for the login form's bot check. |
| [`SUPABASE.md`](SUPABASE.md) | The database explained in plain English: tables, who can do what, common tasks. |
| [`CLAUDE.md`](CLAUDE.md) | Rules for AI coding assistants working in this repo. |

The site is a Vite + React app (JavaScript, React Router), hosted on
Cloudflare Workers (static assets) at https://gigome.org and built from the
`main` branch on GitHub. To work on it locally (Node 20.19 or newer):

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` starts a local server with live reload. `npm run build` writes
the site to `dist/`; `npm run preview` or `npx wrangler dev` serves that
folder, the second exactly the way Cloudflare does. The site builds without
environment variables, but jobs and login only work when the two in
`.env.example` are set (copy it to `.env.local` for local work). Without them,
those pages show a clear error instead of crashing.

Everything on the site comes from the database: there is no sample data.
Employers sign up at `/employers`, and every company and job is reviewed on
`/admin` before students see it.
