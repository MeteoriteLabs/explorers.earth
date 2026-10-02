import { bootstrapPublicRuntime, isCanonicalRuntime } from './lib/publicRuntimeConfig';
const start = () => import('./main');
if (isCanonicalRuntime()) {
  bootstrapPublicRuntime(fetch, window.location.origin, start).catch(() => {
    const root = document.getElementById('root');
    if (root) { root.textContent = 'The application configuration is unavailable. Please try again later.'; root.setAttribute('role','alert'); }
  });
} else { void start(); }
