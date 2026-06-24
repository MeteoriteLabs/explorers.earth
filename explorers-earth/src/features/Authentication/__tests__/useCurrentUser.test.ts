import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuery } from '@apollo/client';
import useAuthStore from '../../../store/store';
import { useCurrentUser, useUserForOnboarding } from '../hooks/useCurrentUser';

vi.mock('@apollo/client', () => ({
  useQuery: vi.fn(),
  gql: (strings: TemplateStringsArray, ...values: any[]) => String.raw({ raw: strings }, ...values),
}));

vi.mock('../../../store/store', () => ({
  default: vi.fn(),
}));

describe('useCurrentUser hook', () => {
  const mockRefetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips query if not authenticated', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isAuthenticated: false,
      token: null,
    });
    
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderHook(() => useCurrentUser());

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skip: true,
      })
    );
  });

  it('skips query if skipQuery option is true', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { documentId: 'doc_1', username: 'john' },
      isAuthenticated: true,
      token: 'token_1',
    });
    
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderHook(() => useCurrentUser({ skipQuery: true }));

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skip: true,
      })
    );
  });

  it('runs query if authenticated and skipQuery is false', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { documentId: 'doc_1', username: 'john' },
      isAuthenticated: true,
      token: 'token_1',
    });
    
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { usersPermissionsUser: { username: 'john' } },
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        skip: false,
        variables: { documentId: 'doc_1' }
      })
    );

    expect(result.current.user).toEqual({ username: 'john' });
    expect(result.current.username).toBe('john');
    expect(result.current.isUsernameSynced).toBe(true);
    expect(result.current.isReady).toBeTruthy();
    expect(result.current.isEmpty).toBeFalsy();
  });

  it('detects desynced username', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { documentId: 'doc_1', username: 'old_john' },
      isAuthenticated: true,
      token: 'token_1',
    });
    
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { usersPermissionsUser: { username: 'new_john' } },
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.username).toBe('new_john'); // falls back to fetched data
    expect(result.current.isUsernameSynced).toBe(false);
  });

  it('uses onboarding query when onboardingOnly is true', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { documentId: 'doc_1', username: 'john' },
      isAuthenticated: true,
      token: 'token_1',
    });
    
    (useQuery as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: { usersPermissionsUser: { username: 'john', email: 'j@j.com' } },
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    renderHook(() => useUserForOnboarding());

    expect(useQuery).toHaveBeenCalledWith(
      expect.anything(), // GET_USER_FOR_ONBOARDING
      expect.objectContaining({
        skip: false,
      })
    );
  });
});
