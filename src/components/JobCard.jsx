import { Link } from 'react-router';
import {
  CATEGORY_LABEL,
  ITALIAN_LABEL,
  JOB_TYPE_LABEL,
  hoursLabel,
  isNew,
  metroLabel,
  payLabel,
  placeLabel,
  postedLabel
} from '../lib/jobs.js';

// One job in a list (/jobs, "Newest jobs" on the home page, company pages).
export default function JobCard({ job }) {
  const metro = metroLabel(job);
  return (
    <li>
      <Link className="role-row" to={`/jobs/${job.id}`}>
        <div>
          <div className="role-l1">
            <span className="role-title">{job.title}</span>
            {job.companies && <span className="role-co">{job.companies.name}</span>}
            {isNew(job) && <span className="tag tag-new">New</span>}
            <span className={'tag' + (job.italian_level === 'none' ? ' tag-italian-none' : '')}>
              {ITALIAN_LABEL[job.italian_level]}
            </span>
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
          </div>
          {metro && <div className="role-metro"><span className="metro-badge">{metro}</span></div>}
        </div>
        <div className="role-pay">
          <span className="pay">{payLabel(job)}</span>
          <span className="posted tnum">{postedLabel(job.created_at)}</span>
        </div>
      </Link>
    </li>
  );
}
