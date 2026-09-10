import type { Page } from '@playwright/test';

export async function denyHostedEgress(page: Page) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::\d+)?(?:\/|$)|localhost(?::\d+)?(?:\/|$)|\[::1\](?::\d+)?(?:\/|$))/, async route => {
    const type = route.request().resourceType();
    if (type === 'image') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" />' });
    if (type === 'stylesheet' || type === 'font' || type === 'script') {
      return route.fulfill({ status: 200, contentType: type === 'stylesheet' ? 'text/css' : 'application/javascript', body: '' });
    }
    return route.fulfill({ status: 418, contentType: 'application/json', body: '{"error":"HOSTED_EGRESS_DENIED"}' });
  });
}
