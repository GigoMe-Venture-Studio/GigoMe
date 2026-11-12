# Privacy notice: DRAFT, NOT PUBLISHED

> **Superseded.** The published texts are in `docs/legal/published/` (Privacy
> Notice v1.0, Terms and Conditions v2.0, November 2026) and are on `/privacy`
> and `/terms`. Where they don't match what the app does yet, see
> `docs/legal/text-vs-app.md`. This draft is kept for its notes only.

> **For the team's legal person.** This draft describes what GigoMe actually
> does, taken from the code and from `HANDOVER.md` (sections 7b and 7c) as of
> November 2026. It is not legal advice and has not been reviewed by a
> lawyer. Every point marked **[LEGAL: ...]** needs a decision before it can
> be published. The live `/privacy` page stays a placeholder until then; when
> the text is final, it goes into `src/pages/Privacy.jsx`.
>
> If the site changes (a new service, a new kind of data), this text must
> change with it: check `HANDOVER.md` 7b and 7c, which are kept up to date.

---

## 1. Who we are

GigoMe (gigome.org) is a free job board for international students in Milan:
part-time jobs and gigs they can do in English.

GigoMe is operated by **[LEGAL: name and legal form of the operator (a
person, an association, a company?), registered address, tax or company
number if any]**. The operator is the **data controller** for the personal
data described here.

Contact for anything about your data: **hello@gigome.org**
**[LEGAL: confirm this address, who reads it, and whether a postal address
is needed. Is a Data Protection Officer required? Probably not at this
scale: confirm.]**

## 2. What we collect, why, and on what legal basis

**[LEGAL: confirm each legal basis below. The draft assumes "contract"
(GDPR art. 6(1)(b)) for what the service needs to work, and "legitimate
interests" (art. 6(1)(f)) for safety, moderation and statistics. Consent is
not used anywhere today.]**

### Students

| Data | Why | Legal basis |
| --- | --- | --- |
| University email address | To log in (a 6-digit code is emailed to it) and to check you're a student of a university we work with (only its domain is checked) | Contract |
| Name, degree level, graduation year | Your name is shown to you in the site's header; none of the three is shown to employers. Degree and year are for our own statistics | Contract **[LEGAL: all three are required at sign-up today, but the site itself only uses the name. Data minimisation: decide whether degree and year stay required, become optional, or are dropped.]** |
| Saved jobs, saved searches, companies you follow | So you can come back to them. Companies see only how many students follow them, never who | Contract |
| Apply clicks: which job and when you pressed "Apply" | So you can see the jobs you opened, so employers see how many students pressed "Apply" on their jobs (a number, never who), and for our own statistics. We don't know whether you then applied | Contract (your list); legitimate interests (counts and statistics) |
| Reports you file about a job | To keep the site safe from scams and illegal offers | Legitimate interests |
| Feedback you send, with the page you were on | To improve the site | Legitimate interests |

### Employers (company accounts)

| Data | Why | Legal basis |
| --- | --- | --- |
| Login email address, and your name | To log in, and to show who you are in the site's header | Contract |
| Company name, website, description, contact email, when the terms were accepted | To show the company and its jobs, and to check it's a real company before approving it. The contact email is never shown on the site | Contract; legitimate interests (checking employers) |
| Jobs, how students apply (a link and/or an email address), review notes | To publish the jobs. The apply link or email is shown only to logged-in students who press "Apply" | Contract |

### Everyone

| Data | Why | Legal basis |
| --- | --- | --- |
| Technical data: IP address, browser, pages requested | Our hosting and database providers process it to serve the site and protect it from abuse; it is kept in their logs for a short time | Legitimate interests |
| A bot check on the login forms (Cloudflare Turnstile) | To stop automated sign-ups | Legitimate interests **[LEGAL: Turnstile runs in a frame from Cloudflare and may use its own storage there. Confirm no consent is needed, or describe it as strictly necessary for security.]** |
| Page visit statistics (Cloudflare Web Analytics, switched on) | To see which pages are used and how fast they load. No cookies, no tracking across sites | Legitimate interests **[LEGAL: confirm; it runs on every page, so no consent is asked today]** |

We do **not**: sell data, show ads, track you across other sites, build
profiles, or make automated decisions about you. Employers never see student
profiles, and we never pass your name or email to them: you apply directly
on their page or by email, and what you send them is between you and them.

## 3. Where your data goes (processors and other services)

| Service | What for | What it receives | Where |
| --- | --- | --- | --- |
| Supabase | Database and logins | Everything above | Frankfurt, Germany (EU) |
| Cloudflare | Hosting, bot check (Turnstile), page statistics (Web Analytics) | Page requests, IP address, browser details | Worldwide network **[LEGAL: Cloudflare is a US company; check its data processing addendum and the transfer basis (EU-US Data Privacy Framework / standard contractual clauses).]** |
| Brevo | Sends the login-code emails | Your email address and the code | EU (France) **[LEGAL: confirm]** |
| OpenFreeMap | Map images, only when a map is shown | Which part of the map is viewed, IP address | **[LEGAL: check where OpenFreeMap is hosted and whether it keeps logs]** |
| OpenStreetMap Nominatim | Finding an address, only when an employer presses "Find address" | The address typed, IP address | UK / EU (OpenStreetMap Foundation) |
| Google Maps | Only if you click "Open in Google Maps" on a job page: a normal link to Google | Whatever Google receives from any visit | Google's own privacy policy applies |
| Your browser's location service | Only if you press "Use my location" on the jobs map and allow it | Up to your browser. GigoMe never receives or stores your position: it stays in the open page | Your browser's provider |

**[LEGAL: data processing agreements (DPAs) with Supabase, Cloudflare and
Brevo: confirm they are accepted in each account.]**

## 4. Cookies and browser storage

GigoMe sets **no cookies**. It keeps only what the site needs to work, in
your browser:

- your **login session** (localStorage), until you log out or it expires;
- while you log in, the **email address a code was sent to** (sessionStorage,
  this tab only), so reloading the page doesn't lose it;
- whether you **hid the metro lines** on a map (sessionStorage, this tab
  only).

Cloudflare's bot check (Turnstile) on the login forms may keep its own data
inside its frame. **[LEGAL: confirm that no cookie banner is needed: all of
the above is strictly necessary or chosen by the user. If Cloudflare adds
its own cookies on the live domain (bot protection features), list them
here.]**

## 5. How long we keep it

| Data | Kept until |
| --- | --- |
| Your account, profile, saved jobs, saved searches, follows | You delete your account |
| Feedback you sent | You delete your account **[LEGAL: or a fixed period?]** |
| Apply clicks | Kept after your account is deleted, without anything linking them to you (anonymous counts) |
| Reports you filed | Kept after your account is deleted, without your name, so a report about a bad job isn't lost |
| Company, jobs, how to apply | The company account is deleted |
| Closed and expired jobs | **[LEGAL: decide a period, e.g. 12 months after they end]** |
| Resolved reports | **[LEGAL: decide a period]** |
| Feedback | **[LEGAL: decide a period]** |
| Accounts nobody has logged in to | **[LEGAL: decide a period, e.g. 24 months. Note: deleting an inactive company account deletes its company and jobs. Decide whether to warn people first (the site can't send bulk emails on the free email plan).]** |
| Technical logs at our providers | Their own short periods (days to weeks) **[LEGAL: check each provider]** |

The site is ready to apply these periods automatically once they are set
(see `SUPABASE.md`, "Data retention"). Until then nothing is deleted
automatically.

## 6. Your rights

You can:

- **see and download your data:** on your account page, "Download my data"
  gives you a file with everything we hold about you;
- **correct it:** change your name, degree and graduation year on your
  account page (your email can't be changed: write to us);
- **delete it:** "Delete my account" on your account page deletes your
  account at once (see section 5 for what stays, anonymously);
- **object** to processing based on legitimate interests, or **restrict** it:
  write to hello@gigome.org;
- **complain** to the Italian data protection authority (Garante per la
  protezione dei dati personali, garanteprivacy.it) or the authority where
  you live.

We answer within one month. **[LEGAL: confirm, and who handles requests.]**

## 7. Security

Each person can read only their own data; this is enforced by the database
itself, not only by the website. Logins use one-time codes, never
passwords. Connections are encrypted (HTTPS). Employers' contact details are
shown only to logged-in students who press "Apply". **[LEGAL: describe the
breach procedure: who is told, within 72 hours, by whom.]**

## 8. Age

GigoMe is for university students. **[LEGAL: minimum age? Students under 18
are rare but possible; decide whether to state 18+ or 16+ and what happens
if a minor signs up.]**

## 9. Changes

We'll update this notice when the site changes, and show the date of the
latest version here. Last updated: **[LEGAL: date]**.
