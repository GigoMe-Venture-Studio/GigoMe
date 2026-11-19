// Page titles, descriptions, canonical links and search-engine data.
//
// <RouteMeta> (in App.jsx) sets the title and description of every fixed
// page from PAGES when the address changes; job and company pages then set
// their own with usePageMeta() once loaded. Private pages are marked
// "noindex" (and robots.txt asks crawlers to skip them).
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { t } from './i18n.js';
import { useLang } from './useLang.js';

export const SITE = 'https://gigome.org';
const defaultDescription = () => t('seo.description');

// [path, key, indexable]: the title is seo.<key>.title, the description
// seo.<key>.description (or the site's default description), in the
// language the site is shown in.
const PAGES = [
  ['/', 'home', true],
  ['/jobs', 'jobs', true],
  ['/employers', 'employers', true],
  ['/privacy', 'privacy', true],
  ['/how-it-works', 'howItWorks', true],
  ['/safety', 'safety', true],
  ['/terms', 'terms', true],
  ['/login', 'login', false],
  ['/welcome', 'welcome', false],
  ['/account', 'account', false],
  ['/saved', 'saved', false],
  ['/employers/setup', 'setup', false],
  ['/dashboard', 'dashboard', false],
  ['/admin', 'admin', false]
];
const pageDescription = (key) => {
  const d = t(`seo.${key}.description`);
  return d === `seo.${key}.description` ? defaultDescription() : d;
};

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
  setMeta('meta[name="description"]', 'name', 'description', description || defaultDescription());
  setMeta('link[rel="canonical"]', 'rel', 'canonical', index && path ? SITE + path : null);
  setMeta('meta[name="robots"]', 'name', 'robots', index ? null : 'noindex');
}

export function RouteMeta() {
  const { pathname } = useLocation();
  const lang = useLang();
  useEffect(() => {
    const page = PAGES.find(([p]) => p === pathname);
    if (page) applyMeta({ title: t(`seo.${page[1]}.title`), description: pageDescription(page[1]), path: page[0], index: page[2] });
    else if (/^\/dashboard\//.test(pathname)) applyMeta({ title: t('seo.yourJob.title'), index: false });
    else if (/^\/(jobs|companies)\/[^/]+$/.test(pathname)) applyMeta({ title: '', path: pathname });
    else applyMeta({ title: t('seo.notFound.title'), index: false });
  }, [pathname, lang]);
  return null;
}

// For a page that knows its title once its data has loaded. `meta` null
// keeps what RouteMeta set.
export function usePageMeta(meta) {
  const { pathname } = useLocation();
  const title = meta && meta.title;
  const description = meta && meta.description;
  const index = !meta || meta.index !== false;
  // Again after a language change (RouteMeta has just set the page's default).
  const lang = useLang();
  useEffect(() => {
    if (title != null) applyMeta({ title, description, path: pathname, index });
  }, [title, description, index, pathname, lang]);
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

const EMPLOYMENT_TYPE = { part_time: 'PART_TIME', gig: 'TEMPORARY', other: 'OTHER' };
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
