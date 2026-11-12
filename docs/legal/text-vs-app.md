# Privacy Notice v1.0 and Terms v2.0 compared with what GigoMe does

For the team's legal person. Written on 11 November 2026 from the code and
the database rules as they are on that day. The published wording was **not**
changed: each point below says what the text says, what the app actually
does, and a suggested way to make them match. Changing the app instead is
sometimes the better fix; that is noted where it applies.

"PR B" refers to the change that added terms acceptance with a version, an
18+ statement and automatic deletion periods (live since November 2026).
Points it settled are marked.

## Privacy Notice v1.0

### 1. The button is called "Apply", not "Reveal Contact"
- **Text** ("Privacy at a glance", sections 2, 3, 4, 5): "When a registered student selects **Reveal Contact**...".
- **App:** there is no "Reveal Contact" button. A logged-in student presses **Apply** on a job page. GigoMe then shows the employer's application link and/or email under "How to apply" and, at the same time, opens the link in a new tab or the student's email app with the subject "Application: <job title> (via GigoMe)". Logged-out visitors see "Log in to see how to apply".
- **Suggested:** replace "Reveal Contact" with "Apply" and describe it once: "When a registered student presses **Apply** on a job page, GigoMe shows the advertiser's application link or email address and opens it (the link in a new tab, the email in the student's email app). The student then applies directly with the advertiser, outside GigoMe."

### 2. Who can see the apply-click records
- **Text** (glance, 2 "Contact-reveal records", 4, 5): "This log is not provided to advertisers and can be viewed only by authorized GigoMe administrators." / "Only authorized administrators can consult these records."
- **App:**
  - Each student sees their own records: "Jobs you opened" on the Saved jobs page, and in "Download my data".
  - Advertisers see, on their dashboard, **how many** times students pressed Apply on each of their own listings ("4 apply clicks"), never who.
  - Admins see everything.
- **Suggested:** "This record is never shown to advertisers. Advertisers see only the number of times students pressed Apply on each of their listings, not who. Each student can see their own list ("Jobs you opened"). Otherwise only authorized GigoMe administrators can view it."

### 3. Account deletion is self-service
- **Text** (section 10): "Account deletion is currently processed **manually by an authorized administrator**; it is not advertised as an automatic self-service function."
- **App:** `/account` has **Delete my account**: after a reminder and typing DELETE, the account and its data are deleted at once (details in `SUPABASE.md`, "When someone deletes their account"). There is also **Download my data**, which gives the user a file with everything GigoMe holds about them. Email requests are still handled by hand for people who can't log in.
- **Suggested:** "You can delete your account yourself at any time on your Account page ("Delete my account"); this deletes your account and personal data immediately, except the records described in section 9 that are kept without your name. You can also download a copy of your data there ("Download my data"). If you can't log in, write to privacy@gigome.org and we will do it for you."

### 4. Profile fields that don't exist
- **Text** (section 2 "Student profile information"): "optional educational background, course of study, languages, skills, past experience, general preferences and, if these fields are enabled, age or nationality."
- **App:** a student profile has only: name, degree level (bachelor's, master's, single-cycle, PhD, exchange student, other) and expected graduation year, plus the university, which comes from the email address. No course, languages, skills, experience, preferences, age or nationality.
- **Suggested:** "Student profile information: name, degree level and expected graduation year, and the university your email address belongs to. These are not shown to advertisers."

### 5. Student activity that isn't mentioned
- **Text:** the categories in section 2 don't cover these.
- **App:** students can keep:
  - saved jobs;
  - saved searches (a name and the search filters, plus when they last opened it, to show "N new since your last visit");
  - companies they follow (the company sees only how many students follow it, never who).
  
  All of this is visible only to the student (and to admins), never emailed, and deleted with the account.
- **Suggested:** add to section 2: "**Things you choose to keep:** saved jobs, saved searches (a name and your search filters) and companies you follow. Only you can see them; a company sees only how many students follow it, not who. They are deleted with your account."

### 6. The feedback form and in-app job reports
- **Text** (section 2 "Communications and reports"): only "emails sent to hello@gigome.org or privacy@gigome.org ... fraud reports". Terms 15.1 also points reports to hello@gigome.org.
- **App:**
  - **Feedback:** a "Feedback" button on every page sends a message (up to 2,000 characters) together with the page it was sent from. It is stored with the sender's account and read by admins. It is deleted with the account.
  - **"Report this job":** at the bottom of every job page. It stores the reason, optional details and the reporter's account; only admins read it. If the reporter deletes their account, the report is kept without their name.
- **Suggested:** add to section 2: "**Feedback and reports sent in the app:** feedback messages (with the page you were on) and job reports (reason and details). Only administrators read them. Feedback is deleted with your account; a job report is kept without your name so that fraud reports aren't lost." In the Terms, 15.1: "...may be reported with **Report this job** on the job page or to hello@gigome.org."

### 7. Outside services not named
- **Text** (section 6): Supabase, Cloudflare (domain, hosting, web delivery, security, email forwarding), Brevo, Gmail. Section 8: "GigoMe does not intentionally deploy non-essential ... analytics cookies."
- **App** (`HANDOVER.md`, section 7b):
  - **Cloudflare Web Analytics is active.** It is cookieless, but it records page visits, load times, the referring site, browser and country.
  - **Cloudflare Turnstile** checks the browser on the login form to tell people from bots.
  - **OpenFreeMap** (map tiles) is contacted by the visitor's browser whenever a map is shown.
  - **OpenStreetMap Nominatim** receives the address an employer types when they press "Find address".
  - **Google Maps** is contacted only if someone clicks "Open in Google Maps".
  - "Use my location" uses the browser's own location service; GigoMe never receives the position.
- **Suggested:** add these to section 6. Section 8 can stay true about cookies, but should say: "We use Cloudflare Web Analytics, which counts page visits without cookies or other storage on your device." (Or the team switches Web Analytics off in Cloudflare; then nothing changes in the text.)

### 8. Who can see an advertiser's contact details
- **Text** (section 5): "Other users and visitors may see listings and the contact information that Advertisers have chosen to display".
- **App:** visitors and logged-out users see listings but **never** the contact details. Those are shown only to a logged-in student who presses Apply, and each press is recorded. The company's own contact email (from company setup) is never shown to anyone except the owner and admins.
- **Suggested:** "Anyone can see published listings. The application link or email address of a listing is shown only to logged-in students who press Apply."

### 9. Telephone numbers
- **Text** (section 2 advertiser information; Terms 7.1, 11.1): "chosen email address, phone number or external application URL".
- **App:** a listing can have an application link and/or an email address. There is no phone field.
- **Suggested:** drop "phone number" / "telephone number" (or the team adds a phone field later and the text stays).

### 10. Roles
- **Text** (section 2): "role (student, business or private advertiser)". Terms section D describes Private Advertisers and families.
- **App:** there are two kinds of account: **student** (email from a listed university) and **company** (any other email). A private person or family who wants to advertise signs up on the employers page and must fill in a "Company name". The app doesn't record whether an advertiser is a business or a private person.
- **Suggested:** either "role (student or advertiser)" in the Privacy Notice, or the team adds a "private person" option to the employer sign-up (worth it if Terms section D is meant to apply).

### 11. Retention periods
- **Text** (section 9): incomplete registrations 30 days; listings 90 days after removal; contact-reveal logs 180 days; active accounts 24 months after last activity with a warning; security logs 90 days; correspondence 12 months; fraud records 24 months after resolution; terms-acceptance records 36 months after closure.
- **App (since November 2026),** automatic every night, each a day under the Notice's limit so a nightly run is never late:
  - incomplete sign-ups deleted after 29 days;
  - removed or expired listings: contact, saves and details removed after 89 days (listings with a report are kept as evidence);
  - apply-click records made anonymous after 179 days (the per-listing counts advertisers see stay correct);
  - fraud records (job reports) deleted 730 days after resolution. A report now also outlives the deleted job or company, keeping only the job title and company name.
- **Done by hand (HANDOVER.md section 7d, owner: Emil):** 24 months of inactivity with an emailed warning (the free email plan can't promise bulk warnings); the authentication log (Supabase's audit log, switched off in the database or emptied monthly); support and privacy email after 12 months.
- **Not done:** **Terms acceptance after closure.** When an account is deleted, the record of when its holder accepted the Terms is deleted with it. Nothing is kept for 36 months.
- **Suggested:** either keep the 36-month rule and the team builds a separate, minimal acceptance record that outlives the account, or change section 9 to: "The record of your acceptance is deleted with your account." The legal person decides which.

### 12. Terms acceptance and age (glance, sections 2 "Contract and compliance records", 12)
- **Text:** "date and version of accepted Terms" are recorded; GigoMe is for people aged 18 or over.
- **App today:**
  - Students never accept the Terms or confirm their age.
  - Employers tick "I accept the terms" when they create their company, and only the date is stored, not which version.
- **PR B** added a required "I'm 18 or older and I accept the Terms" for everyone (with the version and the time), and asked existing accounts once.
- **Suggested:** no change to the text: settled by PR B.

### 13. Small points
- **Brevo** (section 6) "delivery of one-time login codes and certain operational emails": GigoMe sends only login codes. Suggested: "delivery of one-time login codes."
- **Local storage** (section 8) mentions only the login session. The browser also keeps, for the open tab only (session storage), the email a login code was just sent to and whether the metro lines are hidden on maps. Suggested: add "and, for the open tab only, the email address a login code was just sent to".
- **The map pin:** advertisers can give an exact location (a pin on the map) or only the area. Section 2's "work location" covers it; optionally add "work location (an area of Milan, and optionally an exact point on the map)".
- **Moderation notes:** admin decisions (approve, reject, request changes) are recorded with the admin, the time and a note. When a company is deleted, its decisions stay without the company or job. Not mentioned; optional under "Contract and compliance records".
- **Section 14 security** ("The technical team reports that Row Level Security is enabled..."): true. PR B extended the automatic security check to prove each access claim in this notice.

## Terms and Conditions v2.0

### 14. When an account is created (2.2)
- **Text:** "An account may be created only after the User has been able to consult and actively accept these Terms."
- **App:** the login account is created when someone asks for a login code, before they enter it and before they accept anything. That is how the email login works. PR B made acceptance the first step after logging in: nothing else on the site can be used until it is ticked.
- **Suggested:** "Before using an account, the User must consult and actively accept these Terms. An account that never does is deleted after 30 days (Privacy Notice, section 9)."

### 15. Specific approval of clauses (2.4, Italian Civil Code art. 1341)
- **Text:** "Clauses requiring specific acceptance ... shall be presented for legally effective separate approval."
- **App:** there is no separate approval step. PR B adds one checkbox ("I'm 18 or older and I accept the Terms").
- **Decision needed:** if any clause needs art. 1341 approval, list those clauses; the team adds a second checkbox naming them.

### 16. Reveal Contact (7.1 to 7.4, 11.3)
Same as point 1 above, and in 11.3 the advertiser does see counts (point 2). Suggested for 11.3: "It does not disclose to the Advertiser which Students pressed Apply; the Advertiser sees only how many times Students did so for each of its listings."

### 17. Account closure (20.1)
- **Text:** "Users can request account closure ... by emailing privacy@gigome.org. Requests are currently handled manually."
- **App:** self-service, as in point 3.
- **Suggested:** "Users can delete their account at any time on their Account page, or by emailing privacy@gigome.org if they can't log in."

### 18. Profiles (6.3)
- **Text:** "optional profile details, such as educational background, skills or general preferences".
- **App:** name, degree level, graduation year only (point 4).

### 19. Phone numbers (7.1, 11.1)
See point 9.

### 20. Private advertisers (section D)
See point 10. As built, the app can't tell a family from a business.

### 21. No internships (checked 12 November 2026)
- **Decision:** GigoMe lists only paid part-time jobs and gigs. Internships (including unpaid curricular internships) are no longer offered, and the database refuses new ones.
- **Text:** neither published text mentions internships, traineeships, tirocini or stages. The only related wording is Terms v2.0 section 10.3, which forbids advertisers to "require unlawful unpaid productive trials"; it still fits and needs no change.
- **Suggested:** nothing required. If a future version describes what GigoMe lists, say "paid part-time jobs and gigs".

## Also to check (not visible from the code)

- **`privacy@gigome.org`** is named in both texts. Make sure it receives mail and someone reads it (the site's contact address is hello@gigome.org).
- **Gmail and Cloudflare email forwarding** (Privacy Notice section 6): which inbox is used isn't recorded anywhere in the repository (`HANDOVER.md` section 1 still says "[fill in]").
