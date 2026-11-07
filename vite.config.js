import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite + React. `npm run build` writes the site to ./dist, which Cloudflare
// Workers serves as static assets (see wrangler.jsonc). Files in public/
// (such as _headers) are copied into dist/ as they are.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
