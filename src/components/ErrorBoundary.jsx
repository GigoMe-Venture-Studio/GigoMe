import { Component } from 'react';
import { useLocation } from 'react-router';
import { useOpenFeedback } from './Feedback.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';

// Catches an error while a page renders and shows a friendly page instead of
// a blank screen. Two of them: one around the pages (inside the header,
// footer and feedback panel, so those keep working) and a last one around
// the whole app.
class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // Any navigation (a new resetKey) clears the error. Pages that work are
  // never remounted by this, so filters changing the address keep their state.
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }

  componentDidCatch(error) {
    console.error('[GigoMe] A page failed to render:', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// Around the pages: going anywhere (even the same page with other filters)
// tries again.
export function PageErrorBoundary({ children }) {
  const { key } = useLocation();
  return (
    <Boundary resetKey={key} fallback={<PageError />}>
      {children}
    </Boundary>
  );
}

// Around everything: plain HTML only, in case the header or the feedback
// panel is what failed.
export function AppErrorBoundary({ children }) {
  return (
    <Boundary
      fallback={
        <main className="wrap page-main error-page">
          <h1 className="page-title">Something went wrong</h1>
          <p className="error-page-text">
            GigoMe hit an error and couldn't show this page. Reloading usually fixes it. If it keeps happening, write to{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
          <p className="error-page-actions">
            <a className="btn btn-primary" href="/">Go to the home page</a>
          </p>
        </main>
      }
    >
      {children}
    </Boundary>
  );
}

function PageError() {
  const openFeedback = useOpenFeedback();
  return (
    <main className="wrap page-main error-page">
      <h1 className="page-title">Something went wrong</h1>
      <p className="error-page-text">
        This page hit an error and couldn't be shown. Reloading usually fixes it, for example after we've put out a
        new version of the site.
      </p>
      <p className="error-page-actions">
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload the page</button>
        <a className="btn btn-secondary" href="/">Go to the home page</a>
      </p>
      <p className="error-page-text">
        If it keeps happening,{' '}
        <button type="button" className="btn-link" onClick={openFeedback}>tell us what you were doing</button>{' '}
        so we can fix it.
      </p>
    </main>
  );
}
