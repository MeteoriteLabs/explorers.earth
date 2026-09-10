import { ApolloClient, ApolloLink, InMemoryCache, Observable } from '@apollo/client';
import { describe, expect, it } from 'vitest';
import { createCategoryNavigationApi } from '../categoryNavigationApi';

const origin = { userDocumentId: 'u1', accountDocumentId: 'a1', generation: 1 };
function account(extra = {}) { return { documentId: 'a1', Account_Name: 'Owner', Account_Type: 'Personal', mobile_number: '123', public_profile: 'Yes', public_music: 'Yes', public_recommendations: 'Yes', public_guides: 'Yes', public_movie: 'Yes', public_books: 'Yes', public_games: 'Yes', public_apps: 'Yes', public_products: 'Yes', public_people: 'Yes', auto_pinning: false, pinned_nav_tabs: ['public_profile', 'public_music'], ...extra }; }
function user(accounts: unknown[] = [account()], extra = {}) { return { usersPermissionsUser: { documentId: 'u1', confirmed: true, provider: 'local', blocked: false, accounts, ...extra } }; }
function harness(responses: (object | Error)[]) {
  const requests: { name: string; variables: Record<string, unknown> }[] = [];
  const client = new ApolloClient({ cache: new InMemoryCache(), link: new ApolloLink((op) => new Observable((observer) => {
    requests.push({ name: op.operationName, variables: op.variables });
    const response = responses.shift();
    if (response instanceof Error) observer.error(response);
    else { observer.next({ data: response }); observer.complete(); }
  })) });
  return { requests, api: createCategoryNavigationApi({ client, isCurrent: () => true }) };
}

describe('verified navigation account API', () => {
  it('selects the unique completed account, not accounts[0], and preserves fresh saved pins', async () => {
    const { api, requests } = harness([user([{ documentId: 'unfinished', Account_Name: null, Account_Type: null, mobile_number: null }, account()])]);
    const result = await api.read(origin);
    expect(result.scope).toEqual({ userDocumentId: 'u1', accountDocumentId: 'a1' });
    expect(result.savedPins).toEqual(['public_profile', 'public_music']);
    expect(requests).toEqual([{ name: 'CategoryNavigationAccount', variables: { documentId: 'u1' } }]);
  });
  it.each([null, undefined])('preserves authoritative pin storage %s without defaulting to an empty array', async (pinned_nav_tabs) => {
    const { api } = harness([user([account({ pinned_nav_tabs })])]);
    expect((await api.read(origin)).savedPins).toBe(pinned_nav_tabs);
  });
  it.each([
    user([account()], { documentId: 'other' }), user([account()], { confirmed: false }),
    user([account()], { blocked: true }), user([account(), account({ documentId: 'a2' })]),
    user([account({ documentId: 'a2' })]),
  ])('rejects wrong, unverified, blocked, ambiguous or changed ownership', async (response) => {
    await expect(harness([response]).api.read(origin)).rejects.toBeDefined();
  });
  it.each([
    null, {}, account({ documentId: 'wrong' }), account({ pinned_nav_tabs: ['public_books', 'public_profile'] }),
  ])('rejects unconfirmed mutation data and never blindly rolls back', async (saved) => {
    const { api, requests } = harness([{ updateAccount: saved }]);
    await expect(api.commit(origin, { pinned_nav_tabs: ['public_profile', 'public_books'] })).rejects.toMatchObject({ kind: 'uncertain' });
    expect(requests).toHaveLength(1);
  });
  it('checks every patch field, then re-reads and confirms exact order', async () => {
    const saved = account({ public_books: 'No', pinned_nav_tabs: ['public_profile', 'public_music'] });
    const { api, requests } = harness([{ updateAccount: saved }, user([saved])]);
    const result = await api.commit(origin, { public_books: 'No', pinned_nav_tabs: ['public_profile', 'public_music'] });
    expect(result.visibility.public_books).toBe('No');
    expect(requests.map((r) => r.name)).toEqual(['UpdateTabVisibility', 'CategoryNavigationAccount']);
    expect(requests[0].variables).toEqual({ documentId: 'a1', data: { public_books: 'No', pinned_nav_tabs: ['public_profile', 'public_music'] } });
  });
  it.each([new Error('refetch failed'), user([account({ auto_pinning: false })])])('never confirms a successful response followed by lost/contradictory verification', async (response) => {
    const { api } = harness([{ updateAccount: account({ auto_pinning: true }) }, response]);
    await expect(api.commit(origin, { auto_pinning: true })).rejects.toMatchObject({ kind: response instanceof Error ? 'uncertain' : 'conflict' });
  });
  it('reports a lost mutation response as uncertain', async () => {
    await expect(harness([new Error('lost')]).api.commit(origin, { auto_pinning: true })).rejects.toMatchObject({ kind: 'uncertain' });
  });
  it('reports invalid authoritative verification after a successful mutation as uncertain', async () => {
    const { api } = harness([{ updateAccount: account({ auto_pinning: true }) }, user([], { confirmed: false })]);
    await expect(api.commit(origin, { auto_pinning: true })).rejects.toMatchObject({ kind: 'uncertain' });
  });
  it('fresh-checks published content and distinguishes empty from unavailable', async () => {
    const lists = { bookLists: [], gameLists: [], appLists: [], productLists: [], movieLists: [], personLists: [], guides: [], recommendationLists: [] };
    const { api, requests } = harness([{ ...lists, bookLists: [{ documentId: 'b1' }] }, lists, new Error('outage')]);
    expect(await api.eligibility('public_books', origin)).toBe('allowed');
    expect(await api.eligibility('public_books', origin)).toBe('no-content');
    expect(await api.eligibility('public_books', origin)).toBe('unknown');
    expect(requests.every((r) => r.variables.accountDocumentId === 'a1')).toBe(true);
  });
});
