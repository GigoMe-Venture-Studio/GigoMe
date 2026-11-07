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
| [`index.html`](index.html) | The website: one self-contained file of HTML, CSS and JavaScript, with no build step. |
| [`wrangler.jsonc`](wrangler.jsonc), [`vite.config.js`](vite.config.js) | Build and hosting config: Vite copies the site into `dist/`, Cloudflare Workers serves it. |
| [`public/_headers`](public/_headers) | Cache rules: pages are always checked for a new version, hashed files in `/assets/` are cached for a year. |
| [`docs/prototype.md`](docs/prototype.md) | Screen-by-screen notes, design rules, colour palette and how to edit the content and contact details. |
| [`supabase/migrations/`](supabase/migrations) | The database schema. Supabase applies new files here when they are merged into `main`. |
| [`supabase/checks/security_check.sql`](supabase/checks/security_check.sql) | Security check to paste into the Supabase SQL Editor after a migration. |
| [`src/lib/supabase.js`](src/lib/supabase.js), [`.env.example`](.env.example) | Supabase client for the website (not used by any page yet) and the two variables it needs. |
| [`SUPABASE.md`](SUPABASE.md) | The database explained in plain English: tables, who can do what, common tasks. |
| [`CLAUDE.md`](CLAUDE.md) | Rules for AI coding assistants working in this repo. |

The site is hosted on Cloudflare Workers (static assets) at
https://gigome.org, built from the `main` branch on GitHub. To work on it
locally (Node 20.19 or newer):

```bash
npm install
```

```bash
npm run dev
```

`npm run build` writes the site to `dist/`, and `npx wrangler dev` serves
that folder the way Cloudflare does. The current site needs no environment
variables to build; the Supabase client will need the two in `.env.example`
once a page uses it. You can also just open `index.html` in a browser.

The current version is front-end only: the roles, companies and numbers on
the site are sample data. What you enter is saved in your own browser and
never sent to a server; "Reset" in the top bar clears it.
