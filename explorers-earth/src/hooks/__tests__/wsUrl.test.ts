import { describe, it, expect } from 'vitest';
import { resolveWsUrl } from '../useWebSocket';

describe('resolveWsUrl — secure WebSocket scheme (fixes mixed-content block on prod)', () => {
  it('defaults to wss:// on an https page when the env var is unset', () => {
    expect(resolveWsUrl(undefined, 'https:')).toBe('wss://localtunes.earth');
  });

  it('defaults to ws:// on an http page (local dev) when the env var is unset', () => {
    expect(resolveWsUrl(undefined, 'http:')).toBe('ws://localtunes.earth');
  });

  it('upgrades a stale ws:// env value to wss:// on an https page', () => {
    expect(resolveWsUrl('ws://localtunes.earth', 'https:')).toBe('wss://localtunes.earth');
  });

  it('upgrades an http:// env value to https:// on an https page', () => {
    expect(resolveWsUrl('http://localtunes.earth', 'https:')).toBe('https://localtunes.earth');
  });

  it('respects an already-correct wss:// env value', () => {
    expect(resolveWsUrl('wss://custom-host.example', 'https:')).toBe('wss://custom-host.example');
  });

  it('leaves a ws:// env value untouched on an http page (no forced upgrade)', () => {
    expect(resolveWsUrl('ws://localhost:5000', 'http:')).toBe('ws://localhost:5000');
  });
});
