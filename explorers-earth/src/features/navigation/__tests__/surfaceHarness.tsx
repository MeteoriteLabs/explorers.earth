import React from 'react';
import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, Observable } from '@apollo/client';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CategoryNavigationProvider, useCategoryNavigation } from '../CategoryNavigationProvider';
import { MusicPublishProvider } from '../../music/MusicPublishProvider';
import type { MusicPinVerifier } from '../accountNavigationWriter';
import useAuthStore from '../../../store/store';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import english from '../../../i18n/resources/en.json';
const surfaceTranslations = createInstance();
void surfaceTranslations.init({ lng: 'en', resources: { en: { translation: english } }, showSupportNotice: false });

export const ordinaryCategories = ['public_recommendations', 'public_movie', 'public_books', 'public_games', 'public_apps', 'public_products', 'public_people', 'public_guides'] as const;
export function loginSurface(id = 'u1') {
  useAuthStore.getState().login({ id, documentId: id, username: 'owner', email: 'owner@example.test', blocked: false, token: `test-${id}` });
}
export function surfaceAccount(extra: Record<string, unknown> = {}) {
  return { __typename: 'Account', documentId: 'a1', Account_Name: 'Owner', Account_Type: 'Personal', mobile_number: '123', public_profile: 'Yes', public_music: 'Yes',
    public_recommendations: 'Yes', public_movie: 'Yes', public_books: 'Yes', public_games: 'Yes', public_apps: 'Yes', public_products: 'Yes', public_people: 'Yes', public_guides: 'Yes',
    pinned_nav_tabs: ['public_profile', 'public_music', 'public_books'], auto_pinning: false, ...extra };
}
export function surfaceHarness(child: React.ReactNode, options: { initial?: Record<string, unknown>; incompleteFirst?: boolean; route?: string | { pathname: string; state: unknown }; lists?: Record<string, unknown>; content?: Record<string, unknown>; verifyMusicPin?: MusicPinVerifier; respond?: (name: string, variables: any) => any } = {}) {
  let saved = surfaceAccount(options.initial);
  let failMutation = false;
  let failLists = false;
  let pauseMutation: Promise<void> | undefined;
  let navigation!: ReturnType<typeof useCategoryNavigation>;
  const requests: { name: string; variables: any }[] = [];
  const content = options.content ?? Object.fromEntries(['recommendationLists', 'movieLists', 'bookLists', 'gameLists', 'appLists', 'productLists', 'personLists', 'guides'].map(key => [key, [{ documentId: `${key}-1` }]]));
  const client = new ApolloClient({ cache: new InMemoryCache({ typePolicies: { Account: { keyFields: ['documentId'] }, UsersPermissionsUser: { keyFields: ['documentId'] } } }),
    link: new ApolloLink(op => new Observable(observer => {
      requests.push({ name: op.operationName, variables: op.variables });
      const selection = (op.query.definitions.find((d: any) => d.kind === 'OperationDefinition') as any).selectionSet;
      const complete = (selection: any, value: any): any => {
        if (value === null) return null;
        if (Array.isArray(value)) return value.map(item => complete(selection, item));
        return Object.fromEntries(selection.selections.filter((s: any) => s.kind === 'Field').map((s: any) => {
          const key = s.name.value; const next = value?.[key] ?? null;
          return [s.alias?.value ?? key, s.selectionSet && next !== null ? complete(s.selectionSet, next) : next];
        }));
      };
      const respond = async () => {
        const custom = options.respond?.(op.operationName, op.variables);
        if (custom !== undefined) return custom;
        if (op.operationName === 'UpdateTabVisibility' || op.query.definitions.some((d: any) => d.operation === 'mutation' && d.selectionSet.selections.some((s: any) => s.name.value === 'updateAccount'))) {
          if (pauseMutation) await pauseMutation;
          if (failMutation) throw new Error('Save unavailable');
          saved = { ...saved, ...op.variables.data };
          return { updateAccount: saved };
        }
        if (op.operationName === 'CheckPublishedLists') {
          if (failLists) throw new Error('Lists unavailable');
          return content;
        }
        if (failLists && selection.selections.some((s: any) => /Lists$|^guides$/.test(s.name?.value))) throw new Error('Lists unavailable');
        const candidates = options.incompleteFirst ? [surfaceAccount({ documentId: 'incomplete', Account_Name: null, mobile_number: null, ...Object.fromEntries(ordinaryCategories.map(c => [c, 'No'])) }), saved] : [saved];
        const user = { __typename: 'UsersPermissionsUser', documentId: op.variables.documentId || 'u1', provider: 'google', confirmed: true, blocked: false, accounts: candidates };
        const base: any = { usersPermissionsUser: user, accounts: [saved], recommendationLists: [], movieLists: [], bookLists: [], gameLists: [], appLists: [], productLists: [], personLists: [], guides: [], ...options.lists };
        // Complete unrelated query fields at the network boundary, not the hook.
        return base;
      };
      void respond().then(data => { observer.next({ data: complete(selection, data) }); observer.complete(); }, error => observer.error(error));
    })) });
  function Probe() { navigation = useCategoryNavigation(); return null; }
  const tree = (children: React.ReactNode) => <ApolloProvider client={client}><MemoryRouter initialEntries={[options.route ?? '/']}><I18nextProvider i18n={surfaceTranslations}><CategoryNavigationProvider verifyMusicPin={options.verifyMusicPin ?? (async () => 'public')}><MusicPublishProvider><Probe />{children}</MusicPublishProvider></CategoryNavigationProvider></I18nextProvider></MemoryRouter></ApolloProvider>;
  const view = render(tree(child));
  return { ...view, client, requests, get navigation() { return navigation; }, get saved() { return saved; }, set saved(value) { saved = value; },
    set failMutation(value: boolean) { failMutation = value; }, set failLists(value: boolean) { failLists = value; },
    pauseMutation(value?: Promise<void>) { pauseMutation = value; },
    rerenderChild(next: React.ReactNode) { view.rerender(tree(next)); },
    get writes() { return requests.filter(r => r.variables.data && Object.keys(r.variables.data).some(k => k.startsWith('public_') || k === 'pinned_nav_tabs' || k === 'auto_pinning')); },
    ready: () => waitFor(() => { if (!navigation.authority) throw new Error('Waiting for verified navigation'); }),
  };
}
