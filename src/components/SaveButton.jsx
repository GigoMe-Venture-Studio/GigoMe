import { useState } from 'react';
import { setSaved, useSavedJobs } from '../lib/saved.js';

// The bookmark on job cards and job pages. Only for logged-in students.
// labelled: also shows "Save" / "Saved" (job pages).
export default function SaveButton({ jobId, title, labelled = false, className = '' }) {
  const saved = useSavedJobs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
        <svg className="icon save-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        {labelled && <span>{on ? 'Saved' : 'Save'}</span>}
      </button>
      {error && <span className="err save-err" role="alert">{error}</span>}
    </span>
  );
}
