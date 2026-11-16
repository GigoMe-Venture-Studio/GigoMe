import { Link } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import Faq from '../components/Faq.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';

// /how-it-works: how GigoMe works for students and employers, as questions
// that open. Every answer must match what the app does today and the Terms
// and Privacy Notice (docs/legal/published/); the legal person reviews this
// text. Linked from the footer and the home page's "How it works".
const PRIVACY_EMAIL = 'privacy@gigome.org';

export default function HowItWorks() {
  return (
    <PageShell className="info-main">
      <article className="info">
        <h1>How GigoMe works</h1>
        <p className="lead">
          GigoMe lists paid part-time jobs and gigs in Milan that you can do in English. You find a job here, then
          contact the employer directly: GigoMe isn't part of the application or the work.
        </p>
        <p className="info-aside">
          Some jobs mean meeting an employer at an address. <Link to="/safety">Read Staying safe</Link>.
        </p>

        <section aria-labelledby="students-title">
          <h2 id="students-title">For students</h2>
          <Faq id="find-jobs" question="How do I find jobs?">
            <p>
              Browse the list or the map on the <Link to="/jobs">Jobs</Link> page: you don't need an account for that.
              Filter by area, category, when the work happens, pay, hours, languages and how much Italian you need.
            </p>
            <p>
              Log in to save jobs and searches and to follow companies. They stay on GigoMe: we don't email you about
              them.
            </p>
          </Faq>
          <Faq id="university-email" question="Why do I need a university email?">
            <p>
              GigoMe is for university students, so student accounts are open to email addresses of the universities on
              our list. When you log in, we send a 6-digit code to that address; there's no password.
            </p>
            <p>
              The code only shows that you can read that inbox. It doesn't check that you're enrolled or that you're
              allowed to work in Italy. Is your university missing? Write to{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>
          </Faq>
          <Faq id="apply" question='What happens when I press "Apply"?'>
            <p>
              GigoMe shows you how to apply for that job, the employer's application page or email address, and opens
              it. You then contact the employer directly, outside GigoMe. GigoMe doesn't send them your profile, your CV
              or anything else, and pressing Apply isn't an application.
            </p>
            <p>
              GigoMe records that your account pressed Apply on that job, and when. You see it under "Jobs you opened"
              on your Saved jobs page. The employer only sees how many times Apply was pressed on their job, never by
              whom. Within 180 days, the record no longer shows who pressed it.
            </p>
          </Faq>
          <Faq id="what-gigome-sees" question="What does GigoMe see, and what doesn't it?">
            <p>
              GigoMe sees your email, university, name, degree and graduation year; the jobs you save, your saved
              searches and the companies you follow; which jobs you pressed Apply on; and any reports or feedback you
              send. It also keeps the technical records needed to run the site. The{' '}
              <Link to="/privacy">Privacy Notice</Link> has the full list.
            </p>
            <p>
              GigoMe doesn't see your applications, your CV or your messages to employers, whether you had an
              interview or got the job, or anything you agree with an employer.
            </p>
            <p>Employers can't see or search your profile. They never get your name or email from GigoMe.</p>
          </Faq>
          <Faq id="delete-account" question="How do I delete my account?">
            <p>
              Open your <Link to="/account">Account</Link> page (your name in the header) and press "Delete my
              account", then type DELETE. Your account is deleted straight away. You can press "Download my data"
              first to keep a copy.
            </p>
            <p>
              Some records stay without your name, such as that Apply was pressed on a job, or a report you sent.
              Anything you sent to an employer stays with them. You can also write to{' '}
              <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
            </p>
          </Faq>
        </section>

        <section aria-labelledby="employers-title">
          <h2 id="employers-title">For employers</h2>
          <Faq id="employer-signup" question="How do I sign up?">
            <p>
              Go to <Link to="/employers">For employers</Link> and log in with your work email. We send you a 6-digit
              code; there's no password. University email addresses are for student accounts.
            </p>
            <p>
              Then tell us about your company: its name, website and a short description, and a contact email that only
              the GigoMe team sees. Tick the box to accept the Terms. Listing jobs is free.
            </p>
          </Faq>
          <Faq id="company-review" question="How does the company review work?">
            <p>
              A person at GigoMe reviews every new company before its jobs can go live, usually within 2 working days.
              Your dashboard shows the status: In review, Approved or Not approved. We don't email you when it changes.
            </p>
            <p>While you wait, you can write your jobs as drafts. Only you can see them.</p>
          </Faq>
          <Faq id="post-job" question="How do I post a job?">
            <p>
              On your dashboard, press "New job". GigoMe lists paid part-time jobs and gigs only: no internships and no
              unpaid work.
            </p>
            <p>
              Say what the work is, where and when it happens, the hours, the pay (per hour, per month or per project)
              and how students apply: a link to your application page or an email address.
            </p>
            <p>
              A job is shown for up to 60 days. While it's live, and up to 14 days after it ends, you can extend it by
              60 days without a new review.
            </p>
          </Faq>
          <Faq id="job-review" question="Is every job reviewed before it's published?">
            <p>
              Yes. Once your company is approved, submit each job: a person at GigoMe reviews it before students see it,
              usually within 2 working days.
            </p>
            <p>
              We check that the role is clearly described, that pay and hours are stated, that nothing is asked of
              students up front (no fees, deposits or documents), and that nothing in it looks discriminatory or
              unlawful. If something needs fixing, we ask for changes with a note on your dashboard. Editing a live job
              sends it back to review.
            </p>
          </Faq>
          <Faq id="students-contact" question="How do students contact me?">
            <p>
              Students who press Apply see the application link or email address you gave for that job, and contact you
              directly. GigoMe doesn't forward applications or CVs and isn't part of the hiring.
            </p>
            <p>
              You handle applications yourself, and the written terms and other obligations of any work you agree
              (<Link to="/terms#section-13">Terms</Link>, sections 9 to 11). You can't see student profiles. Your dashboard shows
              how many times Apply was pressed on each job, never by whom.
            </p>
          </Faq>
        </section>

        <p className="info-more">
          More questions? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also{' '}
          <Link to="/safety">Staying safe</Link>, the <Link to="/terms">Terms</Link> and the{' '}
          <Link to="/privacy">Privacy Notice</Link>.
        </p>
      </article>
    </PageShell>
  );
}
