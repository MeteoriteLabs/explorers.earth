import React from 'react';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecommendationsHub from '../RecommendationsHub';
import { loginSurface, ordinaryCategories, surfaceHarness } from '../../features/navigation/__tests__/surfaceHarness';
import useAuthStore from '../../store/store';
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../../features/music/publicMusicClient', () => ({ publicMusicClient: { discover: vi.fn().mockRejectedValue(new Error('offline')) } }));
// Decorative SVG path animation is unrelated to consent and emits an existing
// undefined-stroke warning in jsdom. Keep the actual controls and other motion.
vi.mock('framer-motion', async original => {
  const actual = await original<typeof import('framer-motion')>();
  const { createElement, forwardRef } = await import('react');
  const Path = forwardRef<SVGPathElement, any>(({ animate, initial, transition, exit, whileHover, ...props }, ref) => createElement('path', { ...props, ref }));
  return { ...actual, motion: new Proxy(actual.motion, { get: (target, key) => key === 'path' ? Path : Reflect.get(target, key) }) };
});
describe('Hub navigation consent', () => {
  beforeEach(() => loginSurface()); afterEach(() => { cleanup(); useAuthStore.getState().logout(); });
  async function openBooks() { fireEvent.click((await screen.findAllByTitle('Category options'))[2]); }
  async function openCategory(category: string) { fireEvent.click((await screen.findAllByTitle('Category options'))[ordinaryCategories.indexOf(category as any)]); }
  it.each(ordinaryCategories)('%s Off cleans only target and On never pins', async category => {
    const h = surfaceHarness(<RecommendationsHub />, { initial: { pinned_nav_tabs: ['public_profile', category, 'public_music'] } }); await h.ready(); await openCategory(category);
    fireEvent.click(screen.getByRole('button', { name: /Disable Public/ }));
    await waitFor(() => expect(h.saved[category]).toBe('No')); await waitFor(() => expect(h.navigation.busy).toBe(false));
    await openCategory(category); fireEvent.click(screen.getByRole('button', { name: /Enable Public/ }));
    await waitFor(() => expect(h.saved[category]).toBe('Yes'));
    expect(h.writes.map(r => r.variables)).toEqual([
      { documentId: 'a1', data: { [category]: 'No', pinned_nav_tabs: ['public_profile', 'public_music'] } },
      { documentId: 'a1', data: { [category]: 'Yes' } },
    ]);
  });
  it.each(ordinaryCategories)('%s hidden Pin remains disabled with no visibility write', async category => {
    const h = surfaceHarness(<RecommendationsHub />, { initial: { [category]: 'No', pinned_nav_tabs: ['public_profile'] } }); await h.ready(); await openCategory(category);
    const pin = screen.getByRole('button', { name: /Pin to Public Nav/ }); expect(pin).toBeDisabled(); fireEvent.click(pin); expect(h.writes).toEqual([]);
  });
  it('cannot pin a hidden category or publish it as a pin side effect', async () => {
    const h = surfaceHarness(<RecommendationsHub />, { initial: { public_books: 'No', pinned_nav_tabs: ['public_profile'] } }); await h.ready(); await openBooks();
    const pin = screen.getByRole('button', { name: /Pin to Public Nav/ }); expect(pin).toBeDisabled(); fireEvent.click(pin); expect(h.writes).toEqual([]);
  });
  it('Off removes only its stored pin, preserving saved Music during outage', async () => {
    const h = surfaceHarness(<RecommendationsHub />); await h.ready(); await openBooks();
    fireEvent.click(screen.getByRole('button', { name: /Disable Public/ })); await waitFor(() => expect(h.writes).toHaveLength(1));
    expect(h.writes[0].variables).toEqual({ documentId: 'a1', data: { public_books: 'No', pinned_nav_tabs: ['public_profile', 'public_music'] } });
  });
  it('automatic placement links to Settings and does not silently change mode', async () => {
    const h = surfaceHarness(<RecommendationsHub />, { initial: { auto_pinning: true } }); await h.ready(); await openBooks();
    expect(screen.getByRole('button', { name: /Manual mode in Settings/ })).toBeInTheDocument(); expect(h.writes).toEqual([]);
  });
});
