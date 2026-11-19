import { useT } from '../lib/useLang.js';

// The small "Example" tag on example listings (made up for testers until the
// public launch): job cards, map cards, job and company pages, saved jobs,
// followed companies and /admin. Screen readers hear the whole label
// ("Example listing, not a real job"); hovering shows it too.
export default function ExampleTag({ company = false }) {
  const t = useT();
  const rest = t(company ? 'example.companyRest' : 'example.jobRest');
  const tag = t('example.tag');
  return (
    <span className="tag tag-example" title={tag + rest}>
      {tag}<span className="sr-only">{rest}</span>
    </span>
  );
}
