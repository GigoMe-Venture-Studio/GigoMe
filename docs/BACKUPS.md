# Backups: what we'd lose, and what to do about it

An assessment, November 2026. Nothing here is built yet. Prices change: check
https://supabase.com/pricing before deciding.

**Rule that never changes:** a backup holds every user's personal data. It
never goes into this repository (it is public), a GitHub Actions artifact or
log (public too), a shared folder, a chat, or an unencrypted laptop disk.

## Today: no backups

GigoMe runs on Supabase's **free plan, which makes no backups**
([Supabase](https://supabase.com/kb/faqs/platform/free-plan-backups)). If the
data is lost (a bad migration, a mistaken delete or `update` in the Table
Editor or SQL Editor, a problem at Supabase, a lost account), there is
nothing to restore from.

### What would be lost

| Lost | What it means |
| --- | --- |
| Logins (`auth.users`) | Every account is gone. Students and employers can log in again with their email, which creates a **new, empty** account |
| Student profiles | Name, degree level, graduation year: asked again on `/welcome` |
| Saved jobs, saved searches, followed companies | Gone for every student |
| Companies | Every employer sets up their company again and waits for **approval again**. Approval history is gone |
| Jobs and how to apply | Every listing is gone. Employers write them again, and each one goes through review again |
| Apply clicks | Employers' "N apply clicks" and students' "Jobs you opened": gone for good |
| Reports and feedback | Open scam reports and every feedback message: gone, including evidence about bad employers |
| Moderation log | Who approved or rejected what, and why: gone |
| Admins | Nobody can open `/admin` until someone adds the admins again in the dashboard |
| Universities added in the dashboard | Only Bocconi comes back (it's in a migration). Any other university and its email domains must be typed in again |
| Terms acceptances, retention settings | Gone |

### What survives anyway

- **The structure:** every table, rule, function and check is in `supabase/migrations/`, and is applied again to a new project.
- **Fixed data that's in migrations:** the areas of Milan, Bocconi, the metro stations.
- **The website:** it is built from GitHub by Cloudflare.
- **Not in any database backup either:** the Supabase project's settings (Site URL, email templates, Brevo SMTP, rate limits, the Turnstile secret). If the whole project is lost, they must be set again by hand. Keep them written down in Bitwarden (`HANDOVER.md` sections 1, 6 and 7).

## Options

| Option | Cost | Effort | What it protects | Privacy |
| --- | --- | --- | --- | --- |
| **A. CSV export by hand** (`HANDOVER.md` section 9, "simplest") | Free | ~20 min each time | Each table's rows, as they were that day. **Not** the logins, so restoring means rebuilding accounts and links by hand | A file per table with personal data: must be encrypted and stored as below |
| **B. Full dump by hand** with the Supabase CLI (`HANDOVER.md` section 9, "complete") | Free | ~30 min each time, once set up | Everything, logins included, restorable into a new project | One file with everything. Needs the database password on the laptop that runs it. Encrypt it at once |
| **C. Automatic dump from GitHub Actions** to private storage | Free (e.g. Cloudflare R2 free tier) | Half a day to build, then nothing | Everything, every night | **Not recommended.** This repository is public: the full database password would sit in its secrets, any workflow change could leak it, and a dump uploaded as an artifact would be public. A third copy of all data would sit with another provider, which the Privacy Notice would have to name |
| **D. Supabase Pro plan** | $25 a month (about €23) for the organisation | 5 minutes: upgrade in the dashboard | Daily backups kept 7 days, restored from the dashboard. Also ends the free plan's pause after a week without activity | The backups stay inside Supabase, in the same project and region (Frankfurt): no new provider. Deleted data stays in backups for up to 7 days: the Privacy Notice should say so |
| **E. Point-in-time recovery** (add-on to Pro) | About $100 a month per 7 days kept | 5 minutes | Restore to any minute in the window: undoes a bad delete without losing the rest of the day | As D |

**Encrypting a dump (A and B):**
- Use [age](https://age-encryption.org) (`age -p file.sql > file.sql.age`, with a long passphrase kept in Bitwarden), or a 7-Zip archive with AES-256 and an encrypted file list.
- Delete the unencrypted file straight away.
- Keep the encrypted file in **one** place that only the team's leads can open.
- Bitwarden attachments need a paid Bitwarden plan.

**Retention applies to backups too.** Delete old dumps: keep the newest
three, and none older than three months. Otherwise a deleted account lives on
in old files, against what the Privacy Notice promises.

## Recommendation

**Test phase** (few users, data easy to re-create):
- **Option B, by hand.** Take a dump:
  - **before merging any pull request with a migration**. This includes the data-protection one, whose daily job deletes data on purpose: a mistake there must be undoable;
  - and once a month.
- Encrypt it at once, store it as above, keep the newest three.
- About 30 minutes a month, and free.
- Option A is the fallback for whoever can't run the CLI.

**Public launch** (real students and employers, data that can't be
re-created):
- **Option D, Supabase Pro.** It is the simplest real protection: no
  passwords on laptops, no new provider, restore from the dashboard, and the
  project stops pausing.
- Add one line to the Privacy Notice: backups are kept 7 days, and deleted
  data disappears from them within 7 days.
- Keep a monthly option B dump as a copy outside Supabase, in case the
  account itself is lost.
- Option E only once a lost day of changes would really hurt.

**Not recommended at any stage:** option C from this public repository.
