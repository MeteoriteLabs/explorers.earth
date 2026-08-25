import { describe, it, expect, vi } from 'vitest';
import { InMemoryCache, gql } from '@apollo/client';
import { typePolicies } from '../apolloCache';

const BOOK_LISTS = gql`
  query BookLists {
    bookLists {
      documentId
      visibility
      List_Name
      __typename
    }
  }
`;

function seedDraftList(cache: InMemoryCache) {
  cache.writeQuery({
    query: BOOK_LISTS,
    data: {
      bookLists: [
        { __typename: 'BookList', documentId: 'abc123', visibility: false, List_Name: 'My Reads' },
      ],
    },
  });
}

const PUBLISH = gql`fragment Published on BookList { visibility }`;

describe('apollo typePolicies — documentId normalization (publish-label fix)', () => {
  // All three list types share the documentId policy (Codex P2 #2).
  it.each(['BookList', 'GameList', 'MovieList'])('identifies a %s by documentId', (__typename) => {
    const cache = new InMemoryCache({ typePolicies });
    // Apollo encodes an array keyFields as `BookList:{"documentId":"abc123"}`.
    const id = cache.identify({ __typename, documentId: 'abc123' });
    expect(id).toBeTruthy();
    expect(id).toContain('abc123');
  });

  it.each(['Account', 'UsersPermissionsUser'])("identifies immutable Music profile entities by documentId", (__typename) => {
    const cache = new InMemoryCache({ typePolicies });
    const id = cache.identify({ __typename, documentId: "immutable-document-1" });
    expect(id).toContain("immutable-document-1");
  });

  it("embeds legacy partial profile objects without an Apollo missing-documentId warning", () => {
    const cache = new InMemoryCache({ typePolicies });
    const warn = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const partial = gql`query PartialAccount { accounts { Account_Name __typename } }`;

    expect(() => cache.writeQuery({
      query: partial,
      data: { accounts: [{ __typename: "Account", Account_Name: "Partial" }] },
    })).not.toThrow();
    expect(warn).not.toHaveBeenCalled();
  });

  it('a publish mutation result patches the rendered list entity with NO refetch', () => {
    const cache = new InMemoryCache({ typePolicies });
    seedDraftList(cache);

    // Simulate the publish mutation returning { documentId, visibility: true }.
    cache.writeFragment({
      id: cache.identify({ __typename: 'BookList', documentId: 'abc123' }),
      fragment: PUBLISH,
      data: { visibility: true },
    });

    const result = cache.readQuery<{ bookLists: Array<{ visibility: boolean }> }>({ query: BOOK_LISTS });
    expect(result?.bookLists[0].visibility).toBe(true); // label flips, no refetch
  });

  it('WITHOUT normalization the same patch never reaches the list (proves the fix matters)', () => {
    const cache = new InMemoryCache(); // default: keys by `id`, which Strapi v5 lacks
    seedDraftList(cache);

    expect(cache.identify({ __typename: 'BookList', documentId: 'abc123' })).toBeUndefined();
    cache.writeFragment({
      id: 'BookList:abc123', // the id a normalized cache WOULD use
      fragment: PUBLISH,
      data: { visibility: true },
    });

    const result = cache.readQuery<{ bookLists: Array<{ visibility: boolean }> }>({ query: BOOK_LISTS });
    expect(result?.bookLists[0].visibility).toBe(false); // stays "Draft" — the bug
  });
});
