import { Link } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { useT } from '../lib/useLang.js';

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
  const t = useT();
  const to = (path) => (s) => <Link to={path}>{s}</Link>;
  const strong = (s) => <strong>{s}</strong>;
  return (
    <PageShell className="info-main">
      <article className="info">
        <h1>{t('safety.title')}</h1>
        <p className="lead">{t('safety.lead')}</p>

        <section aria-labelledby="checks-title">
          <h2 id="checks-title">{t('safety.checksTitle')}</h2>
          <ul className="info-list">
            <li>{t('safety.check1')}</li>
            <li>{t('safety.check2')}</li>
            <li>{t('safety.check3')}</li>
          </ul>
        </section>

        <section aria-labelledby="limits-title">
          <h2 id="limits-title">{t('safety.limitsTitle')}</h2>
          <ul className="info-list">
            <li>{t('safety.limit1', { link: to('/terms#section-21') })}</li>
            <li>{t('safety.limit2', { link: to('/terms#section-26') })}</li>
            <li>{t('safety.limit3')}</li>
          </ul>
        </section>

        <section aria-labelledby="tips-title">
          <h2 id="tips-title">{t('safety.tipsTitle')}</h2>
          <ul className="info-list">
            <li>{t('safety.tip1', { strong })}</li>
            <li>{t('safety.tip2', { strong })}</li>
            <li>{t('safety.tip3', { strong })}</li>
            <li>{t('safety.tip4', { strong, link: to('/terms#section-11') })}</li>
            <li>{t('safety.tip5', { strong })}</li>
            <li>{t('safety.tip6', { strong })}</li>
            <li>{t('safety.tip7', { strong })}</li>
            <li>
              {t('safety.tip8', {
                strong,
                link: (s) => (
                  <a href={PERMIT_SOURCE} target="_blank" rel="noopener noreferrer">
                    {s}
                  </a>
                )
              })}
            </li>
          </ul>
        </section>

        <section aria-labelledby="wrong-title">
          <h2 id="wrong-title">{t('safety.wrongTitle')}</h2>
          <ul className="info-list">
            <li>{t('safety.wrong1')}</li>
            <li>{t('safety.wrong2', { email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> })}</li>
            <li>{t('safety.wrong3', { strong })}</li>
          </ul>
        </section>

        <p className="info-more">{t('safety.more', { link: to('/how-it-works') })}</p>
      </article>
    </PageShell>
  );
}
