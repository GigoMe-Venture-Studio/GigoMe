import { defineConfig } from 'vite';

// The site is one self-contained index.html. Vite copies it into ./dist,
// which Cloudflare Workers serves as static assets (see wrangler.jsonc).
export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
