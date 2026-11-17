# Login code email

The email Supabase Auth sends with the 6-digit login code, through Brevo SMTP.
This file is the source: the live copy is pasted by hand into the Supabase
dashboard (the repo never writes auth or email settings, CLAUDE.md "Email").
When you change it, change it here first, then paste it again.

## Where it goes

- **Sender** (Supabase > Authentication > Emails > SMTP Settings): name
  `GigoMe`, address `hello@gigome.org`. A real address on our own domain:
  a confused student's reply reaches the team's inbox, and the Privacy
  Notice already lists it. gigome.org's SPF, DKIM and DMARC records must stay
  verified in Brevo (HANDOVER.md launch checklist).
- **Templates** (Supabase > Authentication > Emails > Templates): paste the
  subject and the HTML into both **Magic Link** (codes for existing
  accounts) and **Confirm signup** (the first code of a new account). Both
  use `{{ .Token }}` for the code.
- The dashboard takes a subject and an HTML body only. The plain-text
  version below is kept for reference, and for any sender that asks for one.

## Rules

- No links and no images (Brevo rewrites links, and images are blocked or
  counted against us). If Brevo adds an open-tracking pixel to
  transactional emails, keep it turned off in Brevo.
- The code in the subject (it shows in phone notifications) and in large
  type in the body.
- One line on why they got it; never promise anything the site doesn't do.

## Subject

```
{{ .Token }} is your GigoMe login code
```

## HTML

```html
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.5; color: #1d1b2e;">
  <p style="margin: 0 0 12px;">Your GigoMe login code is:</p>
  <p style="margin: 0 0 16px; font-size: 32px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
  <p style="margin: 0 0 12px;">Type it on the GigoMe page where you asked for it. It works once, for a limited time.</p>
  <p style="margin: 0 0 12px;">You received this email because someone asked to log in to GigoMe with this address. If it wasn't you, you can ignore it: nobody can log in without this code. GigoMe will never ask you to share it.</p>
  <p style="margin: 0;">GigoMe</p>
</div>
```

## Plain text

```
Your GigoMe login code is:

{{ .Token }}

Type it on the GigoMe page where you asked for it. It works once, for a limited time.

You received this email because someone asked to log in to GigoMe with this address. If it wasn't you, you can ignore it: nobody can log in without this code. GigoMe will never ask you to share it.

GigoMe
```
