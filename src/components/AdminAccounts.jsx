import { useEffect, useState } from 'react';
import { labelMap, locale } from '../lib/i18n.js';
import { useT } from '../lib/useLang.js';
import { ACCOUNTS_PAGE, VERIFICATION_LABELS, fetchEmployerAccounts, fetchStudentAccounts } from '../lib/admin.js';

// /admin: read-only lists of student and employer accounts, newest sign-ups
// first, searched and paged in the database (admin_list_students(),
// admin_list_employers(): admins only). No editing and no export. Each list
// loads on its own: if one fails, the rest of /admin still works.
export default function AdminAccounts() {
  const t = useT();
  return (
    <section className="admin-section admin-accounts" id="admin-accounts" aria-labelledby="accounts-title">
      <h2 id="accounts-title">{t('admin.accounts.title')}</h2>
      <p className="admin-accounts-note" role="note">{t('admin.accounts.note')}</p>
      <AccountList kind="students" fetch={fetchStudentAccounts} Head={StudentHead} Row={StudentRow} />
      <AccountList kind="employers" fetch={fetchEmployerAccounts} Head={EmployerHead} Row={EmployerRow} />
    </section>
  );
}

const COL = 'col';
const SEARCH_DELAY_MS = 300;
const COMPANY_STATUS = labelMap('admin.companyStatus', ['pending', 'approved', 'rejected']);
const upperFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const day = (iso) => new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' });

function AccountList({ kind, fetch, Head, Row }) {
  const t = useT();
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ status: 'loading' });

  // Search once typing pauses, from the first page (only when the search changed).
  useEffect(() => {
    const next = typed.trim();
    if (next === search) return undefined;
    const id = setTimeout(() => {
      setSearch(next);
      setPage(0);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(id);
  }, [typed, search]);

  useEffect(() => {
    let active = true;
    setData((d) => ({ ...d, status: 'loading' }));
    fetch(search, page)
      .then((r) => active && setData({ status: 'ready', ...r }))
      .catch(() => active && setData({ status: 'error' }));
    return () => {
      active = false;
    };
  }, [fetch, search, page]);

  const rows = data.rows || [];
  const from = page * ACCOUNTS_PAGE + 1;
  const to = page * ACCOUNTS_PAGE + rows.length;
  const hasNext = data.total != null && to < data.total;
  const titleId = `accounts-${kind}-title`;
  const searchId = `accounts-${kind}-search`;

  return (
    <div className="admin-accounts-list" aria-labelledby={titleId} role="region">
      <h3 id={titleId} className="admin-subtitle">{t(`admin.accounts.${kind}.title`)}</h3>
      <label className="field admin-accounts-search" htmlFor={searchId}>
        <span>{t(`admin.accounts.${kind}.search`)}</span>
        <input id={searchId} className="input" type="search" autoComplete="off" spellCheck={false} maxLength={200}
          value={typed} onChange={(e) => setTyped(e.target.value)} />
      </label>
      {data.status === 'error' ? (
        <p className="err" role="alert">{t('admin.accounts.error')}</p>
      ) : data.status === 'loading' && !data.rows ? (
        <p className="muted">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="muted">{search ? t('admin.accounts.noMatch') : page > 0 ? t('admin.accounts.noMore') : t('admin.accounts.none')}</p>
      ) : (
        <div className="admin-table-wrap" aria-busy={data.status === 'loading'}>
          <table className="admin-table admin-accounts-table">
            <caption className="sr-only">{t(`admin.accounts.${kind}.caption`)}</caption>
            <thead><Head /></thead>
            <tbody>{rows.map((r) => <Row key={r.id} row={r} />)}</tbody>
          </table>
        </div>
      )}
      {(page > 0 || hasNext) && data.status !== 'error' && (
        <nav className="admin-pager" aria-label={t(`admin.accounts.${kind}.pages`)}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={page === 0 || data.status === 'loading'}
            onClick={() => setPage((n) => Math.max(n - 1, 0))}>
            {t('admin.accounts.previous')}
          </button>
          {rows.length > 0 && (
            <span className="muted tnum">{t('admin.accounts.range', { from, to, total: data.total })}</span>
          )}
          <button type="button" className="btn btn-secondary btn-sm" disabled={!hasNext || data.status === 'loading'}
            onClick={() => setPage((n) => n + 1)}>
            {t('admin.accounts.next')}
          </button>
        </nav>
      )}
      {page === 0 && !hasNext && rows.length > 0 && (
        <p className="field-hint tnum">{t('admin.accounts.count', { count: data.total })}</p>
      )}
    </div>
  );
}

function Dates({ row }) {
  const t = useT();
  return (
    <>
      <td className="tnum">{day(row.signed_up_at)}</td>
      <td className="tnum">{row.last_login_at ? day(row.last_login_at) : <span className="muted">{t('admin.accounts.never')}</span>}</td>
    </>
  );
}

function StudentHead() {
  const t = useT();
  return (
    <tr>
      <th scope={COL}>{t('admin.accounts.col.email')}</th>
      <th scope={COL}>{t('admin.accounts.col.name')}</th>
      <th scope={COL}>{t('admin.accounts.col.university')}</th>
      <th scope={COL}>{t('admin.accounts.col.method')}</th>
      <th scope={COL}>{t('admin.accounts.col.signedUp')}</th>
      <th scope={COL}>{t('admin.accounts.col.lastLogin')}</th>
    </tr>
  );
}

function StudentRow({ row }) {
  const t = useT();
  const uni = row.university
    || (row.other_university ? t('admin.accounts.otherUni', { name: row.other_university }) : null);
  return (
    <tr>
      <td className="auth-email">{row.email}</td>
      <td>{row.full_name || <span className="muted">{t('admin.accounts.noName')}</span>}</td>
      <td>{uni || <span className="muted">{t('admin.students.notAnswered')}</span>}</td>
      <td>{VERIFICATION_LABELS[row.verification] || row.verification}</td>
      <Dates row={row} />
    </tr>
  );
}

function EmployerHead() {
  const t = useT();
  return (
    <tr>
      <th scope={COL}>{t('admin.accounts.col.company')}</th>
      <th scope={COL}>{t('admin.accounts.col.email')}</th>
      <th scope={COL}>{t('admin.accounts.col.status')}</th>
      <th scope={COL}>{t('admin.accounts.col.jobs')}</th>
      <th scope={COL}>{t('admin.accounts.col.signedUp')}</th>
      <th scope={COL}>{t('admin.accounts.col.lastLogin')}</th>
    </tr>
  );
}

function EmployerRow({ row }) {
  const t = useT();
  const hasCompany = row.company_id != null;
  return (
    <tr>
      <td>{hasCompany ? row.company_name : <span className="muted">{t('admin.accounts.noCompany')}</span>}</td>
      <td className="auth-email">{row.email}</td>
      <td>{hasCompany ? upperFirst(COMPANY_STATUS[row.company_status] || row.company_status) : <span className="muted">–</span>}</td>
      <td className="tnum">{hasCompany ? t('admin.accounts.jobs', { jobs: Number(row.jobs), live: Number(row.live_jobs) }) : <span className="muted">–</span>}</td>
      <Dates row={row} />
    </tr>
  );
}
