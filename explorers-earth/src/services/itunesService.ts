import axios from "axios";
import type { ItunesResult } from "../features/AppsAndTools/types";

// ─────────────────────────────────────────────────────────────
// iTunes Search API Service
// No API key required — public endpoint
// ─────────────────────────────────────────────────────────────

class ItunesService {
  private readonly BASE_URL = "/itunes-api/search";

  /**
   * Search for apps by name using iTunes Search API.
   * Covers both iOS/iPadOS apps (entity=software) and macOS apps (entity=macSoftware).
   */
  async searchApps(query: string, limit: number = 12): Promise<ItunesResult[]> {
    if (!query.trim()) return [];

    try {
      const [iosRes, macRes] = await Promise.allSettled([
        axios.get(this.BASE_URL, {
          params: { term: query, entity: "software", limit, media: "software" },
        }),
        axios.get(this.BASE_URL, {
          params: { term: query, entity: "macSoftware", limit: 6, media: "software" },
        }),
      ]);

      const iosResults: ItunesResult[] =
        iosRes.status === "fulfilled"
          ? iosRes.value.data?.results?.filter((r: any) => r.kind !== "ebook") ?? []
          : [];

      const macResults: ItunesResult[] =
        macRes.status === "fulfilled"
          ? macRes.value.data?.results?.filter((r: any) => r.kind === "mac-software") ?? []
          : [];

      // Merge, deduplicate by trackId
      const seen = new Set<number>();
      const merged: ItunesResult[] = [];
      for (const r of [...iosResults, ...macResults]) {
        if (!seen.has(r.trackId)) {
          seen.add(r.trackId);
          merged.push(r);
        }
      }

      return merged.slice(0, limit);
    } catch (err) {
      console.error("iTunes search error:", err);
      return [];
    }
  }

  /**
   * Get best-quality artwork URL from iTunes result.
   */
  getArtworkUrl(result: ItunesResult, size: 100 | 512 = 100): string {
    const base = result.artworkUrl512 || result.artworkUrl100;
    if (!base) return "";
    // iTunes artwork URLs are like: .../100x100bb.jpg — replace size
    return base.replace(/\d+x\d+bb/, `${size}x${size}bb`);
  }

  /**
   * Map iTunes result to platforms array.
   */
  getPlatforms(result: ItunesResult): string[] {
    if (result.kind === "mac-software") return ["macOS"];
    const devices = result.supportedDevices || [];
    const platforms: string[] = [];
    if (devices.some((d) => d.toLowerCase().includes("iphone"))) platforms.push("iOS");
    if (devices.some((d) => d.toLowerCase().includes("ipad"))) platforms.push("iPadOS");
    if (devices.some((d) => d.toLowerCase().includes("mac"))) {
      if (!platforms.includes("macOS")) platforms.push("macOS");
    }
    if (platforms.length === 0) return ["iOS"];
    return platforms;
  }

  /**
   * Map iTunes price to price tier.
   */
  getPriceTier(price: number | undefined): "Free" | "Paid" {
    if (!price || price === 0) return "Free";
    return "Paid";
  }
}

const itunesService = new ItunesService();
export default itunesService;
export type { ItunesResult };
