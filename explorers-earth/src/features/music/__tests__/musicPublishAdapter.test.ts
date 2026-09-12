import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { createMusicPublishAdapter } from '../musicPublishAdapter';
import { createMusicWorkspaceClient } from '../musicWorkspaceClient';
import { publicMusicClient } from '../publicMusicClient';
import { createCategoryNavigationApi } from '../../navigation/categoryNavigationApi';
import { createAccountNavigationWriter } from '../../navigation/accountNavigationWriter';
import { CATEGORY_IDS, type IntentAuthority } from '../../navigation/categoryNavigationPolicy';
const origin: IntentAuthority = { userDocumentId: 'user-a', accountDocumentId: 'account-a', generation: 1 };
function fixture(fault?: 'reject' | 'identity' | 'visibility' | 'pins' | 'read-identity' | 'ambiguous') {
    const account: Record<string, unknown> = { documentId: 'account-a', Account_Name: 'Explorer', Account_Type: 'Personal', mobile_number: '123',
        ...Object.fromEntries(CATEGORY_IDS.map((id) => [id, 'Yes'])), pinned_nav_tabs: ['public_profile', 'public_music', 'public_books', 'unknown-preserved'], auto_pinning: true };
    const patches: unknown[] = [];
    const musicRequests: unknown[] = [];
    const client = { query: vi.fn(async () => ({ loading: false, data: { usersPermissionsUser: { documentId: origin.userDocumentId, provider: 'google', blocked: false,
                    accounts: fault === 'ambiguous' ? [account, { ...account, documentId: 'other' }] : [{ ...account, ...(fault === 'read-identity' ? { documentId: 'other' } : {}) }] } } })),
        mutate: vi.fn(async (input: {
            variables: {
                data: Record<string, unknown>;
            };
        }) => {
            patches.push(input.variables.data);
            if (fault === 'reject')
                throw new Error('SECRET transport detail');
            const echo = { ...account, ...input.variables.data };
            if (fault === 'identity')
                echo.documentId = 'other';
            if (fault === 'visibility')
                echo.public_music = 'No';
            if (fault === 'pins')
                echo.pinned_nav_tabs = ['public_profile', 'public_music'];
            Object.assign(account, echo);
            return { data: { updateAccount: echo } };
        }) } as unknown as ApolloClient<NormalizedCacheObject>;
    const workspace = createMusicWorkspaceClient(async (input) => {
        musicRequests.push(input);
        return new Response(JSON.stringify(input.method === 'GET' ? { queueRevision: 0, songs: [], playedSongs: [], currentlyPlaying: null, publication: { mode: 'private', publicSlug: 'public-slug' } }
            : { version: 'music-publication/v1', publication: { mode: (input.body as {
                        mode: string;
                    }).mode, publicSlug: 'public-slug' } }));
    });
    let current = true;
    const api = createCategoryNavigationApi({ client, isCurrent: () => current });
    const writer = createAccountNavigationWriter({ ...api, isCurrent: () => current }, client);
    return { account, patches, musicRequests, client, workspace, writer, stale: () => { current = false; },
        adapter: (transaction: Parameters<Parameters<typeof writer.run>[1]>[0]) => createMusicPublishAdapter({ client, workspace, scope: origin, origin, isCurrent: () => current, transaction }) };
}
describe('Music publication adapter uses the captured shared transaction', () => {
    beforeEach(() => vi.restoreAllMocks());
    it('hydrates exact scope, saved pins and parsed publication without mutations or identity provisioning', async () => {
        const f = fixture();
        const snapshot = await f.writer.run(origin, async (tx) => f.adapter(tx).read());
        expect(snapshot).toEqual({ scope: { userDocumentId: 'user-a', accountDocumentId: 'account-a' }, profile: 'Yes', mode: 'private', publicSlug: 'public-slug', savedPins: ['public_profile', 'public_music', 'public_books', 'unknown-preserved'] });
        expect(f.patches).toEqual([]);
        expect(f.musicRequests).toEqual([{ method: 'GET', path: '/api/music/dashboard' }]);
    });
    it.each(['read-identity', 'ambiguous'] as const)('rejects %s instead of defaulting No/Private', async (fault) => {
        const f = fixture(fault);
        await expect(f.writer.run(origin, async (tx) => f.adapter(tx).read())).rejects.toThrow();
    });
    it('On sends only public_music Yes; Off fresh-reads and removes only saved Music pins even in auto mode', async () => {
        const f = fixture();
        await f.writer.run(origin, async (tx) => { const adapter = f.adapter(tx); await adapter.saveProfile('Yes'); await adapter.saveProfile('No'); });
        expect(f.patches).toEqual([{ public_music: 'Yes' }, { public_music: 'No', pinned_nav_tabs: ['public_profile', 'public_books', 'unknown-preserved'] }]);
        expect(f.account.auto_pinning).toBe(true);
        expect(f.account.public_books).toBe('Yes');
    });
    it.each(['reject', 'identity', 'visibility'] as const)('rejects %s profile confirmation before a publication call', async (fault) => {
        const f = fixture(fault);
        await expect(f.writer.run(origin, async (tx) => { const adapter = f.adapter(tx); await adapter.saveProfile('Yes'); await adapter.publish('public', 'key'); })).rejects.toThrow();
        expect(f.musicRequests).toEqual([]);
    });
    it('rejects wrong filtered-pin echo and malformed saved-pin partial cleanup', async () => {
        const f = fixture('pins');
        await expect(f.writer.run(origin, async (tx) => f.adapter(tx).saveProfile('No'))).rejects.toThrow();
        const malformed = fixture();
        malformed.account.pinned_nav_tabs = { invalid: true };
        await expect(malformed.writer.run(origin, async (tx) => malformed.adapter(tx).saveProfile('No'))).rejects.toThrow();
        expect(malformed.patches).toEqual([{ public_music: 'No' }]);
    });
    it('discovery uses the immutable account ID and rejects a different owner slug', async () => {
        const discover = vi.spyOn(publicMusicClient, 'discover').mockResolvedValue({ version: 'music-public-descriptor/v1', publication: { mode: 'public', publicSlug: 'other-slug', revision: 1 } });
        const f = fixture();
        await expect(f.writer.run(origin, async (tx) => f.adapter(tx).discover('public-slug'))).rejects.toThrow();
        expect(discover).toHaveBeenCalledWith('account-a');
    });
    it('generation invalidation blocks the next publication request', async () => {
        const f = fixture();
        await expect(f.writer.run(origin, async (tx) => { const adapter = f.adapter(tx); f.stale(); await adapter.publish('public', 'key'); })).rejects.toThrow();
        expect(f.musicRequests).toEqual([]);
    });
});
