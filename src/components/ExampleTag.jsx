import { EXAMPLE_COMPANY_LABEL, EXAMPLE_JOB_LABEL } from '../lib/jobs.js';

// The small "Example" tag on example listings (made up for testers until the
// public launch): job cards, map cards, job and company pages, saved jobs,
// followed companies and /admin. Screen readers hear the whole label
// ("Example listing, not a real job"); hovering shows it too.
export default function ExampleTag({ company = false }) {
  const label = company ? EXAMPLE_COMPANY_LABEL : EXAMPLE_JOB_LABEL;
  return (
    <span className="tag tag-example" title={label}>
      Example<span className="sr-only">{label.slice('Example'.length)}</span>
    </span>
  );
}
