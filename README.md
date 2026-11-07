# GigoMe

**Part-time work and internships in Milan, in English.**

GigoMe is a job discovery platform for international and English-speaking
university students in Milan. Students create a verified profile, companies
post English-friendly roles, and the two find each other. It is a
student-run, non-profit project built by the GigoMe Venture Studio team.

**Website:** https://gigome.org

## The problem

International students in Milan often struggle to find flexible,
student-friendly work. Many opportunities require Italian, and the ones that
don't are scattered across informal channels: group chats, word of mouth and
notice boards. At the same time, small businesses that would happily hire an
English-speaking student have no simple way to reach them.

## What GigoMe does

- **For students:** browse part-time jobs, day jobs, tutoring, short projects
  and internships that don't need Italian, filtered by pay, schedule, area and
  work mode. Every on-site role shows its area and nearest metro line. Save
  searches for email alerts, follow employers, track every application and
  review employers you worked for.
- **For employers:** businesses and private people (a family looking for a
  tutor, someone who needs a dog walker) post roles for free, accept or
  reject applicants, and alert their recurring past employees first.
- **Direct contact:** students apply on the employer's site or by email.
  Contracts and pay are agreed directly between them, outside the platform.

## Principles

- **Student-first:** free, low-friction access and flexible opportunities
  that fit around university life.
- **Trust-based:** verified student status, reviewed employer profiles and
  transparent role information.
- **Simple:** focus on discovery, profiles, reviews and direct contact rather
  than complex integrations.
- **Non-profit:** build something useful and widely used before any
  discussion of monetisation.

## Features

| Students | Employers | Platform |
| --- | --- | --- |
| Sign-up with university email and a 6-digit code | Accounts for businesses or private people | Review queue for listings, students and employer verification |
| Profile with languages, availability, experience and skills | Optional verification by the team | Goal tracking (students, companies, live listings) |
| Role browsing with filters, a map and metro lines | Choice to show or hide their location | Reported listings and feedback |
| Apply on the employer's site or by email | Contact details on a public employer page | Students and companies overview |
| Dashboard of applications (applied, accepted, rejected) | Listings with applications, accept or reject | |
| Saved roles, saved searches with email alerts, followed employers | Past employees, with alerts first for recurring ones | |
| Ratings and reviews of employers, optionally anonymous | Reviews from students on their dashboard | |

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
| [`index.html`](index.html) | The page shell: `<head>` (title, fonts) and the `#root` element React mounts into. |
| [`src/main.jsx`](src/main.jsx), [`src/App.jsx`](src/App.jsx) | React entry point and router: `/` (home), `/jobs`, `/jobs/:id`, `/login`, `/welcome`, `/privacy`, and a 404 page for any other path. |
| [`src/pages/`](src/pages) | `Home.jsx` (mounts the demo), `Jobs.jsx` and `JobDetail.jsx` (the job board), `Login.jsx` (student login with a 6-digit email code), `Welcome.jsx` (first-time profile details), `Privacy.jsx` (placeholder) and `NotFound.jsx`. |
| [`src/components/`](src/components) | Shared React parts: the site header (every page), the page frame with the footer, the configuration error message. |
| [`src/lib/`](src/lib) | `supabase.js` (the Supabase client), `auth.js` (login logic), `jobs.js` (job board queries), `useSession.js`, `contact.js`. |
| [`src/legacy/`](src/legacy) | The demo as it was in the old single `index.html`: `markup.html` (every screen, including the map) and `app.js` (its script). The demo's screens are hash links such as `/#jobs`, all under `/`. |
| [`src/styles/`](src/styles) | `site.css` (the site's stylesheet), `auth.css` (login pages), `header.css` (the site header) and `jobs.css` (the job board). |
| [`public/`](public) | Copied into `dist/` as is. `_headers` holds the cache rules: pages are always checked for a new version, hashed files in `/assets/` are cached for a year. |
| [`wrangler.jsonc`](wrangler.jsonc), [`vite.config.js`](vite.config.js) | Build and hosting config: Vite builds the site into `dist/`, Cloudflare Workers serves it. |
| [`docs/prototype.md`](docs/prototype.md) | Screen-by-screen notes, design rules, colour palette and how to edit the content and contact details. |
| [`supabase/migrations/`](supabase/migrations) | The database schema. Supabase applies new files here when they are merged into `main`. |
| [`supabase/checks/security_check.sql`](supabase/checks/security_check.sql) | Security check to paste into the Supabase SQL Editor after a migration. |
| [`.env.example`](.env.example) | The two build variables the Supabase client needs. |
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
folder, the second exactly the way Cloudflare does. The current site needs no
environment variables to build, but login only works when the two in
`.env.example` are set (copy it to `.env.local` for local work). Without them,
the login pages show a clear error and the rest of the site still works.

The current version is front-end only: the roles, companies and numbers on
the site are sample data. What you enter is saved in your own browser and
never sent to a server; "Reset" in the top bar clears it.
