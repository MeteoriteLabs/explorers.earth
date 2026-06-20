import { describe, it, expect, beforeEach } from 'vitest';
import useAuthStore from '../store';

describe('useAuthStore', () => {
  const initialData = {
    id: 'user123',
    documentId: 'doc123',
    username: 'testuser',
    email: 'test@example.com',
    blocked: false,
    token: 'fake-jwt-token'
  };

  beforeEach(() => {
    // Clear the store and localStorage before each test
    useAuthStore.getState().logout();
    localStorage.clear();
  });

  it('should have correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('should update state on login', () => {
    useAuthStore.getState().login(initialData);
    const state = useAuthStore.getState();

    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('fake-jwt-token');
    expect(state.user).toEqual({
      id: 'user123',
      documentId: 'doc123',
      username: 'testuser',
      email: 'test@example.com',
      blocked: false
    });
  });

  it('should clear state on logout', () => {
    // First login
    useAuthStore.getState().login(initialData);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    // Then logout
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();

    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
  });

  it('should update user blocked status', () => {
    // Login
    useAuthStore.getState().login(initialData);
    
    // Update blocked status
    useAuthStore.getState().updateUserBlocked(true);
    
    let state = useAuthStore.getState();
    expect(state.user?.blocked).toBe(true);
    
    // Update blocked status again
    useAuthStore.getState().updateUserBlocked(false);
    
    state = useAuthStore.getState();
    expect(state.user?.blocked).toBe(false);
  });

  it('should not update user blocked status if user is null', () => {
    useAuthStore.getState().updateUserBlocked(true);
    const state = useAuthStore.getState();
    
    expect(state.user).toBeNull();
  });

  it('should persist state to localStorage', () => {
    // Note: Vitest jsdom provides localStorage
    useAuthStore.getState().login(initialData);
    
    const storedStr = localStorage.getItem('auth-storage');
    expect(storedStr).not.toBeNull();
    
    if (storedStr) {
      const stored = JSON.parse(storedStr);
      expect(stored.state.isAuthenticated).toBe(true);
      expect(stored.state.token).toBe('fake-jwt-token');
      expect(stored.state.user.username).toBe('testuser');
    }
  });
});
