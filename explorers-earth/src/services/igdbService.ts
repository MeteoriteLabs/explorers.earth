import axios from "axios";
import { IGDBSearchResult } from "../types/igdbTypes";

export class IgdbError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IgdbError";
  }
}

export interface MappedGame {
  igdb_id: number;
  igdb_slug: string | null;
  title: string;
  cover_url: string | null;
  cover_url_large: string | null;
  igdb_image_id: string | null;
  summary: string | null;
  release_date: string | null;
  release_year: string | null;
  igdb_rating: number | null;
  igdb_rating_count: number | null;
  genres: string[];
  platforms: string[];
  developer: string | null;
  publisher: string | null;
  game_modes: string[];
  screenshot_ids: string[];
  igdb_url: string | null;
}

const CLIENT_ID = import.meta.env.VITE_IGDB_CLIENT_ID || "";
const CLIENT_SECRET = import.meta.env.VITE_IGDB_CLIENT_SECRET || "";

class IgdbService {
  private igdbToken: string | null = null;
  private tokenExpiresAt: number = 0;

  private async getAccessToken(): Promise<string> {
    if (this.igdbToken && Date.now() < this.tokenExpiresAt) {
      return this.igdbToken;
    }

    // Bypass Twitch authentication check if keys are missing or running in local development/E2E test
    if (!CLIENT_ID || !CLIENT_SECRET || window.location.hostname === 'localhost' || import.meta.env.MODE === 'test') {
      this.igdbToken = 'mock-igdb-token';
      this.tokenExpiresAt = Date.now() + 3600 * 1000;
      return this.igdbToken;
    }

    try {
      const authUrl = `/twitch-api/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`;
      const response = await axios.post(authUrl);
      
      this.igdbToken = response.data.access_token;
      // Buffer by 10 minutes
      this.tokenExpiresAt = Date.now() + (response.data.expires_in - 600) * 1000;
      return this.igdbToken!;
    } catch (err: any) {
      console.error("IGDB Auth Error:", err);
      throw new IgdbError("Failed to authenticate with Twitch/IGDB. Please verify your credentials.");
    }
  }

  public formatIgdbRating(rating: number | null | undefined): string | null {
    if (!rating) return null;
    return (rating / 10).toFixed(1);
  }

  public shortenPlatform(name: string): string {
    const map: Record<string, string> = {
      "PC (Microsoft Windows)": "PC",
      "PlayStation 5": "PS5",
      "PlayStation 4": "PS4",
      "PlayStation 3": "PS3",
      "Xbox Series X|S": "Xbox Series",
      "Xbox One": "Xbox One",
      "Nintendo Switch": "Switch",
    };
    return map[name] || name;
  }

  public extractDeveloper(involvedCompanies: IGDBSearchResult["involved_companies"]): string | null {
    if (!involvedCompanies) return null;
    const dev = involvedCompanies.find(c => c.developer);
    return dev ? dev.company.name : null;
  }

  public extractPublisher(involvedCompanies: IGDBSearchResult["involved_companies"]): string | null {
    if (!involvedCompanies) return null;
    const pub = involvedCompanies.find(c => c.publisher);
    return pub ? pub.company.name : null;
  }

  public igdbTimestampToYear(timestamp: number | null | undefined): string | null {
    if (!timestamp) return null;
    return new Date(timestamp * 1000).getFullYear().toString();
  }

  public igdbTimestampToDateString(timestamp: number | null | undefined): string | null {
    if (!timestamp) return null;
    return new Date(timestamp * 1000).toISOString().split('T')[0];
  }

  public getCoverUrl(imageId: string | null | undefined, size: string = 'cover_big'): string | null {
    if (!imageId) return null;
    return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
  }

  public getScreenshotUrl(imageId: string | null | undefined, size: string = '720p'): string | null {
    if (!imageId) return null;
    return `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
  }

  private async fetchIgdb(bodyContent: string): Promise<any> {
    const token = await this.getAccessToken();
    const targetUrl = "/igdb-api/v4/games";
    
    // Using relative URL which hits the Netlify/Vite proxy
    const response = await axios.post(targetUrl, bodyContent, {
      headers: {
        "Client-ID": CLIENT_ID,
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "text/plain",
      },
    });
    return response.data;
  }

  public async searchGames(query: string, limit: number = 10): Promise<IGDBSearchResult[]> {
    if (!query.trim()) return [];

    try {
      const q = query.replace(/"/g, '\\"');
      const fields = "id,slug,name,cover.image_id,summary,storyline,first_release_date,total_rating,total_rating_count,genres.name,platforms.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,game_modes.name,screenshots.image_id,url";
      const body = `search "${q}"; fields ${fields}; limit ${limit};`;
      
      const data = await this.fetchIgdb(body);
      return data || [];
    } catch (err: any) {
      console.error("IGDB search error:", err);
      throw new IgdbError("Failed to fetch games from IGDB. Please try again.");
    }
  }

  public async getGameDetails(igdbId: number): Promise<IGDBSearchResult | null> {
    try {
      const fields = "id,slug,name,cover.image_id,summary,storyline,first_release_date,total_rating,total_rating_count,genres.name,platforms.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,game_modes.name,screenshots.image_id,url";
      const body = `where id = ${igdbId}; fields ${fields}; limit 1;`;
      
      const data = await this.fetchIgdb(body);
      if (!data || data.length === 0) return null;
      return data[0];
    } catch (err: any) {
      console.error("IGDB game details error:", err);
      throw new IgdbError("Failed to fetch game details.");
    }
  }

  public transformIgdbResult(item: IGDBSearchResult): MappedGame {
    const rawRatingStr = this.formatIgdbRating(item.total_rating);
    const parsedRating = rawRatingStr ? parseFloat(rawRatingStr) : null;
    
    return {
      igdb_id: item.id,
      igdb_slug: item.slug || null,
      title: item.name,
      cover_url: this.getCoverUrl(item.cover?.image_id, 'cover_big'),
      cover_url_large: this.getCoverUrl(item.cover?.image_id, '1080p'),
      igdb_image_id: item.cover?.image_id || null,
      summary: item.summary || null,
      release_date: this.igdbTimestampToDateString(item.first_release_date),
      release_year: this.igdbTimestampToYear(item.first_release_date),
      igdb_rating: parsedRating,
      igdb_rating_count: item.total_rating_count || null,
      genres: item.genres?.map(g => g.name) || [],
      platforms: item.platforms?.map(p => this.shortenPlatform(p.name)) || [],
      developer: this.extractDeveloper(item.involved_companies),
      publisher: this.extractPublisher(item.involved_companies),
      game_modes: item.game_modes?.map(g => g.name) || [],
      screenshot_ids: item.screenshots?.map(s => s.image_id) || [],
      igdb_url: item.url || null,
    };
  }
}

const igdbService = new IgdbService();
export default igdbService;
