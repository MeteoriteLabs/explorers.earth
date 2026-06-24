import { describe, it, expect } from 'vitest';
import {
  EXPLORERS_TUNES_SSO_URL,
  parseAccessToken,
  mapStrapiMeToAuthUser,
  STRAPI_GRAPHQL_URL,
} from './google-auth';

describe('EXPLORERS_TUNES_SSO_URL', () => {
  it('points at the explorers SSO entry (single Strapi callback constraint)', () => {
    expect(EXPLORERS_TUNES_SSO_URL).toBe('https://explorers.earth/sso/tunes');
  });
});

describe('parseAccessToken', () => {
  it('extracts access_token from the callback query', () => {
    expect(parseAccessToken('?access_token=abc.def&x=1')).toBe('abc.def');
  });
  it('returns null when absent', () => {
    expect(parseAccessToken('?x=1')).toBeNull();
    expect(parseAccessToken('')).toBeNull();
  });
});

describe('mapStrapiMeToAuthUser', () => {
  it('maps a Strapi me result + token to the authStore payload', () => {
    const u = mapStrapiMeToAuthUser(
      { id: 5, documentId: 'doc1', username: 'alice', email: 'a@x.com', blocked: false },
      'jwt-token',
    );
    expect(u).toEqual({
      token: 'jwt-token', id: '5', documentId: 'doc1',
      username: 'alice', email: 'a@x.com', blocked: false,
    });
  });
  it('falls back documentId→id and blocked→false when missing', () => {
    const u = mapStrapiMeToAuthUser({ id: 9, username: 'bob', email: 'b@x.com' }, 't');
    expect(u.documentId).toBe('9');
    expect(u.blocked).toBe(false);
  });
});

describe('STRAPI_GRAPHQL_URL', () => {
  it('is the absolute Strapi graphql endpoint (CORS-confirmed)', () => {
    expect(STRAPI_GRAPHQL_URL).toBe('https://api.localqr.earth/graphql');
  });
});
