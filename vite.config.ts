import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  // In development (dev server), ALWAYS use root '/' for absolute module resolution in iframes.
  // In production build (for GitHub Pages), use repository subpath, VITE_BASE_PATH, or './'.
  const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '';
  const base = command === 'serve' ? '/' : process.env.VITE_BASE_PATH || (repoName ? `/${repoName}/` : './');

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'h264-mp4-encoder': path.resolve(__dirname, 'node_modules/h264-mp4-encoder/embuild/dist/h264-mp4-encoder.web.js'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
