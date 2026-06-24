import { describe, it, expect } from 'vitest';
import { reconcileLocalTunesLink, buildLocalTunesPlaylistUrl } from '../localTunesUtils';

const BASE = 'https://localtunes.earth';
const LIVE = '5421c0f86a03def8b54fe252cb7e2473'; // current guestUrl
const STALE = 'b03de75a08b39eba19fafcd12233db8a'; // old/orphaned guestUrl (the prod bug)

describe('reconcileLocalTunesLink — self-heal the localtunes_public link', () => {
  it('returns null (skip) when the stored link already matches the live guestUrl', () => {
    const stored = buildLocalTunesPlaylistUrl(LIVE, BASE);
    expect(reconcileLocalTunesLink(stored, LIVE, BASE)).toBeNull();
  });

  it('returns the canonical URL when no link is stored yet', () => {
    const expected = `${BASE}/playlist/${LIVE}`;
    expect(reconcileLocalTunesLink(null, LIVE, BASE)).toBe(expected);
    expect(reconcileLocalTunesLink(undefined, LIVE, BASE)).toBe(expected);
    expect(reconcileLocalTunesLink('', LIVE, BASE)).toBe(expected);
  });

  it('rewrites a STALE link to the current guestUrl (prod case: tunes row recreated)', () => {
    const stale = `${BASE}/playlist/${STALE}`;
    expect(reconcileLocalTunesLink(stale, LIVE, BASE)).toBe(`${BASE}/playlist/${LIVE}`);
  });

  it('is idempotent: re-running after a reconcile is a no-op', () => {
    const written = reconcileLocalTunesLink(`${BASE}/playlist/${STALE}`, LIVE, BASE);
    expect(written).toBe(`${BASE}/playlist/${LIVE}`);
    expect(reconcileLocalTunesLink(written, LIVE, BASE)).toBeNull();
  });
});
