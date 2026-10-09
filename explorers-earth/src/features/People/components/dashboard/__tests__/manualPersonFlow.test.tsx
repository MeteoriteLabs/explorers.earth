import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {MockedProvider} from '@apollo/client/testing';
import AddPersonPage from '../AddPersonPage';
import PersonListView from '../PersonListView';
import {PeopleClient} from '../../../api/peopleClient';
import useAuthStore from '../../../../../store/store';

// Replaces profile-scrape.integration.test.tsx, which drove /api/people/scrape-profile -
// a path the server does not have and music-security-containment.test.ts asserts stays
// absent. With no enrichment there is nothing to fail, which is the strongest form of
// "enrichment failure must not erase a manual draft".

const fixture = vi.hoisted(() => ({content: {view: {lists: [] as unknown[]}, details: new Map(), observation: {}}, loading: false, error: undefined as Error | undefined, refetch: vi.fn()}));
vi.mock('../../../hooks/usePeopleOwner', () => ({usePeopleOwner: () => ({content: fixture.content, data: {personLists: fixture.content.view.lists}, loading: fixture.loading, error: fixture.error, refetch: fixture.refetch}), invalidatePeople: vi.fn()}));
vi.mock('../../../api/peopleClient', () => ({PeopleClient: {observeCollection: vi.fn(), prepareManualIntent: vi.fn(), createManual: vi.fn(), upload: vi.fn(), updateRecommendation: vi.fn(), observeRecommendation: vi.fn(), updateCollection: vi.fn(), archiveCollection: vi.fn(), archiveRecommendation: vi.fn(), createCollection: vi.fn(), readCompleteOwner: vi.fn(), setTopPicks: vi.fn(), prepareMembershipIntent: vi.fn(), saveMembership: vi.fn()}}));
vi.mock('../../../../Favorites/components/TiptapEditor', () => ({default: ({value, onChange}: {value: string; onChange: (value: string) => void}) => <textarea aria-label="Note" value={value} onChange={event => onChange(event.target.value)} />}));
vi.mock('sonner', () => ({toast: {success: vi.fn(), error: vi.fn(), loading: vi.fn()}}));

function mount() { return render(<MockedProvider><MemoryRouter initialEntries={['/people/list-1/add']}><Routes><Route path="/people/:listId/add" element={<AddPersonPage />} /><Route path="/recommendations/people/:listId" element={<p>Saved list</p>} /></Routes></MemoryRouter></MockedProvider>); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return {promise, resolve}; }
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}});
const draft = () => vi.mocked(PeopleClient.prepareManualIntent).mock.calls[0][1];

describe('native manual People', () => {
 beforeEach(() => {
  vi.clearAllMocks(); fixture.loading = false; fixture.error = undefined; fixture.content.view.lists = []; fixture.content.details.clear();
  useAuthStore.getState().login({id: 'u1', documentId: 'u1', username: 'owner', token: 'fixture'}); useAuthStore.setState({accountId: 'a1'});
  vi.mocked(PeopleClient.observeCollection).mockResolvedValue({detail: {id: 'list-1'}} as never);
  vi.mocked(PeopleClient.prepareManualIntent).mockImplementation((parent, d) => ({parent, draft: d, entityKey: 'entity-key', recommendationKey: 'recommendation-key'}) as never);
  vi.mocked(PeopleClient.createManual).mockResolvedValue({id: 'person-1'} as never);
 });
 afterEach(() => { cleanup(); useAuthStore.getState().logout(); });

 it('creates a person from the owner-entered fields, with the link under both keys', async () => {
  mount();
  fill('Full Name', 'Alex Lee'); fill('Profile URL', 'https://example.com/alex');
  fill('Platform', 'twitter'); fill('Handle / Username', 'alexlee');
  fill('Headline / Role', 'Designer'); fill('Location', 'Lisbon'); fill('Followers', '12.4k');
  fill('Note', '<p>Great eye</p>');
  fireEvent.click(screen.getByRole('button', {name: 'Save person'}));
  await screen.findByText('Saved list');
  expect(draft()).toMatchObject({title: 'Alex Lee', usernameHandle: 'alexlee', headline: 'Designer',
   locationText: 'Lisbon', externalFollowerCountText: '12.4k', primaryPlatform: 'twitter',
   // Keyed under both so the projection can resolve a primary either way.
   socialUrls: {primary: 'https://example.com/alex', twitter: 'https://example.com/alex'}});
 });

 it('requires only the name, since every other column is nullable', async () => {
  mount();
  expect(screen.getByRole('button', {name: 'Save person'})).toBeDisabled();
  fill('Full Name', 'Just A Name');
  expect(screen.getByRole('button', {name: 'Save person'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button', {name: 'Save person'}));
  await screen.findByText('Saved list');
  expect(draft()).toMatchObject({title: 'Just A Name', usernameHandle: null, headline: null,
   locationText: null, primaryPlatform: null, socialUrls: {}, skillsTags: [], externalFollowerCountText: null});
 });

 it('offers X as the label while sending the stored twitter value', async () => {
  mount();
  const options = [...(screen.getByLabelText('Platform') as HTMLSelectElement).options];
  expect(options.map(option => option.value)).toEqual(['', 'instagram', 'linkedin', 'twitter', 'github', 'youtube', 'website', 'other']);
  expect(options.find(option => option.value === 'twitter')?.text).toBe('X');
 });

 it('reports a malformed profile address before dispatching, and keeps the draft', async () => {
  mount(); fill('Full Name', 'Bad Link'); fill('Profile URL', 'notaurl');
  expect(await screen.findByRole('alert')).toHaveTextContent('Enter a full http(s) profile address');
  expect(screen.getByRole('button', {name: 'Save person'})).toBeDisabled();
  expect(PeopleClient.observeCollection).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Full Name')).toHaveValue('Bad Link');
  fill('Profile URL', 'https://example.com/ok');
  await waitFor(() => expect(screen.getByRole('button', {name: 'Save person'})).toBeEnabled());
 });

 it('collects distinct tags up to the stored bound', async () => {
  mount(); fill('Full Name', 'Tagged');
  for (const tag of ['design', 'type', 'design']) { fill('New tag', tag); fireEvent.click(screen.getByRole('button', {name: 'Add tag'})); }
  fireEvent.click(screen.getByRole('button', {name: 'Save person'}));
  await screen.findByText('Saved list');
  expect(draft()).toMatchObject({skillsTags: ['design', 'type']});
 });

 it('waits for uploaded snapshot readiness before saving', async () => {
  const upload = deferred<{id: string}>(); vi.mocked(PeopleClient.upload).mockReturnValue(upload.promise as never);
  mount(); fill('Full Name', 'Shot');
  fireEvent.change(screen.getByLabelText('Snapshots'), {target: {files: [new File(['bytes'], 'shot.png', {type: 'image/png'})]}});
  expect(screen.getByRole('button', {name: 'Save person'})).toBeDisabled();
  await act(async () => upload.resolve({id: 'media-1'}));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Save person'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: 'Save person'}));
  await screen.findByText('Saved list');
  expect(draft()).toMatchObject({mediaIds: ['media-1']});
 });

 it('preserves every typed field when the save fails and retries the same intent', async () => {
  vi.mocked(PeopleClient.createManual).mockRejectedValueOnce(new Error('Temporarily unavailable')).mockResolvedValueOnce({id: 'person-1'} as never);
  mount(); fill('Full Name', 'Retained'); fill('Headline / Role', 'Retained role');
  fireEvent.click(screen.getByRole('button', {name: 'Save person'}));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Full Name')).toHaveValue('Retained');
  expect(screen.getByLabelText('Headline / Role')).toHaveValue('Retained role');
  fireEvent.click(screen.getByRole('button', {name: 'Save person'}));
  await screen.findByText('Saved list');
  expect(PeopleClient.prepareManualIntent).toHaveBeenCalledTimes(1);
  expect(vi.mocked(PeopleClient.createManual).mock.calls[0][0]).toBe(vi.mocked(PeopleClient.createManual).mock.calls[1][0]);
 });

 it('cannot create a person once the account is replaced while the parent read is pending', async () => {
  const parent = deferred<never>(); vi.mocked(PeopleClient.observeCollection).mockReturnValue(parent.promise);
  mount(); fill('Full Name', 'Old owner');
  fireEvent.click(screen.getByRole('button', {name: 'Save person'}));
  act(() => useAuthStore.getState().logout());
  await act(async () => parent.resolve({detail: {id: 'list-1'}} as never));
  expect(PeopleClient.prepareManualIntent).not.toHaveBeenCalled();
  expect(PeopleClient.createManual).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Full Name')).toHaveValue('');
 });

 it('offers explicit recommendation publication without inheriting the list publication', async () => {
  const person = {documentId: 'person-a', name: 'Manual Person', full_name: 'Manual Person', username_handle: null, headline: null,
   location: null, avatar_path: null, media_details: null, primary_platform: null, social_urls: {}, skills_tags: null,
   user_recommendation_note: '', user_rating: null, is_pinned: false, pin_order: null, display_order: 0,
   person_list: {documentId: 'list-1', List_Name: 'Published list', slug: 'published'}, person_category: null};
  fixture.content.view.lists = [{documentId: 'list-1', List_Name: 'Published list', slug: 'published', Visibility: true, top_picks_heading: null, recommended_people: [person], account: {documentId: 'a1', username: 'owner'}}];
  const observed = {detail: {id: 'person-a', revision: 1, publicationState: 'draft', category: 'people'}};
  fixture.content.details.set('person-a', observed);
  vi.mocked(PeopleClient.observeRecommendation).mockResolvedValue(observed as never);
  vi.mocked(PeopleClient.updateRecommendation).mockResolvedValue({} as never);
  render(<MockedProvider><MemoryRouter initialEntries={['/recommendations/people/list-1']}><Routes><Route path="/recommendations/people/:listId" element={<PersonListView />} /></Routes></MemoryRouter></MockedProvider>);
  expect(screen.getByText('Recommendation is Draft')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Publish Manual Person'}));
  await waitFor(() => expect(PeopleClient.updateRecommendation).toHaveBeenCalledWith(observed, {publicationState: 'published'}, expect.any(String), expect.any(AbortSignal)));
  expect(PeopleClient.updateCollection).not.toHaveBeenCalled();
 });
});

describe('manual People edit', () => {
 function editElement() { return <MockedProvider><MemoryRouter initialEntries={['/people/list-1/edit/person-a']}><Routes><Route path="/people/:listId/edit/:personId" element={<AddPersonPage />} /></Routes></MemoryRouter></MockedProvider>; }
 function loaded() {
  const person = {documentId: 'person-a', name: 'Alex Lee', full_name: 'Alex Lee', username_handle: 'alexlee', headline: 'Designer',
   location: 'Lisbon', avatar_path: null, media_details: null, primary_platform: 'twitter', platform: 'x',
   social_urls: {twitter: 'https://example.com/alex'}, profile_url: 'https://example.com/alex',
   skills_tags: ['design'], follower_count: '12.4k', user_recommendation_note: '<p>Note</p>', user_rating: 7,
   is_pinned: false, pin_order: null, display_order: 0, person_list: null, person_category: null};
  fixture.content.view.lists = [{documentId: 'list-1', recommended_people: [person]}];
  fixture.content.details.set('person-a', {detail: {id: 'person-a', revision: 1, category: 'people'}});
  fixture.content = {...fixture.content}; fixture.loading = false; fixture.error = undefined;
 }
 beforeEach(() => { vi.clearAllMocks(); fixture.content = {view: {lists: []}, details: new Map(), observation: {}}; fixture.loading = false; fixture.error = undefined; useAuthStore.getState().login({id: 'u1', documentId: 'u1', username: 'owner', token: 'fixture'}); useAuthStore.setState({accountId: 'a1'}); });
 afterEach(() => { cleanup(); useAuthStore.getState().logout(); });

 it('hydrates the stored platform rather than its presented alias', async () => {
  loaded(); render(editElement());
  expect(await screen.findByLabelText('Full Name')).toHaveValue('Alex Lee');
  // The select carries the stored value; x is only the label.
  expect(screen.getByLabelText('Platform')).toHaveValue('twitter');
  expect(screen.getByLabelText('Profile URL')).toHaveValue('https://example.com/alex');
  expect(screen.getByLabelText('Handle / Username')).toHaveValue('alexlee');
  expect(screen.getByLabelText('Followers')).toHaveValue('12.4k');
 });

 it('never sends the handle as a display override', async () => {
  loaded(); vi.mocked(PeopleClient.updateRecommendation).mockResolvedValue({} as never);
  render(editElement());
  fireEvent.change(await screen.findByLabelText('Full Name'), {target: {value: 'Renamed'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save person'}));
  await waitFor(() => expect(PeopleClient.updateRecommendation).toHaveBeenCalledTimes(1));
  const patch = vi.mocked(PeopleClient.updateRecommendation).mock.calls[0][1] as {displayOverrides: Record<string, unknown>};
  expect(patch.displayOverrides).not.toHaveProperty('usernameHandle');
  expect(patch.displayOverrides.title).toBe('Renamed');
  expect(patch.displayOverrides.headline).toBe('Designer');
 });

 it('waits for owner hydration instead of exposing blank editable controls', async () => {
  fixture.loading = true; const view = render(editElement());
  expect(screen.getByRole('status')).toHaveTextContent('Loading person');
  expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
  loaded(); view.rerender(editElement());
  expect(await screen.findByLabelText('Full Name')).toHaveValue('Alex Lee');
 });

 it('preserves an unsaved edit on a background refresh and refuses to rebase its observation', async () => {
  loaded(); const original = fixture.content.details.get('person-a'); const view = render(editElement());
  fireEvent.change(await screen.findByLabelText('Full Name'), {target: {value: 'My unsaved edit'}});
  fixture.content = {view: {lists: []}, details: new Map(), observation: {}}; fixture.error = new Error('Refresh unavailable');
  view.rerender(editElement());
  expect(screen.getByLabelText('Full Name')).toHaveValue('My unsaved edit');
  loaded(); fixture.content.details.set('person-a', {detail: {id: 'person-a', revision: 2, category: 'people'}});
  view.rerender(editElement());
  expect(screen.getByLabelText('Full Name')).toHaveValue('My unsaved edit');
  fireEvent.click(screen.getByRole('button', {name: 'Save person'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reload the person before saving');
  expect(PeopleClient.updateRecommendation).not.toHaveBeenCalled();
  expect(fixture.content.details.get('person-a')).not.toBe(original);
 });
});
