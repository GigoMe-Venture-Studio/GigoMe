import { useState } from 'react';
import { Link } from 'react-router';
import { useSession } from '../lib/useSession.js';
import { REPORT_DETAILS_MAX, REPORT_REASONS, reportJob } from '../lib/reports.js';

// "Report this job" at the bottom of a job page.
export default function ReportJob({ jobId }) {
  const { session, loading } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [state, setState] = useState({ status: 'idle', message: '' });

  if (loading) return null;
  if (!session) {
    return (
      <p className="report-job report-job-out">
        Something wrong with this job?{' '}
        <Link to={`/login?next=${encodeURIComponent('/jobs/' + jobId)}`}>Log in to report it</Link>.
      </p>
    );
  }
  if (state.status === 'sent') {
    return <p className="report-job report-done" role="status">{state.message}</p>;
  }
  if (!open) {
    return (
      <p className="report-job">
        <button type="button" className="btn-link tap-44" onClick={() => setOpen(true)} aria-expanded="false">
          Report this job
        </button>
      </p>
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!reason) {
      setState({ status: 'error', message: 'Choose a reason.' });
      return;
    }
    setState({ status: 'busy', message: '' });
    const error = await reportJob(jobId, reason, details);
    if (error && !/already reported/.test(error)) {
      setState({ status: 'error', message: error });
      return;
    }
    setState({ status: 'sent', message: error || "Thanks for telling us. We'll look into it." });
  }

  return (
    <form className="report-job report-form" onSubmit={onSubmit} noValidate aria-labelledby="report-title">
      <h2 id="report-title" className="report-title">Report this job</h2>
      <fieldset className="report-reasons">
        <legend>What's wrong?</legend>
        {REPORT_REASONS.map(([value, label]) => (
          <label key={value} className="check">
            <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => { setReason(value); if (state.status === 'error') setState({ status: 'idle', message: '' }); }} /> {label}
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>Details <span className="field-optional">(optional)</span></span>
        <textarea className="input textarea" name="details" rows={4} maxLength={REPORT_DETAILS_MAX} value={details}
          onChange={(e) => setDetails(e.target.value)} placeholder="What happened? Only the GigoMe team sees this." />
      </label>
      {state.status === 'error' && <p className="err" role="alert">{state.message}</p>}
      <div className="form-buttons">
        <button type="submit" className="btn btn-primary" disabled={state.status === 'busy'}>
          {state.status === 'busy' ? 'Sending…' : 'Send report'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={state.status === 'busy'}>
          Cancel
        </button>
      </div>
    </form>
  );
}
