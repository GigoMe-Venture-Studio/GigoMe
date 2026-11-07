import { Link } from 'react-router';

export default function NotFound() {
  return (
    <main className="wrap page-main">
      <p><Link className="wordmark" to="/">GigoMe</Link></p>
      <h1 className="page-title" style={{ marginTop: 'var(--s6)' }}>Page not found</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        There's nothing at this address. It may have moved, or the link may be mistyped.
      </p>
      <p style={{ marginTop: 'var(--s5)' }}>
        <Link className="btn btn-primary" to="/">Go to the home page</Link>
      </p>
    </main>
  );
}
