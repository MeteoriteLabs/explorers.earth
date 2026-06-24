// Pure helpers for the Strapi-mediated Google OAuth flow. No React/Apollo/DOM
// imports so this is unit-testable in the node vitest env.
//
// Tunes can't run its own Strapi Google callback (Strapi allows ONE callback,
// owned by explorers). The login button hands off to explorers' /sso/tunes,
// which logs the user in and forwards the Strapi JWT back to tunes'
// /google-auth/callback (consumed by parseAccessToken/mapStrapiMeToAuthUser).
export const EXPLORERS_TUNES_SSO_URL = 'https://explorers.earth/sso/tunes';
// Strapi GraphQL endpoint the callback page queries `me` against (CORS-allowed
// from this origin, unlike Strapi REST).
export const STRAPI_GRAPHQL_URL = 'https://api.localqr.earth/graphql';

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
