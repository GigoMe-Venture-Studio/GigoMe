import { DEGREE_LEVELS } from '../lib/auth.js';
import { yearOptions } from '../lib/profile.js';
import { useT } from '../lib/useLang.js';

// Full name, degree level and graduation year, as on /welcome and /account.
// values: { fullName, degree, year }; onChange(key, value); errors by key.
// Company accounts (student = false) only get the name.
export default function ProfileFields({ values, onChange, errors, student = true }) {
  const t = useT();
  return (
    <>
      <label className="field">
        {t('profile.fullName')}
        <input
          className="input"
          type="text"
          name="full_name"
          autoComplete="name"
          maxLength={120}
          value={values.fullName}
          onChange={(e) => onChange('fullName', e.target.value)}
          aria-invalid={Boolean(errors.fullName)}
          required
        />
        {errors.fullName && <span className="err">{errors.fullName}</span>}
      </label>
      {student && (
        <>
          <label className="field">
            {t('profile.degree')}
            <select
              className="select"
              name="degree_level"
              value={values.degree}
              onChange={(e) => onChange('degree', e.target.value)}
              aria-invalid={Boolean(errors.degree)}
              required
            >
              <option value="">{t('profile.choose')}</option>
              {DEGREE_LEVELS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            {errors.degree && <span className="err">{errors.degree}</span>}
          </label>
          <label className="field">
            {t('profile.gradYear')}
            <select
              className="select"
              name="graduation_year"
              value={values.year}
              onChange={(e) => onChange('year', e.target.value)}
              aria-invalid={Boolean(errors.year)}
              required
            >
              <option value="">{t('profile.choose')}</option>
              {yearOptions(Number(values.year) || null).map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            {errors.year && <span className="err">{errors.year}</span>}
          </label>
        </>
      )}
    </>
  );
}
