declare global {
  interface Window {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    dataLayer: any[];
    gtag?: (...args: any[]) => void;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}

let gaLoaded = false;

export const loadAnalytics = (): void => {
  if (gaLoaded || window.gtag) return;

  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId) return;

  const script = document.createElement('script');
  script.id = 'ga-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  /* eslint-disable @typescript-eslint/no-explicit-any */
  function gtag(...args: any[]): void {
    window.dataLayer.push(args);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', measurementId);

  gaLoaded = true;
};

export const initAnalytics = (): void => {
  const storedConsent = localStorage.getItem('explorers-cookie-consent');
  if (!storedConsent) return;
  try {
    const consent = JSON.parse(storedConsent);
    if (consent.analytics) {
      loadAnalytics();
    }
  } catch {
    // ignore parse errors
  }
};

export default loadAnalytics;
