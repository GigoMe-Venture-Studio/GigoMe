import { Link } from 'react-router';
import { useT } from '../lib/useLang.js';

export default function NotFound() {
  const t = useT();
  return (
    <main className="wrap page-main">
      <h1 className="page-title">{t('notFound.title')}</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        {t('notFound.text')}
      </p>
      <p style={{ marginTop: 'var(--s5)' }}>
        <Link className="btn btn-primary" to="/">{t('notFound.home')}</Link>
      </p>
    </main>
  );
}
