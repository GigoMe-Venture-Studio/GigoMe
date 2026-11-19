import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import ConfigError from '../components/ConfigError.jsx';
import ApplyDemo from '../components/ApplyDemo.jsx';
import JobView from '../components/JobView.jsx';
import { supabase } from '../lib/supabase.js';
import { useSession } from '../lib/useSession.js';
import { fetchProfile } from '../lib/auth.js';
import { CONTACT_EMAIL } from '../lib/contact.js';
import { fetchJob, isExample, revealContact } from '../lib/jobs.js';
import { mailtoHref } from '../lib/links.js';
import { jobPostingData, shortText, useJsonLd, usePageMeta } from '../lib/seo.js';
import { t as tr } from '../lib/i18n.js';
import { useT } from '../lib/useLang.js';

export default function JobDetail() {
  const t = useT();
  return (
    <PageShell className="jobs-main">
      {supabase ? <JobPage /> : <ConfigError title={t('jobPage.configError')} />}
    </PageShell>
  );
}

function BackLink() {
  const t = useT();
  return (
    <Link className="back" to="/jobs">
      <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
      {t('jobPage.allJobs')}
    </Link>
  );
}

function JobPage() {
  const t = useT();
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading', job: null });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', job: null });
    fetchJob(id)
      .then((job) => active && setState({ status: job ? 'ready' : 'missing', job }))
      .catch(() => active && setState({ status: 'error', job: null }));
    return () => {
      active = false;
    };
  }, [id, retry]);

  // Title, description and schema.org JobPosting data for search engines.
  // Example listings are never indexed and get no JobPosting data, so they
  // can't turn up in search results or Google's job listings.
  const ready = state.status === 'ready' ? state.job : null;
  const example = Boolean(ready && isExample(ready));
  usePageMeta(
    ready
      ? {
          title: t('jobPage.metaTitle', { title: ready.title, company: ready.companies.name }),
          description: shortText(t('jobPage.metaDescription', { title: ready.title, company: ready.companies.name, description: ready.description || '' })),
          index: !example
        }
      : state.status === 'missing'
        ? { title: t('jobPage.missingTitle'), index: false }
        : null
  );
  useJsonLd(ready && !example ? jobPostingData(ready) : null);

  if (state.status === 'loading') return <p className="muted">{t('jobPage.loading')}</p>;
  if (state.status === 'error') {
    return (
      <div className="empty-state page-empty" role="alert">
        <BackLink />
        <p><strong>{t('jobPage.loadError')}</strong></p>
        <p className="muted">{t('jobs.checkConnection')}</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRetry((n) => n + 1)}>{t('common.tryAgain')}</button>
      </div>
    );
  }
  if (state.status === 'missing') {
    return (
      <div className="empty-state page-empty">
        <BackLink />
        <h1 className="page-title">{t('jobPage.missingTitle')}</h1>
        <p className="muted">{t('jobPage.missingText')}</p>
        <Link className="btn btn-primary" to="/jobs">{t('jobPage.seeAll')}</Link>
      </div>
    );
  }

  const job = state.job;
  return (
    <>
      <BackLink />
      <JobView job={job} apply={<HowToApply jobId={job.id} jobTitle={job.title} demoJob={isExample(job) ? job : null} />} />
    </>
  );
}

// The email students send from the "Apply" button (null unless the address
// is plain, so nothing else can ride along in the link). The subject is in
// the site's language: the student writes the email in it too.
function mailtoFor(email, title) {
  return mailtoHref(email, tr('jobPage.mailSubject', { title }));
}

// demoJob: the job, when it's an example listing (made up for testers).
// Everything looks as on a real job until a student presses "Apply", which
// then opens a short demo of the real step (ApplyDemo.jsx) instead: nothing
// opens, the database isn't asked (it would refuse) and no apply click is
// counted.
function HowToApply({ jobId, jobTitle, demoJob = null }) {
  const t = useT();
  const example = Boolean(demoJob);
  const { session, loading } = useSession();
  const userId = session ? session.user.id : null;
  const [accountType, setAccountType] = useState(null);
  const [reveal, setReveal] = useState({ status: 'idle' });
  const [demo, setDemo] = useState(false);
  const applyButton = useRef(null);

  useEffect(() => {
    if (!userId) {
      setAccountType(null);
      return undefined;
    }
    let active = true;
    fetchProfile(userId)
      .then((p) => active && setAccountType((p && p.account_type) || 'student'))
      .catch(() => active && setAccountType('student')); // the database checks again anyway
    return () => {
      active = false;
    };
  }, [userId]);

  // Nothing below this box may move when the login state arrives (on phones
  // the map and the description are under it). While it loads, the box holds
  // the logged-out content, invisible, so it has its usual height from the
  // first frame; afterwards it keeps at least that height (a student's or a
  // company's content is a little shorter) until the screen width changes.
  const settling = loading || Boolean(userId && !accountType);
  const body = useRef(null);
  const measuredAt = useRef(0);
  const [minHeight, setMinHeight] = useState(0);
  useLayoutEffect(() => {
    if (settling && body.current) {
      measuredAt.current = window.innerWidth;
      setMinHeight(body.current.offsetHeight);
    }
  }, [settling]);
  useEffect(() => {
    // Width only: phones change the height while scrolling (address bar).
    const onResize = () => window.innerWidth !== measuredAt.current && setMinHeight(0);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const frame = (content) => (
    <div className="apply-body" ref={body} style={minHeight ? { minHeight } : undefined}>{content}</div>
  );

  if (settling) {
    return frame(
      <>
        <p className="muted apply-loading">{t('common.loading')}</p>
        <div className="apply-sizer" aria-hidden="true">
          <span className="btn btn-primary">{t('jobPage.loginToApply')}</span>
          <p className="apply-note">{t('jobPage.loginNote')}</p>
        </div>
      </>
    );
  }

  if (!session) {
    return frame(
      <>
        <Link className="btn btn-primary" to={`/login?next=${encodeURIComponent('/jobs/' + jobId)}`}>
          {t('jobPage.loginToApply')}
        </Link>
        <p className="apply-note">{t('jobPage.loginNote')}</p>
      </>
    );
  }

  if (accountType === 'company') {
    return frame(<p className="apply-note apply-company">{t('jobPage.companyAccount')}</p>);
  }

  // Called only when the student presses "Apply": each call counts an apply
  // click. The new tab is opened right away, while the browser still treats
  // it as the student's click: a tab opened after waiting for the database is
  // blocked by Safari and most phones. It's pointed at the application page
  // once that's known, or closed again for an email-only job.
  async function onApply() {
    if (example) {
      setDemo(true);
      return;
    }
    let tab = null;
    try {
      tab = window.open('', '_blank');
    } catch {
      tab = null;
    }
    if (tab) {
      try {
        tab.opener = null;
        tab.document.title = t('jobPage.opening');
        tab.document.body.textContent = t('jobPage.openingPage');
      } catch {
        /* the tab still works without the message */
      }
    }
    setReveal({ status: 'busy' });
    const result = await revealContact(jobId);
    if (result.error) {
      if (tab) tab.close();
      setReveal({ status: 'error', message: result.error });
      return;
    }
    let opened = 'none';
    if (result.url) {
      if (tab) {
        tab.location.href = result.url;
        opened = 'tab';
      } else {
        window.open(result.url, '_blank', 'noopener,noreferrer');
        opened = 'maybe';
      }
    } else {
      if (tab) tab.close();
      const mailto = mailtoFor(result.email, jobTitle);
      if (mailto) {
        window.location.href = mailto;
        opened = 'mail';
      }
    }
    setReveal({ status: 'done', ...result, opened });
  }

  if (reveal.status === 'done') {
    if (!reveal.url && !reveal.email) {
      return frame(
        <p className="apply-note">
          {t('jobPage.noContact', { email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> })}
        </p>
      );
    }
    return frame(
      <div className="apply-contact">
        <p className="apply-heading">{t('jobPage.howToApply')}</p>
        <p className="apply-note apply-opened" role="status">
          {reveal.url
            ? t('jobPage.openedTab')
            : reveal.opened === 'mail'
              ? t('jobPage.openedMail')
              : t('jobPage.writeToApply')}
        </p>
        {reveal.url && (
          <a className="btn btn-primary" href={reveal.url} target="_blank" rel="noopener noreferrer">
            {t('jobPage.openApplication')}
          </a>
        )}
        {reveal.email && (
          <p>
            {t('jobPage.email')}{' '}
            {mailtoFor(reveal.email, jobTitle) ? (
              <a className="apply-email" href={mailtoFor(reveal.email, jobTitle)}>{reveal.email}</a>
            ) : (
              <span className="apply-email">{reveal.email}</span>
            )}
          </p>
        )}
        <p className="apply-note">{t('jobPage.straightToEmployer')}</p>
      </div>
    );
  }

  return frame(
    <>
      <button ref={applyButton} type="button" className="btn btn-primary" onClick={onApply} disabled={reveal.status === 'busy'}>
        {reveal.status === 'busy' ? t('jobPage.opening') : t('jobPage.apply')}
      </button>
      {reveal.status === 'error' && <p className="err" role="alert">{reveal.message}</p>}
      <p className="apply-note">
        {example ? t('jobPage.exampleNote') : t('jobPage.straightToEmployer')}
      </p>
      {example && (
        <ApplyDemo
          open={demo}
          job={demoJob}
          onClose={() => {
            setDemo(false);
            if (applyButton.current) applyButton.current.focus();
          }}
        />
      )}
    </>
  );
}
