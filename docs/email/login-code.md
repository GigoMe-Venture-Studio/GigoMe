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
  subject and the HTML of **"The template to paste"** below into both
  **Magic Link** (codes for existing accounts) and **Confirm signup** (the
  first code of a new account), the same in both. Both use `{{ .Token }}`
  for the code and `{{ .Data.language }}` for the language.
- The dashboard takes a subject and an HTML body only. The plain-text
  version below is kept for reference, and for any sender that asks for one.

## Rules

- No links and no images (Brevo rewrites links, and images are blocked or
  counted against us). If Brevo adds an open-tracking pixel to
  transactional emails, keep it turned off in Brevo.
- The code in the subject (it shows in phone notifications) and in large
  type in the body.
- One line on why they got it; never promise anything the site doesn't do.

## The template to paste (English, Italian or both)

One subject and one body that pick the language saved with the account:
`.Data` is the account's user metadata, and `language` is `"it"` or `"en"`,
the site's language when the code was asked for (`sendCode()` in
`src/lib/auth.js`) or when a logged-in user last switched
(`src/components/EmailLanguageSync.jsx`). An account without one (made
before this, or a value someone set by hand) gets both languages. Built
from the three versions below; the wording is theirs, unchanged.

How Supabase fills it in (checked in its Auth server's source, November
2026): both templates are Go `html/template`s, the subject too, with
`Data` set to the user's metadata. The language is first turned into text
(`printf "%v"`), so a missing one, or any other value someone set by hand
(even a number, which would make a plain `eq` fail and the email not be
sent), falls through to the bilingual version. Supabase
saves the `language` sent with a code request only when it creates the
account; for existing accounts the site updates it after login with
`updateUser`, which adds the key and keeps the others (`signup_as`).
The metadata is only for this email's language: users can change their own
metadata, so nothing else may ever read it.

### Subject

```
{{ $lang := printf "%v" .Data.language }}{{ if eq $lang "it" }}{{ .Token }} è il tuo codice di accesso a GigoMe{{ else if eq $lang "en" }}{{ .Token }} is your GigoMe login code{{ else }}{{ .Token }} is your GigoMe login code / codice di accesso{{ end }}
```

### HTML

```html
{{ $lang := printf "%v" .Data.language }}<div style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.5; color: #1d1b2e;">
{{ if eq $lang "it" }}
  <p style="margin: 0 0 12px;">Il tuo codice di accesso a GigoMe è:</p>
  <p style="margin: 0 0 16px; font-size: 32px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
  <p style="margin: 0 0 12px;">Inseriscilo nella pagina di GigoMe in cui l'hai richiesto. Funziona una sola volta e per un tempo limitato.</p>
  <p style="margin: 0 0 12px;">Hai ricevuto questa email perché qualcuno ha chiesto di accedere a GigoMe con questo indirizzo. Se la richiesta non è partita da te, puoi ignorarla: nessuno può accedere senza questo codice. GigoMe non ti chiederà mai di condividerlo.</p>
{{ else if eq $lang "en" }}
  <p style="margin: 0 0 12px;">Your GigoMe login code is:</p>
  <p style="margin: 0 0 16px; font-size: 32px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
  <p style="margin: 0 0 12px;">Type it on the GigoMe page where you asked for it. It works once, for a limited time.</p>
  <p style="margin: 0 0 12px;">You received this email because someone asked to log in to GigoMe with this address. If it wasn't you, you can ignore it: nobody can log in without this code. GigoMe will never ask you to share it.</p>
{{ else }}
  <p style="margin: 0 0 12px;">Your GigoMe login code is:<br>Il tuo codice di accesso a GigoMe è:</p>
  <p style="margin: 0 0 16px; font-size: 32px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
  <p style="margin: 0 0 12px;">Type it on the GigoMe page where you asked for it. It works once, for a limited time.</p>
  <p style="margin: 0 0 12px;">You received this email because someone asked to log in to GigoMe with this address. If it wasn't you, you can ignore it: nobody can log in without this code. GigoMe will never ask you to share it.</p>
  <hr style="margin: 20px 0; border: 0; border-top: 1px solid #dcdde8;">
  <p style="margin: 0 0 12px;" lang="it">Inseriscilo nella pagina di GigoMe in cui l'hai richiesto. Funziona una sola volta e per un tempo limitato.</p>
  <p style="margin: 0 0 12px;" lang="it">Hai ricevuto questa email perché qualcuno ha chiesto di accedere a GigoMe con questo indirizzo. Se la richiesta non è partita da te, puoi ignorarla: nessuno può accedere senza questo codice. GigoMe non ti chiederà mai di condividerlo.</p>
{{ end }}
  <p style="margin: 0;">GigoMe</p>
</div>
```

`node --test tests/unit/login-email.test.mjs` checks that this template
has the three versions, the code in each and in the subject, and the
same words as the versions below. Rendered with Go's `html/template` for
"it", "en", no language, no metadata at all, "fr" and a number before it
was first written here: no errors, the code in every subject and body.

## The three versions it is built from

### English: subject

```
{{ .Token }} is your GigoMe login code
```

### English: HTML

```html
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.5; color: #1d1b2e;">
  <p style="margin: 0 0 12px;">Your GigoMe login code is:</p>
  <p style="margin: 0 0 16px; font-size: 32px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
  <p style="margin: 0 0 12px;">Type it on the GigoMe page where you asked for it. It works once, for a limited time.</p>
  <p style="margin: 0 0 12px;">You received this email because someone asked to log in to GigoMe with this address. If it wasn't you, you can ignore it: nobody can log in without this code. GigoMe will never ask you to share it.</p>
  <p style="margin: 0;">GigoMe</p>
</div>
```

### English: plain text

```
Your GigoMe login code is:

{{ .Token }}

Type it on the GigoMe page where you asked for it. It works once, for a limited time.

You received this email because someone asked to log in to GigoMe with this address. If it wasn't you, you can ignore it: nobody can log in without this code. GigoMe will never ask you to share it.

GigoMe
```

The Italian and the combined English and Italian versions (approved with
the Italian site, November 2026). The combined one is what accounts
without a saved language get. Same rules as above: no links, no images,
the code in the subject and in large type.

### Italian: subject

```
{{ .Token }} è il tuo codice di accesso a GigoMe
```

### Italian: HTML

```html
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.5; color: #1d1b2e;">
  <p style="margin: 0 0 12px;">Il tuo codice di accesso a GigoMe è:</p>
  <p style="margin: 0 0 16px; font-size: 32px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
  <p style="margin: 0 0 12px;">Inseriscilo nella pagina di GigoMe in cui l'hai richiesto. Funziona una sola volta e per un tempo limitato.</p>
  <p style="margin: 0 0 12px;">Hai ricevuto questa email perché qualcuno ha chiesto di accedere a GigoMe con questo indirizzo. Se la richiesta non è partita da te, puoi ignorarla: nessuno può accedere senza questo codice. GigoMe non ti chiederà mai di condividerlo.</p>
  <p style="margin: 0;">GigoMe</p>
</div>
```

### Italian: plain text

```
Il tuo codice di accesso a GigoMe è:

{{ .Token }}

Inseriscilo nella pagina di GigoMe in cui l'hai richiesto. Funziona una sola volta e per un tempo limitato.

Hai ricevuto questa email perché qualcuno ha chiesto di accedere a GigoMe con questo indirizzo. Se la richiesta non è partita da te, puoi ignorarla: nessuno può accedere senza questo codice. GigoMe non ti chiederà mai di condividerlo.

GigoMe
```

### English and Italian: subject

The code first, so it still shows in a phone notification. Under 60
characters with a 6-digit code.

```
{{ .Token }} is your GigoMe login code / codice di accesso
```

### English and Italian: HTML

```html
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.5; color: #1d1b2e;">
  <p style="margin: 0 0 12px;">Your GigoMe login code is:<br>Il tuo codice di accesso a GigoMe è:</p>
  <p style="margin: 0 0 16px; font-size: 32px; font-weight: bold; letter-spacing: 6px;">{{ .Token }}</p>
  <p style="margin: 0 0 12px;">Type it on the GigoMe page where you asked for it. It works once, for a limited time.</p>
  <p style="margin: 0 0 12px;">You received this email because someone asked to log in to GigoMe with this address. If it wasn't you, you can ignore it: nobody can log in without this code. GigoMe will never ask you to share it.</p>
  <hr style="margin: 20px 0; border: 0; border-top: 1px solid #dcdde8;">
  <p style="margin: 0 0 12px;" lang="it">Inseriscilo nella pagina di GigoMe in cui l'hai richiesto. Funziona una sola volta e per un tempo limitato.</p>
  <p style="margin: 0 0 12px;" lang="it">Hai ricevuto questa email perché qualcuno ha chiesto di accedere a GigoMe con questo indirizzo. Se la richiesta non è partita da te, puoi ignorarla: nessuno può accedere senza questo codice. GigoMe non ti chiederà mai di condividerlo.</p>
  <p style="margin: 0;">GigoMe</p>
</div>
```

### English and Italian: plain text

```
Your GigoMe login code is:
Il tuo codice di accesso a GigoMe è:

{{ .Token }}

Type it on the GigoMe page where you asked for it. It works once, for a limited time.

You received this email because someone asked to log in to GigoMe with this address. If it wasn't you, you can ignore it: nobody can log in without this code. GigoMe will never ask you to share it.

---

Inseriscilo nella pagina di GigoMe in cui l'hai richiesto. Funziona una sola volta e per un tempo limitato.

Hai ricevuto questa email perché qualcuno ha chiesto di accedere a GigoMe con questo indirizzo. Se la richiesta non è partita da te, puoi ignorarla: nessuno può accedere senza questo codice. GigoMe non ti chiederà mai di condividerlo.

GigoMe
```

Points for the reviewers: "Se la richiesta non è partita da te" is used
instead of the more common "Se non sei stato tu", which is masculine. The
subject mixes both languages after the code; an
alternative is the English subject alone, since the code is what matters
there.
