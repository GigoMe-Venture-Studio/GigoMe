import { Link } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import Faq from '../components/Faq.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { useT } from '../lib/useLang.js';

// /how-it-works: how GigoMe works for students and employers, as questions
// that open. Every answer must match what the app does today and the Terms
// and Privacy Notice (docs/legal/published/); the legal person reviews this
// text. Linked from the footer and the home page's "How it works".
const PRIVACY_EMAIL = 'privacy@gigome.org';

export default function HowItWorks() {
  const t = useT();
  const mail = (address) => <a href={`mailto:${address}`}>{address}</a>;
  const email = mail(CONTACT_EMAIL);
  const to = (path) => (s) => <Link to={path}>{s}</Link>;
  return (
    <PageShell className="info-main">
      <article className="info">
        <h1>{t('how.title')}</h1>
        <p className="lead">{t('how.lead')}</p>
        <p className="info-aside">{t('how.aside', { link: to('/safety') })}</p>

        <section aria-labelledby="students-title">
          <h2 id="students-title">{t('how.studentsTitle')}</h2>
          <Faq id="find-jobs" question={t('how.findQ')}>
            <p>{t('how.findA1', { link: to('/jobs') })}</p>
            <p>{t('how.findA2')}</p>
          </Faq>
          <Faq id="university-email" question={t('how.emailQ')}>
            <p>{t('how.emailA1', { link: to('/login') })}</p>
            <p>{t('how.emailA2', { email })}</p>
          </Faq>
          <Faq id="apply" question={t('how.applyQ')}>
            <p>{t('how.applyA1')}</p>
            <p>{t('how.applyA2')}</p>
          </Faq>
          <Faq id="what-gigome-sees" question={t('how.seesQ')}>
            <p>{t('how.seesA1', { link: to('/privacy') })}</p>
            <p>{t('how.seesA2')}</p>
            <p>{t('how.seesA3')}</p>
          </Faq>
          <Faq id="delete-account" question={t('how.deleteQ')}>
            <p>{t('how.deleteA1', { link: to('/account') })}</p>
            <p>{t('how.deleteA2', { email: mail(PRIVACY_EMAIL) })}</p>
          </Faq>
        </section>

        <section aria-labelledby="employers-title">
          <h2 id="employers-title">{t('how.employersTitle')}</h2>
          <Faq id="employer-signup" question={t('how.signupQ')}>
            <p>{t('how.signupA1', { link: to('/employers') })}</p>
            <p>{t('how.signupA2')}</p>
          </Faq>
          <Faq id="company-review" question={t('how.reviewQ')}>
            <p>{t('how.reviewA1')}</p>
            <p>{t('how.reviewA2')}</p>
          </Faq>
          <Faq id="post-job" question={t('how.postQ')}>
            <p>{t('how.postA1')}</p>
            <p>{t('how.postA2')}</p>
            <p>{t('how.postA3')}</p>
          </Faq>
          <Faq id="job-review" question={t('how.jobReviewQ')}>
            <p>{t('how.jobReviewA1')}</p>
            <p>{t('how.jobReviewA2')}</p>
          </Faq>
          <Faq id="students-contact" question={t('how.contactQ')}>
            <p>{t('how.contactA1')}</p>
            <p>{t('how.contactA2', { link: to('/terms#section-13') })}</p>
          </Faq>
        </section>

        <p className="info-more">
          {t('how.more', { email, safety: to('/safety'), terms: to('/terms'), privacy: to('/privacy') })}
        </p>
      </article>
    </PageShell>
  );
}
