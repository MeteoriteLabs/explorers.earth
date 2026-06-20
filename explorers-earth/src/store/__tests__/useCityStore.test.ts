import { describe, it, expect, beforeEach } from 'vitest';
import { useCityStore, selectedCity } from '../useCityStore';

describe('useCityStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useCityStore.setState({ selectedCity: null });
  });

  it('should have initial state selectedCity as null', () => {
    const state = useCityStore.getState();
    expect(state.selectedCity).toBeNull();
  });

  it('should update selectedCity when setSelectedCity is called', () => {
    const mockCity: selectedCity = {
      documentId: 'city123',
      List_Name: 'My Favorite Places',
      slug: 'my-favorite-places',
      Visibility: true
    };

    useCityStore.getState().setSelectedCity(mockCity);
    
    const state = useCityStore.getState();
    expect(state.selectedCity).toEqual(mockCity);
  });

  it('should set selectedCity to null', () => {
    const mockCity: selectedCity = {
      documentId: 'city123',
      List_Name: 'My Favorite Places'
    };

    // First set it
    useCityStore.getState().setSelectedCity(mockCity);
    expect(useCityStore.getState().selectedCity).not.toBeNull();

    // Then clear it
    useCityStore.getState().setSelectedCity(null);
    expect(useCityStore.getState().selectedCity).toBeNull();
  });
});
