import { Link } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';

// /safety ("Staying safe"): what GigoMe checks, just as clearly what it
// can't (Terms 15.2 and 19), tips for meeting an employer, and what to do if
// something's wrong. Never call employers "verified" or jobs "safe". Linked
// from the footer, /how-it-works and every on-site job page. The legal person
// reviews this text.
// Links to Terms clauses use the Terms page's anchors, which count every
// heading: clause 8 is #section-11, 15 is #section-21, 19 is #section-26
// (src/legal/terms.json; checked in info-pages.test.js).
// An official source for work-hour limits on residence permits: a link only,
// GigoMe gives no immigration advice (Terms 3.4).
const PERMIT_SOURCE = 'https://www.integrazionemigranti.gov.it/';

export default function Safety() {
  return (
    <PageShell className="info-main">
      <article className="info">
        <h1>Staying safe</h1>
        <p className="lead">
          Some jobs mean meeting an employer at an address you don't know. Here's what GigoMe checks, what it can't,
          and how to look after yourself.
        </p>

        <section aria-labelledby="checks-title">
          <h2 id="checks-title">What GigoMe checks</h2>
          <ul className="info-list">
            <li>
              Every company is reviewed by a person at GigoMe before its jobs can go live. We compare its login email,
              website and description.
            </li>
            <li>
              Every job is reviewed by a person before students see it. We check that the role is clearly described,
              that pay and hours are stated, that nothing is asked of students up front, and that nothing in it looks
              discriminatory or unlawful.
            </li>
            <li>Every report is read by a person. We can take a job down, or remove a company and all its jobs.</li>
          </ul>
        </section>

        <section aria-labelledby="limits-title">
          <h2 id="limits-title">What GigoMe can't do</h2>
          <ul className="info-list">
            <li>
              A review checks what the employer tells us. It can't verify every employer or show that every listing is
              genuine or lawful (<Link to="/terms#section-21">Terms, section 15.2</Link>).
            </li>
            <li>
              GigoMe isn't part of the work. It doesn't supervise any job, isn't a party to what you agree with an
              employer, and can't guarantee pay or how anyone behaves (<Link to="/terms#section-26">Terms, section
              19</Link>).
            </li>
            <li>So follow the tips below for every job, even one that looks fine.</li>
          </ul>
        </section>

        <section aria-labelledby="tips-title">
          <h2 id="tips-title">Tips</h2>
          <ul className="info-list">
            <li>
              <strong>Never pay to get a job.</strong> No registration fees, deposits, training you pay for or kits you
              must buy. If anyone asks, stop and report the job.
            </li>
            <li>
              <strong>Look the business up before you go:</strong> its website, its reviews and the address on a map.
              Check that the name and the place match the listing.
            </li>
            <li>
              <strong>Meeting at an address for the first time?</strong> Tell someone where you're going and when you'll
              be back, and go during the business's opening hours.
            </li>
            <li>
              <strong>Get the essential terms in writing before you start:</strong> what you'll do, the hours, the
              place, the pay and the type of contract (<Link to="/terms#section-11">Terms, section 8.1</Link>).
            </li>
            <li>
              <strong>Unpaid "trial shifts" doing real work are a red flag.</strong> Work should be paid.
            </li>
            <li>
              <strong>Never share passwords or login codes.</strong> GigoMe never asks for your login code.
            </li>
            <li>
              <strong>Keep your bank details to yourself until you have the written terms of a real job.</strong> An
              employer needs your bank account only to pay you, and never needs your card number or PIN.
            </li>
            <li>
              <strong>From outside the EU?</strong> Check how many hours your residence permit lets you work on an
              official source, such as the{' '}
              <a href={PERMIT_SOURCE} target="_blank" rel="noopener noreferrer">Italian government's portal for migrants</a>,
              or ask your university's international office.
            </li>
          </ul>
        </section>

        <section aria-labelledby="wrong-title">
          <h2 id="wrong-title">If something's wrong</h2>
          <ul className="info-list">
            <li>
              On the job's page, press "Report this job" (you need to be logged in). A person at GigoMe reads every
              report.
            </li>
            <li>
              Or write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </li>
            <li>
              <strong>In an emergency, call 112.</strong> It's free.
            </li>
          </ul>
        </section>

        <p className="info-more">
          See also <Link to="/how-it-works">How GigoMe works</Link>.
        </p>
      </article>
    </PageShell>
  );
}
