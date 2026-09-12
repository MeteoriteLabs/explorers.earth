import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, Observable } from '@apollo/client';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MobileLayout from '../MobileLayout';
import DashboardLayout from '../DashboardLayout';
import { useCategoryNavigation } from '../../features/navigation/CategoryNavigationProvider';
import { useMusicPublish } from '../../features/music/MusicPublishProvider';
import { loginSurface, surfaceAccount } from '../../features/navigation/__tests__/surfaceHarness';
import useAuthStore from '../../store/store';

vi.mock('../../components/Header', () => ({ default: () => null }));
vi.mock('../../components/Navbar', () => ({ default: () => null }));
vi.mock('../../components/Sidenav', () => ({ default: () => null }));
vi.mock('../../components/RouteLoader', () => ({ default: () => null }));
vi.mock('../../components/EarthLoader', () => ({ EarthLoader: () => null }));
vi.mock('../../routes/validators', () => ({ DashboardRouteValidator: ({ children }: any) => children }));

function Consumer() {
  const navigation = useCategoryNavigation();
  const music = useMusicPublish(navigation.authority, { ready: false });
  return <div data-testid="publication-consumer">{navigation.authority?.accountDocumentId}:{music.state.kind}</div>;
}

describe('real publication providers at each dashboard layout Outlet', () => {
  beforeEach(() => { loginSurface(); localStorage.setItem('dashboard-theme', 'light'); vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined); });
  afterEach(() => { cleanup(); useAuthStore.getState().logout(); vi.restoreAllMocks(); });
  it('cold mobile and desktop/remount provide verified category scope with inert not-ready Music', async () => {
    const operations: string[] = [];
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No transport authorized'));
    const client = new ApolloClient({ cache: new InMemoryCache(), link: new ApolloLink(operation => new Observable(observer => {
      operations.push(operation.operationName);
      observer.next({ data: { usersPermissionsUser: { __typename: 'UsersPermissionsUser', documentId: 'u1', provider: 'google', confirmed: true, blocked: false, accounts: [surfaceAccount()] } } });
      observer.complete();
    })) });
    const tree = (mobile: boolean) => <ApolloProvider client={client}><MemoryRouter><Routes><Route element={mobile ? <MobileLayout /> : <DashboardLayout />}><Route index element={<Consumer />} /></Route></Routes></MemoryRouter></ApolloProvider>;
    const view = render(tree(true));
    await waitFor(() => expect(screen.getByTestId('publication-consumer')).toHaveTextContent('a1:unknown'));
    view.rerender(tree(false));
    await waitFor(() => expect(screen.getByTestId('publication-consumer')).toHaveTextContent('a1:unknown'));
    view.rerender(tree(true));
    await waitFor(() => expect(screen.getByTestId('publication-consumer')).toHaveTextContent('a1:unknown'));
    expect(operations.length).toBeGreaterThan(0); expect(operations.every(name => name === 'CategoryNavigationAccount')).toBe(true);
    expect(fetch).not.toHaveBeenCalled(); client.stop();
  });
});
