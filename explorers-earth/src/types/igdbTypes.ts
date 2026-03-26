export interface IGDBSearchResult {
  id: number;
  name: string;
  slug: string;
  cover?: { image_id: string };
  total_rating?: number;
  total_rating_count?: number;
  genres?: Array<{ id: number; name: string }>;
  platforms?: Array<{ id: number; name: string }>;
  first_release_date?: number;  // Unix timestamp
  summary?: string;
  storyline?: string;
  involved_companies?: Array<{
    developer: boolean;
    publisher: boolean;
    company: { name: string };
  }>;
  game_modes?: Array<{ id: number; name: string }>;
  screenshots?: Array<{ image_id: string }>;
  url?: string;
  category?: number;
}
