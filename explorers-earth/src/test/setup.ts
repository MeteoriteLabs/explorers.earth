/**
 * Vitest Global Setup
 * Runs before every test file.
 */
import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// ── Test env: provide IGDB credentials so igdbService doesn't short-circuit ──
// igdbService reads these at module load; they must be set before any test
// file imports it, so this lives in the global setup (runs first).
vi.stubEnv('VITE_IGDB_CLIENT_ID', 'test-client-id');
vi.stubEnv('VITE_IGDB_CLIENT_SECRET', 'test-client-secret');

// Automatically clean up DOM and env stubs after each test
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

// ── localStorage / sessionStorage mock ──────────────────────────────────────
const storageMock = (): Storage => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage;
};

Object.defineProperty(window, 'localStorage', { value: storageMock() });
Object.defineProperty(window, 'sessionStorage', { value: storageMock() });

// ── window.matchMedia mock ───────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── window.ResizeObserver mock ───────────────────────────────────────────────
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ── IntersectionObserver mock ────────────────────────────────────────────────
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
