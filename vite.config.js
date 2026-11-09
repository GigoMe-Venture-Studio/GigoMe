import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The Supabase origin (https://<project>.supabase.co) from the build variable
// VITE_SUPABASE_URL, or '' when it's missing or not an https:// address.
function supabaseOrigin(url) {
  try {
    const u = new URL(String(url || ''));
    return u.protocol === 'https:' && /^[a-z0-9.-]+$/i.test(u.hostname) ? u.origin : '';
  } catch {
    return '';
  }
}

// Writes the Supabase origin into dist/_headers (the Content-Security-Policy's
// connect-src), so the project's address comes from the build variables and
// isn't kept in the repo.
function securityHeaders(env) {
  let outDir = 'dist';
  return {
    name: 'gigome-security-headers',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = join(outDir, '_headers');
      if (!existsSync(file)) return;
      const origin = supabaseOrigin(env.VITE_SUPABASE_URL);
      const text = readFileSync(file, 'utf8').replaceAll(' __SUPABASE_ORIGIN__', origin ? ' ' + origin : '');
      writeFileSync(file, text);
    }
  };
}

// Vite + React. `npm run build` writes the site to ./dist, which Cloudflare
// Workers serves as static assets (see wrangler.jsonc). Files in public/
// (such as _headers) are copied into dist/ as they are, apart from the
// Supabase origin above.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), securityHeaders(env)],
    base: '/',
    build: {
      outDir: 'dist',
      emptyOutDir: true
    }
  };
});
