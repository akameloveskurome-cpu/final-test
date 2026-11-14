import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  // dev only: set LF_ALLOW_ANY_HOST=1 to accept any Host header (e.g. behind a tunnel)
  server: { allowedHosts: process.env.LF_ALLOW_ANY_HOST === '1' ? true : undefined },
  build: { outDir: 'dist' },
});
