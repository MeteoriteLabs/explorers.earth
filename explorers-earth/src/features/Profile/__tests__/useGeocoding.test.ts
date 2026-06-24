import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import useGeocoding from '../hooks/useGeocoding';

vi.mock('axios');

describe('useGeocoding hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch if address is missing', () => {
    renderHook(() => useGeocoding(null as any));
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('fetches geocoding result on valid address', async () => {
    const mockResult = { place_id: 'test_place' };
    (axios.get as any).mockResolvedValue({
      data: { results: [mockResult] }
    });

    // Provide an address object that formatAddress can process
    const address = { street: '123 Test St', city: 'Test City', country: 'Test Country' };
    
    const { result } = renderHook(() => useGeocoding(address as any));

    expect(result.current.mapData).toBeNull();

    await act(async () => {
      // Wait for useEffect promise
      await Promise.resolve();
    });

    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('address='));
    expect(result.current.mapData).toEqual(mockResult);
  });

  it('handles API errors gracefully', async () => {
    (axios.get as any).mockRejectedValue(new Error('API error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const address = { city: 'Test City' };
    const { result } = renderHook(() => useGeocoding(address as any));

    await act(async () => {
      await Promise.resolve();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Error fetching geocoding data:', expect.any(Error));
    expect(result.current.mapData).toBeNull();

    consoleSpy.mockRestore();
  });
});
