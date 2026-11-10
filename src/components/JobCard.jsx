import { Link } from 'react-router';
import SaveButton from './SaveButton.jsx';
import {
  CATEGORY_LABEL,
  ITALIAN_LABEL,
  JOB_TYPE_LABEL,
  hoursLabel,
  isNew,
  metroLabel,
  payLabel,
  placeLabel,
  postedLabel,
  scheduleLabels
} from '../lib/jobs.js';

// One job in a list (/jobs, "Newest jobs" on the home page, company pages,
// saved jobs). The save button sits next to the link, not inside it.
// distance: "1.2 km away" when the person chose "Use my location" (worked
// out on their device), else null.
// offerLogin false: no logged-out Save bookmark (see SaveButton).
export default function JobCard({ job, distance = null, offerLogin = true }) {
  const metro = metroLabel(job);
  const when = scheduleLabels(job);
  return (
    <li className="job-card">
      <Link className="role-row" to={`/jobs/${job.id}`}>
        <div>
          <div className="role-l1">
            <span className="role-title">{job.title}</span>
            {job.companies && <span className="role-co">{job.companies.name}</span>}
            {isNew(job) && <span className="tag tag-new">New</span>}
            <span className={'tag' + (job.italian_level === 'none' ? ' tag-italian-none' : '')}>
              {ITALIAN_LABEL[job.italian_level]}
            </span>
            {when.map((w) => <span key={w} className="tag tag-when">{w}</span>)}
          </div>
          <div className="role-meta">
            <span>{JOB_TYPE_LABEL[job.job_type]}</span>
            {job.category && job.category !== 'other' && (
              <>
                <span className="sep" aria-hidden="true">·</span>
                <span>{CATEGORY_LABEL[job.category]}</span>
              </>
            )}
            <span className="sep" aria-hidden="true">·</span>
            <span>{placeLabel(job)}</span>
            <span className="sep" aria-hidden="true">·</span>
            <span className="tnum">{hoursLabel(job)}</span>
            {distance && (
              <>
                <span className="sep" aria-hidden="true">·</span>
                <span className="tnum job-distance">{distance}</span>
              </>
            )}
          </div>
          {metro && <div className="role-metro"><span className="metro-badge">{metro}</span></div>}
        </div>
        <div className="role-pay">
          <span className="pay">{payLabel(job)}</span>
          <span className="posted tnum">{postedLabel(job.created_at)}</span>
        </div>
      </Link>
      <SaveButton jobId={job.id} title={job.title} className="card-save" offerLogin={offerLogin} />
    </li>
  );
}
