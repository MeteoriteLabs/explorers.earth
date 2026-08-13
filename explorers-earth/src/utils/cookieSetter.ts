const CROSS_DOMAIN_AUTH_KEY = 'localtunes_cross_domain_auth';

export function clearCrossDomainAuthData(): void {
  localStorage.removeItem(CROSS_DOMAIN_AUTH_KEY);
  sessionStorage.removeItem(CROSS_DOMAIN_AUTH_KEY);
  document.cookie = `${CROSS_DOMAIN_AUTH_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/** @deprecated Browser-written Music auth cookies are disabled. */
export function setLocalTunesCrossDomainCookie(): never {
  clearCrossDomainAuthData();
  throw Object.assign(new Error('Embedded Music authentication is unavailable.'), {
    code: 'EMBEDDED_MUSIC_SESSION_DISABLED',
  });
}

export function checkCrossDomainCookies() {
  clearCrossDomainAuthData();
  return { localStorage: false, sessionStorage: false, cookie: false };
}

export default {
  setLocalTunesCrossDomainCookie,
  checkCrossDomainCookies,
  clearCrossDomainAuthData,
};
