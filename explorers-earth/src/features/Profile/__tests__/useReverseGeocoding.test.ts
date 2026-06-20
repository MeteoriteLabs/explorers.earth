import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { toast } from 'sonner';
import { useReverseGeocoding } from '../hooks/useReverseGeocoding';
import { getCurrentLocation } from '../../../utils/getCurrentLocation';
import { mapAddressComponents } from '../../../utils/mapAddress';

vi.mock('axios');
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));
vi.mock('../../../utils/getCurrentLocation', () => ({
  getCurrentLocation: vi.fn(),
}));
vi.mock('../../../utils/mapAddress', () => ({
  mapAddressComponents: vi.fn(),
}));

describe('useReverseGeocoding hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with null and empty data', () => {
    const { result } = renderHook(() => useReverseGeocoding());
    expect(result.current.currentLocation).toBeNull();
    expect(result.current.mappedAddress).toEqual({});
  });

  it('handles get current location successfully', async () => {
    (getCurrentLocation as any).mockResolvedValue({ latitude: 10, longitude: 20 });
    
    const mockLocationData = { 
      address_components: [{ types: ['country'] }] 
    };
    (axios.get as any).mockResolvedValue({
      data: { results: [mockLocationData] }
    });

    const mockMappedAddress = { country: 'Test' };
    (mapAddressComponents as any).mockReturnValue(mockMappedAddress);

    const { result } = renderHook(() => useReverseGeocoding());

    let returnedLocation;
    await act(async () => {
      returnedLocation = await result.current.handleGetCurrentLocation();
    });

    expect(getCurrentLocation).toHaveBeenCalled();
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('latlng=10,20'));
    expect(mapAddressComponents).toHaveBeenCalledWith(mockLocationData.address_components);
    
    expect(returnedLocation).toEqual(mockLocationData);
    expect(result.current.currentLocation).toEqual(mockLocationData);
    expect(result.current.mappedAddress).toEqual(mockMappedAddress);
  });

  it('handles errors properly', async () => {
    (getCurrentLocation as any).mockRejectedValue(new Error('Permission denied'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useReverseGeocoding());

    await act(async () => {
      await expect(result.current.handleGetCurrentLocation()).rejects.toThrow('Permission denied');
    });

    expect(consoleSpy).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Failed to detect location. Please try again.');
    
    consoleSpy.mockRestore();
  });
});
