/**
 * CSRF protection utility functions for client-side use
 */

/**
 * Get the CSRF token from the page
 * The token is set by the server as a cookie or in headers
 */
export function getCsrfToken(): string | null {
  // Try to get from our XSRF-TOKEN cookie (our main approach)
  const token = getCookieValue('XSRF-TOKEN');
  if (token) {
    return token;
  }
  
  // Fallback options if the cookie approach doesn't work
  
  // Check for a meta tag
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag && metaTag.getAttribute('content')) {
    return metaTag.getAttribute('content');
  }
  
  // Check for a global window variable (set by server)
  if (typeof window !== 'undefined' && (window as any).__CSRF_TOKEN__) {
    return (window as any).__CSRF_TOKEN__;
  }
  
  // Check for _csrf cookie (csurf default)
  const csrfCookie = getCookieValue('_csrf');
  if (csrfCookie) {
    return csrfCookie;
  }
  
  // No CSRF token found
  console.warn('No CSRF token found. Form submissions might fail.');
  return null;
}

/**
 * Helper to get a cookie value by name
 */
function getCookieValue(name: string): string | null {
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    // Check if this cookie starts with the name we want
    if (cookie.startsWith(name + '=')) {
      return decodeURIComponent(cookie.substring(name.length + 1));
    }
  }
  return null;
}

/**
 * Add CSRF token to form data
 * @param formData Form data to add CSRF token to
 */
export function addCsrfToken(formData: FormData): FormData {
  const token = getCsrfToken();
  if (token) {
    formData.append('_csrf', token);
  }
  return formData;
}

/**
 * Add CSRF token to a request object
 * @param init Fetch init options
 */
export function addCsrfToRequest(init: RequestInit = {}): RequestInit {
  const token = getCsrfToken();
  if (!token) return init;
  
  // Create headers object if it doesn't exist
  const headers = new Headers(init.headers || {});
  headers.append('X-CSRF-Token', token);
  
  return {
    ...init,
    headers
  };
}

/**
 * Higher-order function to add CSRF token to fetch calls
 * @param url URL to fetch
 * @param init Fetch init options
 */
export function fetchWithCsrf(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, addCsrfToRequest(init));
}