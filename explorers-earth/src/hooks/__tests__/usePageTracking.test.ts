import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePageTracking from '../usePageTracking';

const mockUseLocation = vi.fn();
vi.mock('react-router-dom', () => ({
  useLocation: () => mockUseLocation(),
}));

describe('usePageTracking hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.gtag = vi.fn();
  });

  it('calls gtag on route change', () => {
    mockUseLocation.mockReturnValue({ pathname: '/about' });

    renderHook(() => usePageTracking());

    expect(window.gtag).toHaveBeenCalledWith('config', 'G-C3QBWP3ZSK', {
      page_path: '/about',
    });
  });

  it('does not throw if gtag is undefined', () => {
    delete window.gtag;
    mockUseLocation.mockReturnValue({ pathname: '/home' });

    expect(() => renderHook(() => usePageTracking())).not.toThrow();
  });
});
