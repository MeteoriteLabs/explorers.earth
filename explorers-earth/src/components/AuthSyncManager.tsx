import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../store/store';
import { handlePostLoginSync } from '../services/ssoService';
import { useApolloClient, gql } from '@apollo/client';

// Session-level key to prevent repeated syncs on every page visit
const SYNC_DONE_KEY = 'localtunes_sync_done';

/**
 * All known first-level private/app route segments.
 * Public profile pages follow the pattern  /:username/*  where the first
 * segment is a username — NOT one of these reserved app routes.
 *
 * If the first path segment is NOT in this set, the page is a public
 * profile page and sync must be skipped entirely.
 */
const PRIVATE_ROUTE_SEGMENTS = new Set([
    '',                   // root "/"
    'home',
    'profile',
    'settings',
    'favorites',
    'login',
    'signup',
    'onboarding',
    'checkout',
    'subscription-plans',
    'music',
    '404',
]);

/**
 * Returns true if the pathname belongs to a public profile page
 * (the /:username/* pattern) and should NOT trigger any sync calls.
 */
function isPublicProfilePage(pathname: string): boolean {
    const firstSegment = pathname.split('/')[1] ?? '';
    return !PRIVATE_ROUTE_SEGMENTS.has(firstSegment);
}

/**
 * Handles background synchronisation with LocalTunes.
 *
 * Rules:
 *  1. NEVER fires on public profile pages ( /:username/* ) — avoids leaking
 *     auth-related XHR calls that are visible in DevTools to any visitor.
 *  2. NEVER fires on /onboarding — user has no Strapi account yet, so the
 *     sync fires too early: guestUrl cannot be saved (no account to write to)
 *     AND the sessionStorage gate blocks the real post-onboarding sync from
 *     ever running. This was the root cause of guestUrl never being saved.
 *  3. Fires at most ONCE per browser session (sessionStorage deduplication)
 *     so navigating between private pages doesn't re-trigger the sync.
 */
const AuthSyncManager = () => {
    const { user, isAuthenticated } = useAuthStore();
    const apolloClient = useApolloClient();
    const location = useLocation();
    const hasSynced = useRef(false);
    const isSyncing = useRef(false);

    useEffect(() => {
        // Rule 1 — skip entirely on public profile pages
        if (isPublicProfilePage(location.pathname)) {
            return;
        }

        // Rule 2 — NEVER sync during onboarding.
        // At this point the Strapi account record doesn't exist yet, so:
        //   - The Neon user gets created but guestUrl can't be written back
        //   - The SYNC_DONE_KEY is set, blocking the real post-onboarding sync
        //   - Onboarding's own sync call fails with 400 "user already exists"
        const firstSegment = location.pathname.split('/')[1] ?? '';
        if (firstSegment === 'onboarding') {
            return;
        }

        // Rule 3 — must be authenticated
        if (!isAuthenticated || !user) {
            return;
        }

        // Rule 4 — only once per session
        if (hasSynced.current || sessionStorage.getItem(SYNC_DONE_KEY) || isSyncing.current) {
            return;
        }

        isSyncing.current = true;

        const attemptSync = async () => {
            try {
                // Rule 5: User must have completed onboarding before we sync
                const { data } = await apolloClient.query({
                    query: gql`
                      query CheckOnboardingForSync($documentId: ID!) {
                        usersPermissionsUser(documentId: $documentId) {
                          accounts {
                            Account_Name
                            Account_Type
                            mobile_number
                          }
                        }
                      }
                    `,
                    variables: { documentId: user.documentId },
                    fetchPolicy: 'network-only' // Ensure we have the latest status
                });

                const account = data?.usersPermissionsUser?.accounts?.[0];
                const isOnboardingRequired =
                    !account ||
                    !account.Account_Name ||
                    !account.Account_Type ||
                    !account.mobile_number;

                if (isOnboardingRequired) {
                    console.log('Skipping LocalTunes sync: Onboarding is pending');
                    isSyncing.current = false;
                    return; // Skip sync, and DO NOT set SYNC_DONE_KEY, so it can run after onboarding
                }

                // If onboarding is complete, we can finalize the sync
                hasSynced.current = true;
                sessionStorage.setItem(SYNC_DONE_KEY, '1');

                await handlePostLoginSync(user, apolloClient);
                isSyncing.current = false;
            } catch (err) {
                console.error('Background LocalTunes check/sync failed:', err);
                hasSynced.current = false;
                isSyncing.current = false;
                sessionStorage.removeItem(SYNC_DONE_KEY);
            }
        };

        attemptSync();
    }, [isAuthenticated, user, apolloClient, location.pathname]);

    return null;
};

export default AuthSyncManager;
