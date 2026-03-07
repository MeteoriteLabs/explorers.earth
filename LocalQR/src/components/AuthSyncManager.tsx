import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../store/store';
import { handlePostLoginSync } from '../services/ssoService';
import { useApolloClient } from '@apollo/client';

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
 *  2. Fires at most ONCE per browser session (sessionStorage deduplication)
 *     so navigating between private pages doesn't re-trigger the sync.
 */
const AuthSyncManager = () => {
    const { user, isAuthenticated } = useAuthStore();
    const apolloClient = useApolloClient();
    const location = useLocation();
    const hasSynced = useRef(false);

    useEffect(() => {
        // Rule 1 — skip entirely on public profile pages
        if (isPublicProfilePage(location.pathname)) {
            return;
        }

        // Rule 2 — must be authenticated
        if (!isAuthenticated || !user) {
            return;
        }

        // Rule 3 — only once per session
        if (hasSynced.current || sessionStorage.getItem(SYNC_DONE_KEY)) {
            return;
        }

        hasSynced.current = true;
        sessionStorage.setItem(SYNC_DONE_KEY, '1');

        handlePostLoginSync(user, apolloClient).catch(err => {
            console.error('Background LocalTunes sync failed:', err);
            // Allow a retry on the next navigation if it failed
            hasSynced.current = false;
            sessionStorage.removeItem(SYNC_DONE_KEY);
        });
    }, [isAuthenticated, user, apolloClient, location.pathname]);

    return null;
};

export default AuthSyncManager;
