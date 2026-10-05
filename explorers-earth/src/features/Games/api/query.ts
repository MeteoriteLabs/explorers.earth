import { gql } from "@apollo/client";
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../../../store/store';
import type { CollectionObservation, RecommendationObservation } from '../../../lib/explorersApiClient';
import { GamesClient, type CompleteGamesOwnerContent, type GameMembershipIntent } from './gamesClient';
import { invalidateGames } from '../hooks/useGamesOwner';

/** Each caller owns its UI effects independently of the native command transport. */
export function useGamesCallerCustody() {
 const generation = useAuthStore(state => state.generation), accountId = useAuthStore(state => state.accountId), location = useLocation();
 const scope = JSON.stringify([generation, accountId, location.pathname]);
 const owner = useRef(scope); owner.current = scope;
 const mounted = useRef(true), operation = useRef(0);
 useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current++; }; }, []);
 return () => {
  const observedScope = scope, id = ++operation.current;
  return () => mounted.current && owner.current === observedScope && operation.current === id;
 };
}

/** Native UI commands keep observation and route authority around every await. */
export function useGamesCommands() {
 const generation = useAuthStore(state => state.generation), accountId = useAuthStore(state => state.accountId), location = useLocation();
 const scope = JSON.stringify([generation, accountId, location.pathname]);
 const current = useRef(scope); current.current = scope;
 const mounted = useRef(true), operation = useRef(0), controllers = useRef(new Set<AbortController>());
 const keys = useRef(new Map<string, string>()), memberships = useRef(new Map<string, GameMembershipIntent>());
 const collections = useRef(new Map<string, CollectionObservation>()), completeReads = useRef(new Map<string, CompleteGamesOwnerContent>());
 const recommendations = useRef(new Map<string, RecommendationObservation>()), choices = useRef(new Map<string, string>());
 const [pending, setPending] = useState(0);
 useEffect(() => { mounted.current = true; return () => { mounted.current = false; controllers.current.forEach(controller => controller.abort()); }; }, []);
 useEffect(() => { controllers.current.forEach(controller => controller.abort()); keys.current.clear(); memberships.current.clear(); collections.current.clear(); completeReads.current.clear(); recommendations.current.clear(); choices.current.clear(); setPending(0); }, [scope]);
 const forget = (signature: string) => { keys.current.delete(signature); collections.current.delete(signature); completeReads.current.delete(signature); recommendations.current.delete(signature); };
 const begin = (group: string, signature: string) => { const previous = choices.current.get(group); if (previous && previous !== signature) { forget(previous); memberships.current.delete(previous); } choices.current.set(group, signature); };
 const observeCollection = async (signature: string, id: string, assert: () => void, signal: AbortSignal) => { let observed = collections.current.get(signature); if (!observed) { observed = await GamesClient.observeCollection(id, signal); assert(); collections.current.set(signature, observed); } return observed; };
 const observeComplete = async (signature: string, assert: () => void, signal: AbortSignal) => { let observed = completeReads.current.get(signature); if (!observed) { observed = await GamesClient.readCompleteOwner(signal); assert(); completeReads.current.set(signature, observed); } return observed; };
 const key = (intent: string) => { const existing = keys.current.get(intent); if (existing) return existing; const value = crypto.randomUUID(); keys.current.set(intent, value); return value; };
 const run = async <T,>(action: (assert: () => void, signal: AbortSignal) => Promise<T>): Promise<T> => {
  const captured = scope, token = ++operation.current, controller = new AbortController(); controllers.current.add(controller); setPending(value => value + 1);
  const assert = () => { if (!mounted.current || current.current !== captured || operation.current !== token || controller.signal.aborted) throw new Error('Game owner or route changed'); };
  try { assert(); const result = await action(assert, controller.signal); assert(); invalidateGames(); return result; }
  finally { controllers.current.delete(controller); if (mounted.current && current.current === captured) setPending(value => Math.max(0, value - 1)); }
 };
 return { loading: pending > 0,
  createList: (input: { title: string; slug: string; description?: string | null }) => run(async (assert, signal) => { const signature = `create:${JSON.stringify(input)}`; begin('create', signature); assert(); const result = await GamesClient.createCollection(input, key(signature), signal); assert(); forget(signature); return result; }),
  updateList: (id: string, patch: Parameters<typeof GamesClient.updateCollection>[1]) => run(async (assert, signal) => { const signature = `update:${id}:${JSON.stringify(patch)}`; begin(`collection:${id}`, signature); const observed = await observeCollection(signature, id, assert, signal); assert(); const result = await GamesClient.updateCollection(observed, patch, key(signature), signal); assert(); forget(signature); return result; }),
  archiveList: (id: string) => run(async (assert, signal) => { const signature = `archive:${id}`; begin(`collection:${id}`, signature); const observed = await observeCollection(signature, id, assert, signal); assert(); const result = await GamesClient.archiveCollection(observed, key(signature), signal); assert(); forget(signature); return result; }),
  publishRecommendation: (id: string, published: boolean) => run(async (assert, signal) => { const signature = `recommendation-publication:${id}:${published}`; begin(`recommendation:${id}`, signature); let observed = recommendations.current.get(signature); if (!observed) { observed = await GamesClient.observeRecommendation(id, signal); assert(); recommendations.current.set(signature, observed); } assert(); const result = await GamesClient.updateRecommendation(observed, { publicationState: published ? 'published' : 'draft' }, key(signature), signal); assert(); forget(signature); return result; }),
  membership: (id: string, collectionId: string, attached: boolean) => run(async (assert, signal) => {
   const signature = JSON.stringify([scope, id, collectionId, attached]); begin(`membership:${id}:${collectionId}`, signature); let intent = memberships.current.get(signature);
   if (!intent) { const parent = await GamesClient.observeCollection(collectionId, signal); assert(); const item = await GamesClient.observeRecommendation(id, signal); assert(); intent = GamesClient.prepareMembershipIntent(parent, item, attached); memberships.current.set(signature, intent); }
   assert(); const result = await GamesClient.saveMembership(intent, signal); assert(); memberships.current.delete(signature); return result;
  }),
  pin: (id: string, collectionId: string, pinned: boolean) => run(async (assert, signal) => {
   const signature = `pin:${id}:${collectionId}:${pinned}`; begin('pins', signature); const observed = await observeComplete(signature, assert, signal); assert();
   if (!observed.memberships.some(member => member.recommendationId === id && member.collectionId === collectionId && !member.collectionArchived && !member.recommendationArchived)) throw new Error('Game membership unavailable');
   const pins = (observed.topPicks ?? []).filter(pin => pin.recommendationId !== id).map(pin => ({ recommendationId: pin.recommendationId, collectionId: pin.collectionId }));
   if (pinned) pins.push({ recommendationId: id, collectionId });
   assert(); const result = await GamesClient.setTopPicks(observed, pins, key(signature), signal); assert(); forget(signature); return result;
  }),
  savePins: (pins: { recommendationId: string; collectionId: string }[]) => run(async (assert, signal) => { const signature = `save-pins:${JSON.stringify(pins)}`; begin('pins', signature); const observed = await observeComplete(signature, assert, signal); assert(); const result = await GamesClient.setTopPicks(observed, pins, key(signature), signal); assert(); forget(signature); return result; }),
 };
}

// ─────────────────────────────────────────────────────────────
// Query 1.1 — Game Lists by Account (Dashboard + Public)
// ─────────────────────────────────────────────────────────────
export const GAME_LISTS_BY_ACCOUNT = gql`
  query GameListsByAccount($accountDocumentId: ID!) {
    gameLists(
      filters: { account: { documentId: { eq: $accountDocumentId } } }
      sort: ["display_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      List_Name
      list_description
      slug
      Visibility
      cover_image {
        url
        alternativeText
      }
      display_order
      top_picks_heading
      recommended_games(sort: ["display_order:asc"], pagination: { limit: 200 }) {
        documentId
        igdb_id
        title
        cover_url
        cover_url_large
        summary
        release_year
        genres
        platforms
        is_pinned
        display_order
        screenshot_ids
        media_details
        igdb_slug
        igdb_image_id
        release_date
        igdb_rating
        igdb_rating_count
        developer
        publisher
        game_modes
        igdb_url
        user_recommendation_note
        user_rating
        pin_order
        Media {
          documentId
          url
        }
        game_categories {
          documentId
          genre_name
        }
      }
      account {
        documentId
        username
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.2 — Games by List (paginated, for list view)
// ─────────────────────────────────────────────────────────────
export const GAMES_BY_LIST = gql`
  query GamesByList(
    $gameListDocumentId: ID!
    $page: Int!
    $pageSize: Int!
  ) {
    gameLists(
      filters: { documentId: { eq: $gameListDocumentId } }
    ) {
      documentId
      List_Name
      list_description
      slug
      Visibility
      top_picks_heading
      display_order
      recommended_games(
        sort: ["display_order:asc"]
        pagination: { start: $page, limit: $pageSize }
      ) {
        documentId
        igdb_id
        igdb_slug
        title
        cover_url
        cover_url_large
        igdb_image_id
        summary
        release_date
        release_year
        igdb_rating
        igdb_rating_count
        genres
        platforms
        developer
        publisher
        game_modes
        screenshot_ids
        igdb_url
        user_recommendation_note
        user_rating
        is_pinned
        pin_order
        display_order
        media_details
        game_categories {
          documentId
          genre_name
        }
        Media {
          documentId
          url
          caption
        }
      }
    }
  }
`;

// Page-0 window shared by the list view's query AND the Add-page refetch, so the
// two can never drift. A drift would make the refetch target a different cache
// key — a silent no-op that leaves the list stale after an add.
export const GAMES_BY_LIST_PAGE_SIZE = 200;
export const gamesByListVars = (listId: string) => ({
  gameListDocumentId: listId,
  page: 0,
  pageSize: GAMES_BY_LIST_PAGE_SIZE,
});
export const refetchGamesByList = (listId: string) => [
  { query: GAMES_BY_LIST, variables: gamesByListVars(listId) },
];

// ─────────────────────────────────────────────────────────────
// Query 1.3 — Single Game Detail
// ─────────────────────────────────────────────────────────────
export const GAME_DETAILS = gql`
  query GameDetails($documentId: ID!) {
    recommendedGames(filters: { documentId: { eq: $documentId } }) {
      documentId
      igdb_id
      igdb_slug
      title
      cover_url
      cover_url_large
      igdb_image_id
      summary
      release_date
      release_year
      igdb_rating
      igdb_rating_count
      genres
      platforms
      developer
      publisher
      game_modes
      screenshot_ids
      igdb_url
      user_recommendation_note
      user_rating
      is_pinned
      pin_order
      display_order
      media_details
      Media {
        documentId
        url
        caption
      }
      game_list {
        documentId
        List_Name
        slug
      }
      game_categories {
        documentId
        genre_name
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.4 — Pinned Games (Top Picks) for a user
// ─────────────────────────────────────────────────────────────
export const PINNED_GAMES = gql`
  query PinnedGames($accountDocumentId: ID!) {
    recommendedGames(
      filters: {
        is_pinned: { eq: true }
        game_list: { account: { documentId: { eq: $accountDocumentId } } }
      }
      sort: ["pin_order:asc"]
      pagination: { limit: 100 }
    ) {
      documentId
      igdb_id
      title
      cover_url
      cover_url_large
      summary
      release_year
      igdb_rating
      user_rating
      genres
      platforms
      user_recommendation_note
      is_pinned
      pin_order
      screenshot_ids
      media_details
      Media {
        documentId
        url
      }
      game_categories {
        documentId
        genre_name
      }
      game_list {
        documentId
        List_Name
        slug
      }
    }
}
`;

// ─────────────────────────────────────────────────────────────
// Query 1.5 — Games by Genre (for public genre page)
// ─────────────────────────────────────────────────────────────
export const GAMES_BY_GENRE = gql`
  query GamesByGenre($accountDocumentId: ID!, $genreName: String!) {
    recommendedGames(
      filters: {
        game_categories: { genre_name: { eq: $genreName } }
        game_list: {
          account: { documentId: { eq: $accountDocumentId } }
          Visibility: { eq: true }
        }
      }
      sort: ["display_order:asc"]
      pagination: { limit: 200 }
    ) {
      documentId
      igdb_id
      title
      cover_url
      igdb_rating
      user_rating
      genres
      platforms
      release_year
      game_list {
        documentId
        List_Name
        slug
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.6 — Game List by Slug (Public list page)
// ─────────────────────────────────────────────────────────────
export const GAME_LIST_BY_SLUG = gql`
  query GameListBySlug($slug: String!, $username: String!) {
    gameLists(
      filters: {
        slug: { eq: $slug }
        account: { username: { eq: $username } }
        Visibility: { eq: true }
      }
    ) {
      documentId
      List_Name
      list_description
      slug
      cover_image {
        url
        alternativeText
      }
      top_picks_heading
      recommended_games(sort: ["display_order:asc"], pagination: { limit: 200 }) {
        documentId
        igdb_id
        title
        cover_url
        summary
        release_year
        platforms
        genres
        screenshot_ids
        media_details
        igdb_rating
        user_rating
        is_pinned
        pin_order
        Media {
          documentId
          url
        }
        game_categories {
          documentId
          genre_name
        }
      }
      account {
        documentId
        username
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.7 — Public Game Data (All published lists)
// ─────────────────────────────────────────────────────────────
export const PUBLIC_GAME_DATA = gql`
  query PublicGameData($accountDocumentId: ID!) {
    gameLists(
      filters: {
        account: { documentId: { eq: $accountDocumentId } }
        Visibility: { eq: true }
      }
      sort: ["display_order:asc"]
    ) {
      documentId
      List_Name
      list_description
      slug
      cover_image {
        url
      }
      top_picks_heading
      recommended_games(
        sort: ["is_pinned:desc", "pin_order:asc", "display_order:asc"]
        pagination: { limit: 200 }
      ) {
        documentId
        igdb_id
        title
        cover_url
        summary
        release_year
        screenshot_ids
        media_details
        user_recommendation_note
        igdb_rating
        user_rating
        genres
        platforms
        is_pinned
        pin_order
        Media {
          documentId
          url
          caption
        }
        game_categories {
          documentId
          genre_name
        }
      }
    }
    recommendedGames(
      filters: {
        game_list: {
          account: { documentId: { eq: $accountDocumentId } }
          Visibility: { eq: true }
        }
      }
    ) {
      genres
      cover_url
      summary
      release_year
      screenshot_ids
      media_details
      game_categories {
        documentId
        genre_name
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────
// Query 1.8 — All Game Categories
// ─────────────────────────────────────────────────────────────
export const GAME_CATEGORIES = gql`
  query GameCategories {
    gameCategories(pagination: { limit: 100 }) {
      documentId
      genre_name
    }
  }
`;
