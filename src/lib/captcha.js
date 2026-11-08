// Cloudflare Turnstile for the login form, checked by Supabase Auth's CAPTCHA
// protection. Only on when VITE_TURNSTILE_SITE_KEY is set at build time: the
// site key is public (it ends up in the page anyway); the secret key lives
// only in the Supabase dashboard.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';
export const captchaEnabled = Boolean(TURNSTILE_SITE_KEY);

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading = null;

// Loads Cloudflare's script once. Rejects if it can't load (blocked by an
// extension or the network), so the form can say so.
export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile missing')));
      s.onerror = () => {
        loading = null;
        s.remove();
        reject(new Error('Turnstile blocked'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}
