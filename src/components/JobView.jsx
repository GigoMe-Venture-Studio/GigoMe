import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import ExampleNotice from './ExampleNotice.jsx';
import ReportJob from './ReportJob.jsx';
import SaveButton from './SaveButton.jsx';
import ShareButton from './ShareButton.jsx';
import {
  CATEGORY_LABEL,
  EXAMPLE_JOB_LABEL,
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
  scheduleLabels,
  websiteHref,
  websiteText
} from '../lib/jobs.js';

// MapLibre is only downloaded when the job's map is about to be seen.
const JobPlaceMap = lazy(() => import('./JobPlaceMap.jsx'));

// The job page itself: used by /jobs/:id and by the employer's "Preview" on
// the job form, so the preview is exactly what students will see. In a
// preview, nothing acts: Save, Share and Report are shown but do nothing,
// and links stay on the page. apply is the "How to apply" panel.
export default function JobView({ job, apply, preview = false }) {
  const company = job.companies;
  const site = websiteHref(company.website);
  const companyName = preview ? <span>{company.name}</span> : <Link to={`/companies/${company.id}`}>{company.name}</Link>;
  // Three parts, in this order: the head (title to facts), "How to apply",
  // then the rest. On phones they stack, so "Apply" is on the first screen;
  // from 900px "How to apply" is the right-hand column (site.css).
  return (
    <article className="detail">
      <div className="detail-head">
        {isExample(job) && (
          <ExampleNotice label={EXAMPLE_JOB_LABEL}>
            It's made up so testers can try GigoMe: {company.name} doesn't exist, and there's nobody to apply to.
          </ExampleNotice>
        )}
        <div className="detail-title-row">
          <h1 className="page-title">{job.title || <span className="muted">(No title yet)</span>}</h1>
          <div className="detail-actions">
            {preview ? (
              <>
                <span className="save-wrap">
                  <button type="button" className="save-btn save-labelled" disabled title="Students can save the job here">
                    <svg className="icon save-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                    <span>Save</span>
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
          {isNew(job) && <span className="tag tag-new">New</span>}
          {job.job_type && <span className="tag">{JOB_TYPE_LABEL[job.job_type]}</span>}
          {job.category && job.category !== 'other' && <span className="tag">{CATEGORY_LABEL[job.category]}</span>}
          <span className={'tag' + (job.italian_level === 'none' ? ' tag-italian-none' : '')}>{ITALIAN_LABEL[job.italian_level]}</span>
          {job.remote && <span className="tag">Remote</span>}
          {scheduleLabels(job).map((w) => <span key={w} className="tag tag-when">{w}</span>)}
        </div>
        <dl className="facts">
          <div><dt>Pay</dt><dd>{payLabel(job)}{payNote(job) && <span className="pay-note">{payNote(job)}</span>}</dd></div>
          <div><dt>Hours</dt><dd className="tnum">{hoursLabel(job)}</dd></div>
          <div>
            <dt>Location</dt>
            <dd>
              {placeLabel(job)}
              {metroLabel(job) && <span className="metro-badge detail-metro">{metroLabel(job)}</span>}
            </dd>
          </div>
          <div><dt>Start</dt><dd>{job.start_date ? dateLabel(job.start_date) : 'Flexible'}</dd></div>
          {languageLabels(job).length > 0 && <div><dt>Languages at work</dt><dd>{languageLabels(job).join(', ')}</dd></div>}
        </dl>
      </div>
      <aside className="detail-apply" aria-label="How to apply">
        <div className="apply">{apply}</div>
      </aside>
      <div className="detail-body">
        <div className="prose-role">
          <h2>About the job</h2>
          {job.description ? (
            <p className="job-text">{job.description}</p>
          ) : (
            <p className="muted">The employer hasn't added a description yet.</p>
          )}
          <p className="muted job-posted">Posted {postedLabel(postedAt(job)).toLowerCase()}.</p>
          {job.latitude != null && job.longitude != null && <JobPlace job={job} />}
          <h2>About {company.name}</h2>
          {company.description ? <p className="job-text">{company.description}</p> : null}
          {site ? (
            <p>
              <a href={site} target="_blank" rel="noopener noreferrer">{websiteText(company.website)}</a>
            </p>
          ) : null}
          {!company.description && !site ? <p className="muted">No company details yet.</p> : null}
          <p>
            {preview ? <span className="link-like">All jobs from {company.name}</span> : <Link to={`/companies/${company.id}`}>All jobs from {company.name}</Link>}
          </p>
        </div>
        {preview ? (
          <div className="report-job"><span className="link-like">Report this job</span></div>
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
      <h2>Where</h2>
      <p className="muted job-place-note">
        {exact ? placeLabel(job) : `${(job.areas && job.areas.name) || placeLabel(job)}: the employer shows only the area, not the exact address.`}
      </p>
      <div ref={spot} className="job-place">
        {near ? (
          <Suspense fallback={<div className="job-map job-map-loading" role="status">Loading the map…</div>}>
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
          {exact ? 'Open in Google Maps' : 'Open the area in Google Maps'}
        </a>
      </p>
    </>
  );
}
