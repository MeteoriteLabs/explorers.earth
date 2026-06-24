// Pure helpers for the Strapi-mediated Google OAuth flow. No React/Apollo/DOM
// imports so this is unit-testable in the node vitest env.
//
// Hardcoded Strapi hosts (NOT import.meta.env.VITE_REST_API_URL): in tunes that
// var is the same-origin "/api", which is correct for tunes' own backend but
// resolved Google OAuth to localtunes.earth and broke it. Mirrors explorers,
// which also hardcodes the Strapi backend for Google.
export const STRAPI_OAUTH_BASE = 'https://api.localqr.earth/api';
export const STRAPI_GRAPHQL_URL = 'https://api.localqr.earth/graphql';
export const TUNES_GOOGLE_CALLBACK_URL = 'https://localtunes.earth/google-auth/callback';

export function buildGoogleOAuthInitUrl(
  opts: { base?: string; callback?: string } = {},
): string {
  const base = opts.base ?? STRAPI_OAUTH_BASE;
  const callback = opts.callback ?? TUNES_GOOGLE_CALLBACK_URL;
  return `${base}/connect/google?callback=${encodeURIComponent(callback)}&prompt=select_account`;
}

export function parseAccessToken(search: string): string | null {
  return new URLSearchParams(search).get('access_token');
}

export interface StrapiMe {
  id?: number | string;
  documentId?: string;
  username: string;
  email: string;
  blocked?: boolean;
}

export interface TunesAuthUser {
  token: string;
  id: string;
  documentId: string;
  username: string;
  email: string;
  blocked: boolean;
}

export function mapStrapiMeToAuthUser(me: StrapiMe, token: string): TunesAuthUser {
  const id = String(me.id ?? me.documentId ?? '');
  return {
    token,
    id,
    documentId: me.documentId ?? id,
    username: me.username,
    email: me.email,
    blocked: me.blocked ?? false,
  };
}
