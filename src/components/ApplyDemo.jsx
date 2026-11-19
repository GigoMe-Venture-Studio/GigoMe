import { useEffect, useRef } from 'react';
import { demoContact } from '../lib/jobs.js';
import { useT } from '../lib/useLang.js';

// "Apply" on an example listing: a short demo of the real step, clearly
// marked. Nothing opens, nothing is sent and no apply click is counted (the
// database is never asked). It shows what a student sees under "Apply" on a
// real job, with a made-up link and email under the reserved .example
// domain (demoContact()), as plain text: no link, nothing to click.
export default function ApplyDemo({ open, job, onClose }) {
  const t = useT();
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
            <h2 id="apply-demo-title"><span className="tag tag-demo">{t('applyDemo.tag')}</span> {t('applyDemo.title')}</h2>
            <button type="button" className="apply-demo-close" aria-label={t('applyDemo.closeLabel')} onClick={onClose}>×</button>
          </div>
          <p>{t('applyDemo.intro')}</p>
          <div className="apply-demo-mock" role="group" aria-label={t('applyDemo.mockLabel')}>
            <span className="apply-demo-mock-label" aria-hidden="true">{t('applyDemo.tag')}</span>
            <p className="apply-heading">{t('jobPage.howToApply')}</p>
            <span className="btn btn-primary apply-demo-btn" aria-disabled>{t('jobPage.openApplication')}</span>
            <p className="apply-demo-url">{url}</p>
            <p>{t('jobPage.email')} <span className="apply-demo-email">{email}</span></p>
            <p className="apply-demo-url">{t('applyDemo.subject', { subject: t('jobPage.mailSubject', { title: job.title }) })}</p>
            <p className="apply-note">{t('jobPage.straightToEmployer')}</p>
          </div>
          <p className="muted apply-demo-small">{t('applyDemo.madeUp')}</p>
          <div className="apply-demo-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
