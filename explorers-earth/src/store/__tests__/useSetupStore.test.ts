import { describe, it, expect, beforeEach } from 'vitest';
import useSetupStore from '../useSetupStore';

describe('useSetupStore', () => {
  beforeEach(() => {
    // Clear the store state and localStorage before each test
    useSetupStore.setState({ isProfileComplete: false, isRecommendationsComplete: false });
    localStorage.clear();
  });

  it('should have initial state as false', () => {
    const state = useSetupStore.getState();
    expect(state.isProfileComplete).toBe(false);
    expect(state.isRecommendationsComplete).toBe(false);
  });

  it('should update setup status when setSetupStatus is called', () => {
    useSetupStore.getState().setSetupStatus(true, true);
    
    let state = useSetupStore.getState();
    expect(state.isProfileComplete).toBe(true);
    expect(state.isRecommendationsComplete).toBe(true);

    useSetupStore.getState().setSetupStatus(true, false);
    
    state = useSetupStore.getState();
    expect(state.isProfileComplete).toBe(true);
    expect(state.isRecommendationsComplete).toBe(false);
  });

  it('should persist setup state to localStorage', () => {
    useSetupStore.getState().setSetupStatus(true, false);
    
    const storedStr = localStorage.getItem('setup-storage');
    expect(storedStr).not.toBeNull();
    
    if (storedStr) {
      const stored = JSON.parse(storedStr);
      expect(stored.state.isProfileComplete).toBe(true);
      expect(stored.state.isRecommendationsComplete).toBe(false);
    }
  });

  it('does not carry completion from account A to account B', () => {
    useSetupStore.getState().bindAccount('account-a', 'complete');
    useSetupStore.getState().setSetupStatus(true, true, 'account-a');
    useSetupStore.getState().bindAccount('account-b', 'incomplete');
    expect(useSetupStore.getState().isProfileComplete).toBe(false);
    expect(useSetupStore.getState().isRecommendationsComplete).toBe(false);
    useSetupStore.getState().setSetupStatus(true, true, 'account-a');
    expect(useSetupStore.getState().isRecommendationsComplete).toBe(false);
  });
});
