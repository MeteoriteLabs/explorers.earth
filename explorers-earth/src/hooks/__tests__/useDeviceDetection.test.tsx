import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import useDeviceDetection from '../useDeviceDetection';

describe('useDeviceDetection hook', () => {
  let originalInnerWidth: number;

  beforeAll(() => {
    originalInnerWidth = window.innerWidth;
  });

  afterAll(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('detects desktop initially', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    const { result } = renderHook(() => useDeviceDetection());
    expect(result.current.isDesktop).toBe(true);
  });

  it('detects mobile initially', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });
    
    const { result } = renderHook(() => useDeviceDetection());
    expect(result.current.isDesktop).toBe(false);
  });

  it('updates on resize event', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    const { result } = renderHook(() => useDeviceDetection());
    expect(result.current.isDesktop).toBe(true);

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.isDesktop).toBe(false);

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.isDesktop).toBe(true);
  });
});
