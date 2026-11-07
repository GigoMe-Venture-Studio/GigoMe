import { Link } from 'react-router';
import { ITALIAN_LABEL, JOB_TYPE_LABEL, hoursLabel, payLabel, placeLabel, postedLabel } from '../lib/jobs.js';

// One job in a list (/jobs and "Newest jobs" on the home page).
export default function JobCard({ job }) {
  return (
    <li>
      <Link className="role-row" to={`/jobs/${job.id}`}>
        <div>
          <div className="role-l1">
            <span className="role-title">{job.title}</span>
            <span className="role-co">{job.companies.name}</span>
            <span className={'tag' + (job.italian_level === 'none' ? ' tag-italian-none' : '')}>
              {ITALIAN_LABEL[job.italian_level]}
            </span>
          </div>
          <div className="role-meta">
            <span>{JOB_TYPE_LABEL[job.job_type]}</span>
            <span className="sep" aria-hidden="true">·</span>
            <span>{placeLabel(job)}</span>
            <span className="sep" aria-hidden="true">·</span>
            <span className="tnum">{hoursLabel(job)}</span>
          </div>
        </div>
        <div className="role-pay">
          <span className="pay">{payLabel(job)}</span>
          <span className="posted tnum">{postedLabel(job.created_at)}</span>
        </div>
      </Link>
    </li>
  );
}
