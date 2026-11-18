import { useEffect, useRef } from 'react';
import { demoContact } from '../lib/jobs.js';

// "Apply" on an example listing: a short demo of the real step, clearly
// marked. Nothing opens, nothing is sent and no apply click is counted (the
// database is never asked). It shows what a student sees under "Apply" on a
// real job, with a made-up link and email under the reserved .example
// domain (demoContact()), as plain text: no link, nothing to click.
export default function ApplyDemo({ open, job, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const { url, email } = demoContact(job);
  return (
    <dialog
      ref={ref}
      className="apply-demo"
      aria-labelledby="apply-demo-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {open && (
        <div className="apply-demo-inner">
          <div className="apply-demo-head">
            <h2 id="apply-demo-title"><span className="tag tag-demo">Demo</span> What applying looks like</h2>
            <button type="button" className="apply-demo-close" aria-label="Close the demo" onClick={onClose}>×</button>
          </div>
          <p>
            This is an example listing, so nothing opened, nothing was sent and no apply click was counted. On a real
            job, Apply opens the employer's application page in a new tab, or your email app with the subject filled in,
            and shows this under the button:
          </p>
          <div className="apply-demo-mock" role="group" aria-label="Demo of the real step">
            <span className="apply-demo-mock-label" aria-hidden="true">Demo</span>
            <p className="apply-heading">How to apply</p>
            <span className="btn btn-primary apply-demo-btn" aria-disabled="true">Open the application page</span>
            <p className="apply-demo-url">{url}</p>
            <p>Email: <span className="apply-demo-email">{email}</span></p>
            <p className="apply-demo-url">Subject: Application: {job.title} (via GigoMe)</p>
            <p className="apply-note">Applications go straight to the employer.</p>
          </div>
          <p className="muted apply-demo-small">The link and address above are made up: they don't work.</p>
          <div className="apply-demo-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
