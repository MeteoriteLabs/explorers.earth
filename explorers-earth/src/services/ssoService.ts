import type { ApolloClient } from '@apollo/client';
import { getUserAccountQuery, updateAccountMutation } from '../features/Settings/api/mutation';
import { reconcileLocalTunesLink } from '../utils/localTunesUtils';

export interface SSOConfig {
  localTunesApiUrl: string;
  enabled: boolean;
  timeout: number;
}

export interface SSOResult {
  success: boolean;
  error?: string;
  message?: string;
  guestUrl?: string;
}

const CROSS_DOMAIN_AUTH_KEY = 'localtunes_cross_domain_auth';
const NATIVE_SESSION_KEY = 'localTunes_session';

function clearBrowserMusicAuth(): void {
  localStorage.removeItem(CROSS_DOMAIN_AUTH_KEY);
  sessionStorage.removeItem(CROSS_DOMAIN_AUTH_KEY);
  sessionStorage.removeItem('localtunes_session_cookie');
  localStorage.removeItem(NATIVE_SESSION_KEY);
  document.cookie = `${CROSS_DOMAIN_AUTH_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export async function autoUpdateLocalTunesPublicLink(
  apolloClient: ApolloClient<any>,
  documentId: string,
  guestUrl: string
): Promise<boolean> {
  try {
    const accountResponse = await apolloClient.query({
      query: getUserAccountQuery,
      variables: { documentId },
      fetchPolicy: 'network-only',
    });
    const account = accountResponse.data?.usersPermissionsUser?.accounts?.[0];
    if (!account) return false;

    const playlistUrl = reconcileLocalTunesLink(account.localtunes_public, guestUrl);
    if (!playlistUrl) return true;
    await apolloClient.mutate({
      mutation: updateAccountMutation,
      variables: {
        documentId: account.documentId,
        data: { localtunes_public: playlistUrl },
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function performLocalTunesSSO(
  _apolloClient: ApolloClient<any>,
  _documentId: string,
  _config?: SSOConfig
): Promise<SSOResult> {
  clearBrowserMusicAuth();
  return {
    success: false,
    error: 'EMBEDDED_MUSIC_SESSION_DISABLED',
    message: 'Embedded Music authentication is unavailable.',
  };
}

export async function clearLocalTunesSSO(): Promise<SSOResult> {
  clearBrowserMusicAuth();
  return { success: true, message: 'LocalTunes SSO session cleared successfully' };
}

export async function checkLocalTunesSSOStatus(): Promise<SSOResult> {
  clearBrowserMusicAuth();
  return { success: true, message: 'LocalTunes SSO is not active' };
}

export function debugSSOStatus(): void {
  clearBrowserMusicAuth();
}

export async function handlePostLoginSync(user: any, apolloClient?: ApolloClient<any>): Promise<void> {
  try {
    const { syncLocalTunesUser } = await import('./localTunesService');
    const result = await syncLocalTunesUser({
      id: user.documentId || user.id,
      username: user.username,
      email: user.email,
    });
    if (result.success && result.user?.guestUrl && apolloClient) {
      await autoUpdateLocalTunesPublicLink(
        apolloClient,
        user.documentId || user.id,
        result.user.guestUrl
      );
    }
  } catch {
    // The compatibility sync is best-effort and must not expose upstream details.
  }
}
