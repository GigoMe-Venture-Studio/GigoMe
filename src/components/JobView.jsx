import JobText from './JobText.jsx';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import ExampleTag from './ExampleTag.jsx';
import ReportJob from './ReportJob.jsx';
import SaveButton from './SaveButton.jsx';
import ShareButton from './ShareButton.jsx';
import {
  CATEGORY_LABEL,
  ITALIAN_LABEL,
  JOB_TYPE_LABEL,
  dateLabel,
  googleMapsHref,
  hoursLabel,
  isExample,
  isNew,
  languageLabels,
  metroLabel,
  payLabel,
  payNote,
  placeLabel,
  postedAt,
  postedLabel,
  scheduleItems,
  websiteHref,
  websiteText
} from '../lib/jobs.js';
import { useT } from '../lib/useLang.js';

// MapLibre is only downloaded when the job's map is about to be seen.
const JobPlaceMap = lazy(() => import('./JobPlaceMap.jsx'));

// The job page itself: used by /jobs/:id and by the employer's "Preview" on
// the job form, so the preview is exactly what students will see. In a
// preview, nothing acts: Save, Share and Report are shown but do nothing,
// and links stay on the page. apply is the "How to apply" panel.
export default function JobView({ job, apply, preview = false }) {
  const t = useT();
  const company = job.companies;
  const site = websiteHref(company.website);
  const companyName = preview ? <span>{company.name}</span> : <Link to={`/companies/${company.id}`}>{company.name}</Link>;
  // Three parts, in this order: the head (title to facts), "How to apply",
  // then the rest. On phones they stack, so "Apply" is on the first screen;
  // from 900px "How to apply" is the right-hand column (site.css).
  return (
    <article className="detail">
      <div className="detail-head">
        <div className="detail-title-row">
          <h1 className="page-title">{job.title || <span className="muted">{t('jobPage.noTitle')}</span>}</h1>
          <div className="detail-actions">
            {preview ? (
              <>
                <span className="save-wrap">
                  <button type="button" className="save-btn save-labelled" disabled title={t('jobPage.previewSaveTitle')}>
                    <svg className="icon save-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                    <span>{t('save.save')}</span>
                  </button>
                </span>
                <ShareButton title={job.title} url="" disabled />
              </>
            ) : (
              <>
                <SaveButton jobId={job.id} title={job.title} labelled />
                <ShareButton title={job.title} url={`${window.location.origin}/jobs/${job.id}`} />
              </>
            )}
          </div>
        </div>
        <p className="detail-co">{companyName}</p>
        <div className="tags">
          {isExample(job) && <ExampleTag />}
          {isNew(job) && <span className="tag tag-new">{t('jobCard.new')}</span>}
          {JOB_TYPE_LABEL[job.job_type] && <span className="tag">{JOB_TYPE_LABEL[job.job_type]}</span>}
          {job.category && job.category !== 'other' && <span className="tag">{CATEGORY_LABEL[job.category]}</span>}
          <span className={'tag' + (job.italian_level === 'none' ? ' tag-italian-none' : '')}>{ITALIAN_LABEL[job.italian_level]}</span>
          {job.remote && <span className="tag">{t('place.remote')}</span>}
          {scheduleItems(job).map((w) => (
            <span key={w.value} className="tag tag-when tag-when-hours">
              {w.label}<span className="tag-when-def"><span className="sr-only">: </span>{w.hours}</span>
            </span>
          ))}
        </div>
        <dl className="facts">
          <div><dt>{t('jobPage.pay')}</dt><dd>{payLabel(job)}{payNote(job) && <span className="pay-note">{payNote(job)}</span>}</dd></div>
          <div><dt>{t('jobPage.hours')}</dt><dd className="tnum">{hoursLabel(job)}</dd></div>
          <div>
            <dt>{t('jobPage.location')}</dt>
            <dd>
              {placeLabel(job)}
              {metroLabel(job) && <span className="metro-badge detail-metro">{metroLabel(job)}</span>}
            </dd>
          </div>
          <div><dt>{t('jobPage.start')}</dt><dd>{job.start_date ? dateLabel(job.start_date) : t('jobPage.flexible')}</dd></div>
          {languageLabels(job).length > 0 && <div><dt>{t('jobs.languages')}</dt><dd>{languageLabels(job).join(', ')}</dd></div>}
        </dl>
      </div>
      <aside className="detail-apply" aria-label={t('jobPage.howToApply')}>
        <div className="apply">
          {apply}
          {/* On-site jobs only, at the bottom of the box: it never pushes "Apply" down. */}
          {!job.remote && (
            <p className="apply-safety">
              {t('jobPage.safety', { link: (s) => (preview ? <span className="link-like">{s}</span> : <Link to="/safety">{s}</Link>) })}
            </p>
          )}
        </div>
      </aside>
      <div className="detail-body">
        <div className="prose-role">
          <h2>{t('jobPage.aboutJob')}</h2>
          {job.description ? (
            <JobText text={job.description} />
          ) : (
            <p className="muted">{t('jobPage.noDescription')}</p>
          )}
          <p className="muted job-posted">{t('jobPage.posted', { when: postedLabel(postedAt(job)).toLowerCase() })}</p>
          {job.latitude != null && job.longitude != null && <JobPlace job={job} />}
          <h2>{t('jobPage.aboutCompany', { name: company.name })}</h2>
          {company.description ? <JobText text={company.description} /> : null}
          {site ? (
            <p>
              <a href={site} target="_blank" rel="noopener noreferrer">{websiteText(company.website)}</a>
            </p>
          ) : null}
          {!company.description && !site ? <p className="muted">{t('jobPage.noCompanyDetails')}</p> : null}
          <p>
            {preview ? <span className="link-like">{t('jobPage.allFromCompany', { name: company.name })}</span> : <Link to={`/companies/${company.id}`}>{t('jobPage.allFromCompany', { name: company.name })}</Link>}
          </p>
        </div>
        {preview ? (
          <div className="report-job"><span className="link-like">{t('report.title')}</span></div>
        ) : (
          <ReportJob jobId={job.id} />
        )}
      </div>
    </article>
  );
}

// "Where": the small map (loaded when it is about to scroll into view) and a
// link to Google Maps that only opens when clicked.
function JobPlace({ job }) {
  const t = useT();
  const exact = Boolean(job.show_exact_location);
  const station = exact && metroLabel(job) && job.metro_stations && job.metro_stations.latitude != null ? job.metro_stations : null;
  const spot = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near || !spot.current) return undefined;
    if (!('IntersectionObserver' in window)) {
      setNear(true);
      return undefined;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '300px' });
    io.observe(spot.current);
    return () => io.disconnect();
  }, [near]);
  return (
    <>
      <h2>{t('jobPage.where')}</h2>
      <p className="muted job-place-note">
        {exact ? placeLabel(job) : t('jobPage.areaOnly', { area: (job.areas && job.areas.name) || placeLabel(job) })}
      </p>
      <div ref={spot} className="job-place">
        {near ? (
          <Suspense fallback={<div className="job-map job-map-loading" role="status">{t('map.loading')}</div>}>
            <JobPlaceMap
              key={`${job.longitude},${job.latitude},${exact},${station ? station.name : ''}`}
              point={[job.longitude, job.latitude]}
              exact={exact}
              station={station}
              title={job.title}
            />
          </Suspense>
        ) : (
          <div className="job-map job-map-loading" aria-hidden="true" />
        )}
      </div>
      <p className="job-place-link">
        <a href={googleMapsHref(job)} target="_blank" rel="noopener noreferrer">
          {exact ? t('jobPage.openGoogle') : t('jobPage.openAreaGoogle')}
        </a>
      </p>
    </>
  );
}
