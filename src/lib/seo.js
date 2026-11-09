// Page titles, descriptions, canonical links and search-engine data.
//
// <RouteMeta> (in App.jsx) sets the title and description of every fixed
// page from PAGES when the address changes; job and company pages then set
// their own with usePageMeta() once loaded. Private pages are marked
// "noindex" (and robots.txt asks crawlers to skip them).
import { useEffect } from 'react';
import { useLocation } from 'react-router';

export const SITE = 'https://gigome.org';
const DEFAULT_DESCRIPTION =
  'Part-time work and internships in Milan, in English. A free, student-run job board for international students.';

// [path, title, description, indexable]
const PAGES = [
  ['/', 'GigoMe: part-time work and internships in Milan, in English', DEFAULT_DESCRIPTION, true],
  ['/jobs', 'Jobs in Milan in English', 'Part-time jobs, gigs and internships in Milan you can do in English. Filter by area, schedule, pay and how much Italian is needed.', true],
  ['/employers', 'Hire international students in Milan', 'Post part-time jobs, gigs and internships for international students in Milan who work in English. Free, reviewed by the GigoMe team.', true],
  ['/privacy', 'Privacy notice', 'How GigoMe handles personal data.', true],
  ['/terms', 'Terms of use', 'The terms for using GigoMe.', true],
  ['/login', 'Log in', 'Log in to GigoMe with your university email.', false],
  ['/welcome', 'Welcome', DEFAULT_DESCRIPTION, false],
  ['/account', 'Your account', DEFAULT_DESCRIPTION, false],
  ['/saved', 'Saved jobs', DEFAULT_DESCRIPTION, false],
  ['/employers/setup', 'Set up your company', DEFAULT_DESCRIPTION, false],
  ['/dashboard', 'Dashboard', DEFAULT_DESCRIPTION, false],
  ['/admin', 'Moderation', DEFAULT_DESCRIPTION, false]
];

function setMeta(selector, attr, name, content) {
  let el = document.head.querySelector(selector);
  if (content == null) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute(selector.startsWith('link') ? 'href' : 'content', content);
}

// Title ("<title> | GigoMe", or the home page's own), description, canonical
// link, and "noindex" for pages search engines should leave out.
export function applyMeta({ title, description, path, index = true }) {
  document.title = !title ? 'GigoMe' : title.startsWith('GigoMe') ? title : `${title} | GigoMe`;
  setMeta('meta[name="description"]', 'name', 'description', description || DEFAULT_DESCRIPTION);
  setMeta('link[rel="canonical"]', 'rel', 'canonical', index && path ? SITE + path : null);
  setMeta('meta[name="robots"]', 'name', 'robots', index ? null : 'noindex');
}

export function RouteMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = PAGES.find(([p]) => p === pathname);
    if (page) applyMeta({ title: page[1], description: page[2], path: page[0], index: page[3] });
    else if (/^\/dashboard\//.test(pathname)) applyMeta({ title: 'Your job', index: false });
    else if (/^\/(jobs|companies)\/[^/]+$/.test(pathname)) applyMeta({ title: '', path: pathname });
    else applyMeta({ title: 'Page not found', index: false });
  }, [pathname]);
  return null;
}

// For a page that knows its title once its data has loaded. `meta` null
// keeps what RouteMeta set.
export function usePageMeta(meta) {
  const { pathname } = useLocation();
  const title = meta && meta.title;
  const description = meta && meta.description;
  const index = !meta || meta.index !== false;
  useEffect(() => {
    if (title != null) applyMeta({ title, description, path: pathname, index });
  }, [title, description, index, pathname]);
}

// One plain-text line from free text, for a meta description.
export function shortText(text, max = 155) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

// Structured data (JSON-LD) in <head> while the page is shown. A data block,
// never run as a script; "<" is escaped so the text can't close the tag.
export function useJsonLd(data) {
  const json = data ? JSON.stringify(data).replace(/</g, '\\u003c') : null;
  useEffect(() => {
    if (!json) return undefined;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.textContent = json;
    document.head.appendChild(el);
    return () => el.remove();
  }, [json]);
}

const EMPLOYMENT_TYPE = { part_time: 'PART_TIME', internship: 'INTERN', gig: 'TEMPORARY', other: 'OTHER' };
const SALARY_UNIT = { hour: 'HOUR', month: 'MONTH' };

// schema.org JobPosting for a live job (Google for Jobs and others).
export function jobPostingData(job) {
  const company = job.companies || {};
  const data = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description || job.title,
    datePosted: job.published_at || job.created_at,
    employmentType: EMPLOYMENT_TYPE[job.job_type] || 'OTHER',
    hiringOrganization: { '@type': 'Organization', name: company.name },
    url: `${SITE}/jobs/${job.id}`,
    directApply: false
  };
  if (job.expires_at) data.validThrough = job.expires_at;
  if (company.website && /^https?:\/\//i.test(company.website)) data.hiringOrganization.sameAs = company.website;
  if (job.remote) {
    data.jobLocationType = 'TELECOMMUTE';
    data.applicantLocationRequirements = { '@type': 'Country', name: 'Italy' };
  }
  if (!job.remote || job.location || job.areas) {
    const place = { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Milano', addressRegion: 'Lombardia', addressCountry: 'IT' } };
    const street = job.location || (job.areas && job.areas.name);
    if (street) place.address.streetAddress = street;
    if (job.show_exact_location && job.latitude != null && job.longitude != null) {
      place.geo = { '@type': 'GeoCoordinates', latitude: job.latitude, longitude: job.longitude };
    }
    data.jobLocation = place;
  }
  if (SALARY_UNIT[job.pay_unit] && Number(job.pay_min) > 0) {
    const value = { '@type': 'QuantitativeValue', unitText: SALARY_UNIT[job.pay_unit] };
    if (Number(job.pay_max) > Number(job.pay_min)) {
      value.minValue = Number(job.pay_min);
      value.maxValue = Number(job.pay_max);
    } else value.value = Number(job.pay_min);
    data.baseSalary = { '@type': 'MonetaryAmount', currency: 'EUR', value };
  }
  return data;
}
