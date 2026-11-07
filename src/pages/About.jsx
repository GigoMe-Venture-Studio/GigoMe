import { Link } from 'react-router';
import PageShell from '../components/PageShell.jsx';
import { CONTACT_EMAIL } from '../lib/contact.js';

export default function About() {
  return (
    <PageShell className="about-main">
      <article className="about">
        <h1>About GigoMe</h1>
        <p className="lead">
          GigoMe is a job board for students in Milan: part-time work, gigs and internships you can do in English.
        </p>

        <h2>What GigoMe is</h2>
        <p>
          Employers list jobs on GigoMe, and you can <Link to="/jobs">browse them</Link> by type, hours, remote work and
          how much Italian they need. Many need none at all.
        </p>

        <h2>Free for students</h2>
        <p>GigoMe is free for students. You log in with your university email and a 6-digit code, no password needed.</p>

        <h2>How applying works</h2>
        <p>
          Applications happen directly with the employer. On each job, logged-in students can see how to apply, on the
          employer's website or by email. GigoMe doesn't handle applications, contracts or pay.
        </p>

        <h2>Who runs GigoMe</h2>
        <p className="placeholder-text">[Who runs GigoMe: to be filled in]</p>

        <h2 id="contact">Contact</h2>
        <p>
          Questions, feedback, or a job to list? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </article>
    </PageShell>
  );
}
