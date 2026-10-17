import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  // Automatically configure base path for GitHub Pages:
  // 1. If VITE_BASE_PATH is explicitly set (e.g. in .env or workflow), use it.
  // 2. In GitHub Actions, GITHUB_REPOSITORY is automatically provided as 'owner/repo-name'.
  // 3. Fallback to './' for portable relative asset links that work anywhere.
  const repoName = process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '';
  const base = process.env.VITE_BASE_PATH || (repoName ? `/${repoName}/` : './');

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
