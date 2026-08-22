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

  it('tracks each pathname transition once and ignores query/hash-only changes', () => {
    mockUseLocation.mockReturnValue({ pathname: '/alice', search: '', hash: '' });
    const { rerender } = renderHook(() => usePageTracking());

    mockUseLocation.mockReturnValue({ pathname: '/alice/apps', search: '', hash: '' });
    rerender();
    mockUseLocation.mockReturnValue({ pathname: '/alice/products/list-a', search: '', hash: '' });
    rerender();
    mockUseLocation.mockReturnValue({
      pathname: '/alice/products/list-a',
      search: '?utm_source=qa',
      hash: '#details',
    });
    rerender();

    expect(window.gtag).toHaveBeenCalledTimes(3);
    expect(window.gtag).toHaveBeenNthCalledWith(1, 'config', 'G-C3QBWP3ZSK', { page_path: '/alice' });
    expect(window.gtag).toHaveBeenNthCalledWith(2, 'config', 'G-C3QBWP3ZSK', { page_path: '/alice/apps' });
    expect(window.gtag).toHaveBeenNthCalledWith(3, 'config', 'G-C3QBWP3ZSK', { page_path: '/alice/products/list-a' });
  });
});
