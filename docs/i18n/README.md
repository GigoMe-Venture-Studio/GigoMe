# Italian translation: review files

GigoMe has an "EN | IT" switch in the header. English is the default and
the original; the Italian is a translation that a native speaker and the
team's legal person review before it goes live.

## The files

- `review-it.csv`: every text on the site, one row each:
  `page, key, English, Italian`. Open it in Excel, Numbers or Google
  Sheets (UTF-8). Write corrections in the Italian column, or add a column
  for comments, and send it back; the developer copies the changes into
  `src/i18n/it.json`.
- `review-legal-it.csv`: the Privacy Notice and the Terms, paragraph by
  paragraph: `document, section, English, Italian`. On the site the Italian
  versions start with "Traduzione di cortesia. In caso di differenze,
  prevale la versione inglese." (key `legal.courtesy` in `review-it.csv`).
  The English texts stay the ones that count.

Both files are made from the translation files by
`node scripts/i18n-review.mjs`; a test fails while they are out of date, so
what you review is what the site shows.

## How to read a row

- `{name}`, `{count}`, `{date}`, `{email}` ...: filled in by the site (a
  name, a number, a date, an address). Keep them, exactly as written, in
  the place the Italian sentence needs them.
- `<link>words</link>`, `<strong>words</strong>`, `<b>…</b>` and similar:
  the words in between become a link or bold text. Keep the tags around
  the matching Italian words.
- Keys ending in `_one` / `_other`: the same sentence for 1 and for more
  than 1 ("1 giorno fa", "3 giorni fa").
- `example.jobRest` and `example.companyRest` start with a space on
  purpose: screen readers read them right after the word "Esempio"
  ("Esempio di annuncio, non è un'offerta vera").
- Dates are written by the browser in Italian ("3 dicembre 2026"); after
  "il", "al", "dal" the site writes "il 1º", "l'8", "all'11" by itself.
- Prices: "€9,50/h", "€600/mese (≈ €12/h)".

## Choices already made (change them in one place if you disagree)

"tu" everywhere, employers included; "Candidati" (Apply), "Salva" /
"Salvata" (Save), "Esempio" (Example), "Segnala questa offerta" (Report
this job), "offerta" for a job and "annuncio" for a listing. The full list
is in the pull request that added the translation.

Not translated, on purpose: what users write (jobs, company descriptions,
the example listings, feedback, reports), names from the database
(universities, areas of Milan, metro stations) and the login email, which
is set in the Supabase dashboard (drafts in `docs/email/login-code.md`).
