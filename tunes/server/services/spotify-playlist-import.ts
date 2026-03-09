import type { IStorage } from "../storage";

export interface SpotifyPlaylistItem {
  youtubeId: string; // Will be searched/derived from Spotify track
  title: string;
  artist: string;
  thumbnailUrl: string;
}

export interface SpotifyPlaylistResponse {
  sourcePlaylistId?: string;
  sourcePlaylistUri?: string;
  songsFetched: number;
  songsAdded: number;
  targetPlaylistId?: number;
  status: string;
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyTrack {
  track: {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: {
      images: Array<{ url: string }>;
    };
    external_urls: {
      spotify: string;
    };
  } | null;
}

interface SpotifyPlaylistTracksResponse {
  items: SpotifyTrack[];
  next: string | null;
  total: number;
}

/**
 * Gets an access token from Spotify using Client Credentials flow
 * @param clientId - Spotify Client ID
 * @param clientSecret - Spotify Client Secret
 * @returns Access token
 */
async function getSpotifyAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Failed to get Spotify access token: ${errorData.error_description || response.statusText}`
    );
  }

  const data: SpotifyTokenResponse = await response.json();
  return data.access_token;
}

/**
 * Extracts playlist ID from Spotify playlist URL
 * @param url - Spotify playlist URL
 * @returns Playlist ID
 */
function extractSpotifyPlaylistId(url: string): string {
  try {
    const urlObj = new URL(url);

    // Handle different Spotify URL formats:
    // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
    // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
    const pathParts = urlObj.pathname.split("/");
    const playlistIndex = pathParts.indexOf("playlist");

    if (playlistIndex !== -1 && playlistIndex < pathParts.length - 1) {
      return pathParts[playlistIndex + 1];
    }

    // Also handle spotify:playlist: format
    if (url.includes("spotify:playlist:")) {
      return url.split("spotify:playlist:")[1].split("?")[0];
    }

    throw new Error("Could not extract playlist ID from URL");
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Invalid Spotify playlist URL format");
    }
    throw error;
  }
}

/**
 * Fetches all tracks from a Spotify playlist
 * @param playlistId - Spotify playlist ID
 * @param accessToken - Spotify access token
 * @returns Array of normalized playlist items
 */
async function fetchSpotifyPlaylistTracks(
  playlistId: string,
  accessToken: string
): Promise<SpotifyPlaylistItem[]> {
  if (!playlistId) {
    throw new Error("Playlist ID is required");
  }

  if (!accessToken) {
    throw new Error("Spotify access token is required");
  }

  const allItems: SpotifyPlaylistItem[] = [];
  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
  let pageCount = 0;
  const maxPages = 100; // Safety limit

  try {
    do {
      pageCount++;
      if (pageCount > maxPages) {
        console.warn(`Reached maximum page limit (${maxPages}) for playlist ${playlistId}`);
        break;
      }

      const response = await fetch(nextUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          throw new Error("Spotify API authentication failed. Please check your credentials.");
        }
        if (response.status === 403) {
          throw new Error("Spotify playlist is private. Please make the playlist public in Spotify and try again.");
        }
        if (response.status === 404) {
          throw new Error("Playlist not found. It may be private, deleted, or the playlist ID is invalid.");
        }

        throw new Error(
          `Spotify API error: ${errorData.error?.message || response.statusText}`
        );
      }

      const data: SpotifyPlaylistTracksResponse = await response.json();

      if (!data.items || data.items.length === 0) {
        if (pageCount === 1) {
          throw new Error("Playlist is empty or has no accessible tracks");
        }
        break; // No more items
      }

      // Normalize and extract data from each track
      for (const item of data.items) {
        // Skip null tracks (some playlists may have deleted tracks)
        if (!item.track || !item.track.id) {
          console.warn("Skipping null or deleted track");
          continue;
        }

        const track = item.track;
        const artistNames = track.artists.map((a) => a.name).join(", ");
        const thumbnailUrl =
          track.album?.images?.[0]?.url ||
          track.album?.images?.[1]?.url ||
          "";

        // For now, we'll use the track name and artist to search on YouTube
        // The actual YouTube ID will be resolved when adding to playlist
        // We'll store a searchable format that can be used to find the YouTube video
        const normalizedItem: SpotifyPlaylistItem = {
          youtubeId: "", // Will be empty initially, needs to be resolved
          title: track.name,
          artist: artistNames || "Unknown Artist",
          thumbnailUrl: thumbnailUrl,
        };

        allItems.push(normalizedItem);
      }

      console.log(
        `Fetched ${data.items.length} tracks from page ${pageCount}. Total so far: ${allItems.length}`
      );

      nextUrl = data.next;
    } while (nextUrl);

    console.log(
      `Successfully fetched ${allItems.length} tracks from Spotify playlist ${playlistId}`
    );
    return allItems;
  } catch (error) {
    console.error("Error fetching Spotify playlist:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to fetch Spotify playlist");
  }
}

/**
 * Searches for YouTube video ID based on track title and artist
 * @param title - Track title
 * @param artist - Artist name
 * @param youtubeApiKey - YouTube API key
 * @returns YouTube video ID or null
 */
async function searchYouTubeVideoId(
  title: string,
  artist: string,
  youtubeApiKey: string
): Promise<string | null> {
  try {
    const searchQuery = `${title} ${artist}`;
    const params = new URLSearchParams({
      part: "snippet",
      q: searchQuery,
      type: "video",
      maxResults: "1",
      key: youtubeApiKey,
    });

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.warn(`Failed to search YouTube for: ${searchQuery}`);
      return null;
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].id.videoId;
    }

    return null;
  } catch (error) {
    console.error(`Error searching YouTube for ${title} by ${artist}:`, error);
    return null;
  }
}

/**
 * Imports a Spotify playlist and adds all songs to a target playlist
 * @param url - The Spotify playlist URL
 * @param userId - The authenticated user ID
 * @param targetPlaylistId - The target playlist ID where songs should be added
 * @param storage - The storage interface for database operations
 * @param spotifyClientId - Spotify Client ID
 * @param spotifyClientSecret - Spotify Client Secret
 * @param youtubeApiKey - YouTube API key (for finding YouTube videos)
 * @returns Summary of the import operation
 */
export async function importSpotifyPlaylist(
  url: string,
  userId: number,
  targetPlaylistId: number,
  storage: IStorage,
  spotifyClientId: string,
  spotifyClientSecret: string,
  youtubeApiKey: string
): Promise<SpotifyPlaylistResponse> {
  try {
    // Parse the playlist URL and extract the playlist ID
    const playlistId = extractSpotifyPlaylistId(url);

    // Verify the target playlist exists and belongs to the user
    const targetPlaylist = await storage.getPlaylistById(targetPlaylistId);
    if (!targetPlaylist) {
      throw new Error("Target playlist not found");
    }

    if (targetPlaylist.userId !== userId) {
      throw new Error("Unauthorized: Target playlist does not belong to user");
    }

    // Get Spotify access token
    console.log(`Getting Spotify access token for playlist ${playlistId}`);
    const accessToken = await getSpotifyAccessToken(spotifyClientId, spotifyClientSecret);

    // Fetch all tracks from the Spotify playlist
    console.log(
      `Starting import of Spotify playlist ${playlistId} to target playlist ${targetPlaylistId}`
    );
    const playlistItems = await fetchSpotifyPlaylistTracks(playlistId, accessToken);

    if (playlistItems.length === 0) {
      return {
        sourcePlaylistId: playlistId,
        songsFetched: 0,
        songsAdded: 0,
        targetPlaylistId,
        status: "success",
      };
    }

    // Search for YouTube video IDs for each track
    console.log(`Searching for YouTube videos for ${playlistItems.length} tracks...`);
    const itemsWithYouTubeIds: Array<{
      youtubeId: string;
      title: string;
      artist: string;
      thumbnailUrl: string;
    }> = [];

    for (const item of playlistItems) {
      const youtubeId = await searchYouTubeVideoId(
        item.title,
        item.artist,
        youtubeApiKey
      );

      if (youtubeId) {
        itemsWithYouTubeIds.push({
          youtubeId,
          title: item.title,
          artist: item.artist,
          thumbnailUrl: item.thumbnailUrl,
        });
      } else {
        console.warn(`Could not find YouTube video for: ${item.title} by ${item.artist}`);
      }
    }

    if (itemsWithYouTubeIds.length === 0) {
      return {
        sourcePlaylistId: playlistId,
        songsFetched: playlistItems.length,
        songsAdded: 0,
        targetPlaylistId,
        status: "success",
      };
    }

    // Add all songs to the target playlist in a single transaction
    await storage.addSongsToPlaylist(targetPlaylistId, itemsWithYouTubeIds);

    console.log(
      `Successfully imported ${itemsWithYouTubeIds.length} songs from Spotify playlist ${playlistId} to playlist ${targetPlaylistId}`
    );

    return {
      sourcePlaylistId: playlistId,
      songsFetched: playlistItems.length,
      songsAdded: itemsWithYouTubeIds.length,
      targetPlaylistId,
      status: "success",
    };
  } catch (error) {
    console.error("Error importing Spotify playlist:", error);
    throw error;
  }
}

/**
 * Imports a Spotify playlist and adds all songs to the main playlist
 * @param url - The Spotify playlist URL
 * @param userId - The authenticated user ID
 * @param storage - The storage interface for database operations
 * @param spotifyClientId - Spotify Client ID
 * @param spotifyClientSecret - Spotify Client Secret
 * @param youtubeApiKey - YouTube API key (for finding YouTube videos)
 * @returns Summary of the import operation
 */
export async function importSpotifyPlaylistToMain(
  url: string,
  userId: number,
  storage: IStorage,
  spotifyClientId: string,
  spotifyClientSecret: string,
  youtubeApiKey: string
): Promise<SpotifyPlaylistResponse> {
  try {
    // Parse the playlist URL and extract the playlist ID
    const playlistId = extractSpotifyPlaylistId(url);

    // Get Spotify access token
    console.log(`Getting Spotify access token for playlist ${playlistId}`);
    const accessToken = await getSpotifyAccessToken(spotifyClientId, spotifyClientSecret);

    // Fetch all tracks from the Spotify playlist
    console.log(
      `Starting import of Spotify playlist ${playlistId} to main playlist for user ${userId}`
    );
    const playlistItems = await fetchSpotifyPlaylistTracks(playlistId, accessToken);

    if (playlistItems.length === 0) {
      return {
        sourcePlaylistId: playlistId,
        songsFetched: 0,
        songsAdded: 0,
        status: "success",
      };
    }

    // Search for YouTube video IDs for each track
    console.log(`Searching for YouTube videos for ${playlistItems.length} tracks...`);
    let addedCount = 0;

    for (const item of playlistItems) {
      try {
        const youtubeId = await searchYouTubeVideoId(
          item.title,
          item.artist,
          youtubeApiKey
        );

        if (youtubeId) {
          await storage.addSong(userId, {
            youtubeId,
            title: item.title,
            artist: item.artist,
            thumbnailUrl: item.thumbnailUrl,
            position: 999,
          });
          addedCount++;
        } else {
          console.warn(`Could not find YouTube video for: ${item.title} by ${item.artist}`);
        }
      } catch (error) {
        console.error(`Failed to add song ${item.title} to main playlist:`, error);
        // Continue with other songs even if one fails
      }
    }

    console.log(
      `Successfully imported ${addedCount} songs from Spotify playlist ${playlistId} to main playlist for user ${userId}`
    );

    return {
      sourcePlaylistId: playlistId,
      songsFetched: playlistItems.length,
      songsAdded: addedCount,
      status: "success",
    };
  } catch (error) {
    console.error("Error importing Spotify playlist to main:", error);
    throw error;
  }
}

