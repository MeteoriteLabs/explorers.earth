import { describe, it, expect, beforeEach } from 'vitest';
import useEmailStore from '../useEmailStore';

describe('useEmailStore', () => {
  beforeEach(() => {
    // Clear the store state and localStorage before each test
    useEmailStore.setState({ email: null });
    localStorage.clear();
  });

  it('should have initial state email as null', () => {
    const state = useEmailStore.getState();
    expect(state.email).toBeNull();
  });

  it('should set email when setEmail is called', () => {
    useEmailStore.getState().setEmail({ email: 'test@example.com' });
    
    const state = useEmailStore.getState();
    expect(state.email).toBe('test@example.com');
  });

  it('should persist email state to localStorage', () => {
    useEmailStore.getState().setEmail({ email: 'persist@example.com' });
    
    const storedStr = localStorage.getItem('email');
    expect(storedStr).not.toBeNull();
    
    if (storedStr) {
      const stored = JSON.parse(storedStr);
      expect(stored.state.email).toBe('persist@example.com');
    }
  });
});
