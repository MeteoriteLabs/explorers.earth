import { BrowserContext } from '@playwright/test';

interface MockAuthenticationOptions {
  token?: string;
  cookieDomain?: string;
  user?: { id: string; documentId: string; username: string; email: string; blocked: boolean };
}

// The canonical session the application actually verifies. `authClient.refresh()`
// reads GET /api/auth/get-session, and it deletes the legacy `auth-storage` blob
// this helper injects before doing so, so the localStorage injection below can no
// longer authenticate a fixture page on its own. Matches the cookie name the
// canonical fixtures in `category-navigation.ts` use.
const SESSION_COOKIE = 'better-auth.session_token';
const SESSION_VALUE = 'fixture-canonical-session';
const SESSION_ID = 'fixture-canonical-session-id';

export async function setupMockAuthentication(context: BrowserContext, options: MockAuthenticationOptions = {}) {
  const token = options.token ?? 'mock-jwt-token-xyz';
  const user = options.user ?? {
    id: 'mock-user-123', documentId: 'mock-user-123', username: 'testuser', email: 'test@explorers.earth', blocked: false,
  };
  // Populate storage state / session data to skip login
  const cookieDomain = options.cookieDomain ?? 'localhost';
  await context.addCookies([
    {
      name: 'token',
      value: token,
      domain: cookieDomain,
      path: '/',
    },
    {
      name: SESSION_COOKIE,
      value: SESSION_VALUE,
      domain: cookieDomain,
      path: '/',
    },
  ]);

  // Authentication follows the cookie this request actually carries, so a fixture
  // that clears it represents a signed-out browser rather than a permanently
  // authenticated one. Playwright's abbreviated headers() collection can omit
  // Cookie, so read it through headerValue.
  await context.route('**/api/auth/get-session', async route => {
    const request = route.request();
    if (request.method() !== 'GET') return route.abort('blockedbyclient');
    const authenticated = ((await request.headerValue('cookie')) ?? '')
      .split(';').some(cookie => cookie.trim() === `${SESSION_COOKIE}=${SESSION_VALUE}`);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authenticated
        ? { user: { id: user.documentId, email: user.email }, session: { id: SESSION_ID } }
        : null),
    });
  });
  
  // Inject localStorage login state safely
  await context.addInitScript(({ fixtureToken, fixtureUser }) => {
    try {
      window.localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          isAuthenticated: true,
          token: fixtureToken,
          jwt: fixtureToken,
          user: fixtureUser,
        }
      }));
      window.localStorage.setItem('user', JSON.stringify({
        id: fixtureUser.id,
        documentId: fixtureUser.documentId,
        username: fixtureUser.username,
        email: fixtureUser.email,
        role: 'explorer'
      }));
      window.localStorage.setItem('auth_session', 'mock-session-id-456');
      window.localStorage.setItem('explorers-cookie-consent', JSON.stringify({
        essential: true,
        analytics: false,
        marketing: false,
          timestamp: '2026-01-01T00:00:00.000Z',
      }));
    } catch (e) {
      // Safe to ignore on about:blank, will run again on target origin
    }
  }, { fixtureToken: token, fixtureUser: user });

  // Mock subscription API calls at context level
  await context.route('**/api/subscriptions/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            documentId: 'sub-plan-123',
            plan_id: 'plan-basic',
            start_date: '2026-07-09T00:00:00Z',
            end_date: '2027-07-09T00:00:00Z',
            status: 'active'
          }
        ]
      })
    });
  });

  // Mock the subscription plans LIST endpoint. Registered after the generic
  // '**/api/subscriptions/**' route so it wins (Playwright matches routes in
  // reverse registration order). Without this, the plans request receives
  // subscription records lacking plan_name, which crashed OnBoarding.
  await context.route('**/api/subscriptions/plans', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            documentId: 'plan-free',
            plan_name: 'Free',
            plan_cost: 0,
            duration: 'monthly',
            features: '[]',
            ai_guide_quota: 10,
            song_quota: 10
          },
          {
            documentId: 'plan-basic',
            plan_name: 'Basic Plan',
            plan_cost: 99,
            duration: 'monthly',
            features: '[]',
            ai_guide_quota: 100,
            song_quota: 100
          }
        ]
      })
    });
  });

  // Mock subscription plan by ID calls
  await context.route('**/api/subscriptions/plans/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          documentId: 'plan-basic',
          plan_name: 'Basic Plan',
          ai_guide_quota: 100,
          song_quota: 100
        }
      })
    });
  });

  // Mock song/request limits API calls
  await context.route('**/api/song-limits/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            documentId: 'song-limit-123',
            username: 'testuser',
            song_requests: 0,
            ai_guide_requests: 0
          }
        ]
      })
    });
  });
}
