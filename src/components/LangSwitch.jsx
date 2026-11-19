import { setLang } from '../lib/i18n.js';
import { useLang, useT } from '../lib/useLang.js';

// "EN | IT" in the header (and in the phone menu): the language of the site.
// The choice is remembered in this browser (src/lib/i18n.js). Each button
// says its language's name in that language for screen readers.
export default function LangSwitch({ className = '' }) {
  const lang = useLang();
  const t = useT();
  const button = (l, short) => (
    <button
      type="button"
      lang={l}
      aria-label={t(`langSwitch.${l}`)}
      aria-pressed={lang === l}
      onClick={() => setLang(l).catch(() => {})}
    >
      {short}
    </button>
  );
  return (
    <div className={'lang-switch ' + className} role="group" aria-label={t('langSwitch.label')}>
      {button('en', 'EN')}
      <span aria-hidden="true">|</span>
      {button('it', 'IT')}
    </div>
  );
}
