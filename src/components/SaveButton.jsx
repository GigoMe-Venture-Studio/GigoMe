import { useState } from 'react';
import { Link } from 'react-router';
import { setSaved, useSavedJobs } from '../lib/saved.js';

const BOOKMARK = (
  <svg className="icon save-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

// The bookmark on job cards and job pages, for logged-in students. Logged
// out, the same bookmark is a link to log in that comes back to the job (no
// job is saved until they press it again). Company accounts get nothing.
// labelled: also shows "Save" / "Saved" (job pages).
export default function SaveButton({ jobId, title, labelled = false, className = '' }) {
  const saved = useSavedJobs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (saved.loggedOut) {
    return (
      <span className={'save-wrap ' + className}>
        <Link
          className={'save-btn' + (labelled ? ' save-labelled' : '')}
          to={'/login?next=' + encodeURIComponent('/jobs/' + jobId)}
          aria-label={`Log in to save ${title}`}
          title="Log in to save this job"
        >
          {BOOKMARK}
          {labelled && <span>Save</span>}
        </Link>
      </span>
    );
  }
  if (!saved.canSave) return null;
  const on = saved.isSaved(jobId);

  async function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    setError('');
    setError((await setSaved(jobId, !on)) || '');
    setBusy(false);
  }

  return (
    <span className={'save-wrap ' + className}>
      <button
        type="button"
        className={'save-btn' + (on ? ' is-saved' : '') + (labelled ? ' save-labelled' : '')}
        aria-pressed={on}
        aria-label={labelled ? undefined : on ? `Remove ${title} from saved jobs` : `Save ${title}`}
        title={on ? 'Saved: press to remove' : 'Save this job'}
        onClick={onClick}
        disabled={busy}
      >
        {BOOKMARK}
        {labelled && <span>{on ? 'Saved' : 'Save'}</span>}
      </button>
      {error && <span className="err save-err" role="alert">{error}</span>}
    </span>
  );
}
