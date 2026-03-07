import type { Express } from "express";
import jwt from "jsonwebtoken";
import { sql } from "drizzle-orm";
import { db } from "../db";
import type { IStorage } from "../storage";
import { importYouTubeMusicPlaylist, importYouTubeMusicPlaylistToMain } from "../services/youtube-playlist-import";
import { importSpotifyPlaylist, importSpotifyPlaylistToMain } from "../services/spotify-playlist-import";

export function setupPlaylistRoutes(app: Express, storage: IStorage) {
  // Add guest interaction tracking middleware
  app.use(async (req, res, next) => {
    try {
      // Only track guest playlist interactions
      if (req.path.startsWith('/api/playlist/') && req.method === 'GET') {
        const guestUrl = req.params.guestUrl;
        if (guestUrl) {
          const user = await storage.getUserByGuestUrl(guestUrl);
          if (user) {
            // Use SQL tagged template literal for safe query construction
            await db.execute(sql`
              INSERT INTO guest_interactions 
              (user_id, guest_id, page_view, interaction_type, created_at) 
              VALUES (${user.id}, ${req.sessionID}, true, 'playlist_view', NOW())
            `);
          }
        }
      }
      next();
    } catch (error) {
      console.error('Error in guest interaction middleware:', error);
      next(); // Continue even if logging fails 
    }
  });

  // Add playlist routes
  app.get("/api/playlists", async (req, res) => {
    // Support multiple auth methods:
    // 1. Session auth (old)
    // 2. JWT token (new)
    // 3. Legacy fallbacks
    let userId: number;

    // 1. Try session auth first (old system)
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      userId = req.user.id;
      console.log('✅ Playlists - session auth - User ID:', userId);
    }
    // 2. Try JWT token (new system)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        // Decode JWT to validate
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }

        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }

        console.log('✅ Playlists - JWT validated for Strapi user:', decoded.id);

        // Look up Neon DB user by username (passed in query)
        const username = req.query.username as string;
        if (!username) {
          return res.status(400).json({ message: "Username required with JWT auth" });
        }

        const user = await storage.getUserByUsername(username);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        console.log('✅ Mapped JWT to Neon DB user:', user.username, '(ID:', user.id, ')');
        userId = user.id;
      } catch (error) {
        console.error('❌ JWT validation error:', error);
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    }
    // 3. Legacy fallback - userId query param
    else if (req.query.userId) {
      userId = parseInt(req.query.userId as string);
      console.log('⚠️ Using legacy userId param:', userId);
    }
    else {
      return res.status(401).json({ message: "Unauthorized - authentication required" });
    }

    try {
      const playlists = await storage.getPlaylists(userId);
      console.log('Fetched playlists for user:', userId, '- count:', playlists?.length || 0);
      res.json(playlists);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      res.status(500).json({
        message: "Failed to fetch playlists",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/playlists", async (req, res) => {
    let userId: number;

    // 1. Try session auth
    if (req.isAuthenticated() && req.user) {
      userId = req.user.id;
    }
    // 2. Try JWT token
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }

        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }

        // Look up user
        let usernameForLookup = req.query.username || req.headers['x-username'];
        if (!usernameForLookup && req.body.username) {
          usernameForLookup = req.body.username;
        }

        if (usernameForLookup) {
          const user = await storage.getUserByUsername(usernameForLookup as string);
          if (user) {
            userId = user.id;
          } else {
            return res.status(404).json({ message: "User not found" });
          }
        } else {
          console.error('❌ Username not provided for JWT auth in create playlist');
          return res.status(401).json({ message: "Unauthorized - Username required for JWT auth" });
        }
      } catch (error) {
        console.error('❌ JWT validation error:', error);
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const playlist = await storage.createPlaylist(userId, req.body);
      console.log('Created playlist:', playlist);
      res.status(201).json(playlist);
    } catch (error) {
      console.error('Error creating playlist:', error);
      res.status(500).json({
        message: "Failed to create playlist",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.delete("/api/playlists/:playlistId", async (req, res) => {
    let userId: number;

    // 1. Try session auth
    if (req.isAuthenticated() && req.user) {
      userId = req.user.id;
    }
    // 2. Try JWT token
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }
        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }
        // Look up user
        let usernameForLookup = req.query.username || req.headers['x-username'];
        if (!usernameForLookup && req.body.username) {
          usernameForLookup = req.body.username;
        }

        if (usernameForLookup) {
          const user = await storage.getUserByUsername(usernameForLookup as string);
          if (user) {
            userId = user.id;
          } else {
            return res.status(404).json({ message: "User not found" });
          }
        } else {
          return res.status(401).json({ message: "Unauthorized - Username required for JWT auth" });
        }
      } catch (error) {
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const playlistId = parseInt(req.params.playlistId);
      // Verify playlist belongs to user
      const playlist = await storage.getPlaylistById(playlistId);
      if (!playlist || playlist.userId !== req.user!.id) {
        return res.status(403).json({ message: "Playlist not found or unauthorized" });
      }

      await storage.deletePlaylist(playlistId);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error deleting playlist:', error);
      res.status(500).json({
        message: "Failed to delete playlist",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update playlist details (name and description)
  app.patch("/api/playlists/:playlistId", async (req, res) => {
    let userId: number;

    // 1. Try session auth
    if (req.isAuthenticated() && req.user) {
      userId = req.user.id;
    }
    // 2. Try JWT token
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }
        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }
        // Look up user
        let usernameForLookup = req.query.username || req.headers['x-username'];
        if (!usernameForLookup && req.body.username) {
          usernameForLookup = req.body.username;
        }

        if (usernameForLookup) {
          const user = await storage.getUserByUsername(usernameForLookup as string);
          if (user) {
            userId = user.id;
          } else {
            return res.status(404).json({ message: "User not found" });
          }
        } else {
          return res.status(401).json({ message: "Unauthorized - Username required for JWT auth" });
        }
      } catch (error) {
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const playlistId = parseInt(req.params.playlistId);
      const { name, description } = req.body;

      // Validate request body
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Invalid playlist name" });
      }

      // Verify playlist belongs to user
      const playlist = await storage.getPlaylistById(playlistId);
      if (!playlist || playlist.userId !== userId) {
        return res.status(403).json({ message: "Playlist not found or unauthorized" });
      }

      const updatedPlaylist = await storage.updatePlaylist(playlistId, {
        name,
        description: description || null
      });

      res.json(updatedPlaylist);
    } catch (error) {
      console.error('Error updating playlist:', error);
      res.status(500).json({
        message: "Failed to update playlist",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Add songs to playlist
  app.post("/api/playlists/:playlistId/songs", async (req, res) => {
    let userId: number;

    // 1. Try session auth
    if (req.isAuthenticated() && req.user) {
      userId = req.user.id;
    }
    // 2. Try JWT token
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }
        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }
        // Look up user
        let usernameForLookup = req.query.username || req.headers['x-username'];
        if (!usernameForLookup && req.body.username) {
          usernameForLookup = req.body.username;
        }

        if (usernameForLookup) {
          const user = await storage.getUserByUsername(usernameForLookup as string);
          if (user) {
            userId = user.id;
          } else {
            return res.status(404).json({ message: "User not found" });
          }
        } else {
          return res.status(401).json({ message: "Unauthorized - Username required for JWT auth" });
        }
      } catch (error) {
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const playlistId = parseInt(req.params.playlistId);
      const { songs } = req.body;

      if (!Array.isArray(songs)) {
        return res.status(400).json({ message: "Invalid request format - songs must be an array" });
      }

      // Verify playlist belongs to user
      const playlist = await storage.getPlaylistById(playlistId);
      if (!playlist || playlist.userId !== userId) {
        return res.status(403).json({ message: "Playlist not found or unauthorized" });
      }

      // Process each song
      const processedSongs = songs.map(song => ({
        youtubeId: song.youtubeId,
        title: song.title,
        artist: song.artist,
        thumbnailUrl: song.thumbnailUrl,
        userId: userId
      }));

      await storage.addSongsToPlaylist(playlistId, processedSongs);

      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Error adding songs to playlist:', error);
      res.status(500).json({
        message: "Failed to add songs to playlist",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Import YouTube Music playlist to main playlist
  app.post("/api/playlist/import-youtube", async (req, res) => {
    let userId: number;

    // If authenticated, use the logged-in user's ID
    if (req.isAuthenticated() && req.user) {
      userId = req.user.id;
    }
    // Otherwise, try to get user ID from guest URL
    else {
      const guestUrl = req.query.guestUrl as string;
      if (!guestUrl) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUserByGuestUrl(guestUrl);
      if (!user) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      // Check if song requests are allowed
      if (!user.allowSongRequests) {
        return res.status(403).json({ message: "Song requests are not allowed for this playlist" });
      }

      userId = user.id;
    }

    try {
      const { url: youtubePlaylistUrl } = req.body;

      if (!youtubePlaylistUrl) {
        return res.status(400).json({ message: "YouTube playlist URL is required" });
      }

      if (!process.env.YOUTUBE_API_KEY) {
        return res.status(500).json({ message: "YouTube API key is not configured" });
      }

      // Log the YouTube API usage
      try {
        await storage.logYoutubeApiUsage({
          endpointType: 'playlist_import',
          userId: userId
        });
      } catch (logError) {
        console.error('Error logging YouTube API usage:', logError);
        // Don't throw - continue with the import even if logging fails
      }

      // Import the playlist to main playlist
      const result = await importYouTubeMusicPlaylistToMain(
        youtubePlaylistUrl,
        userId,
        storage,
        process.env.YOUTUBE_API_KEY
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error importing YouTube playlist to main:', error);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('403')) {
          return res.status(403).json({
            message: "Failed to access YouTube playlist",
            error: error.message
          });
        }
        if (error.message.includes('404') || error.message.includes('not found')) {
          return res.status(404).json({
            message: "YouTube playlist not found",
            error: error.message
          });
        }
        if (error.message.includes('quota')) {
          return res.status(429).json({
            message: "YouTube API quota exceeded",
            error: error.message
          });
        }
        if (error.message.includes('Invalid playlist URL')) {
          return res.status(400).json({
            message: "Invalid YouTube playlist URL",
            error: error.message
          });
        }
      }

      res.status(500).json({
        message: "Failed to import YouTube playlist",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Import Spotify playlist to main playlist
  app.post("/api/playlist/import-spotify", async (req, res) => {
    let userId: number;

    // If authenticated, use the logged-in user's ID
    if (req.isAuthenticated() && req.user) {
      userId = req.user.id;
    }
    // Otherwise, try to get user ID from guest URL
    else {
      const guestUrl = req.query.guestUrl as string;
      if (!guestUrl) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUserByGuestUrl(guestUrl);
      if (!user) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      // Check if song requests are allowed
      if (!user.allowSongRequests) {
        return res.status(403).json({ message: "Song requests are not allowed for this playlist" });
      }

      userId = user.id;
    }

    try {
      const { url: spotifyPlaylistUrl } = req.body;

      if (!spotifyPlaylistUrl) {
        return res.status(400).json({ message: "Spotify playlist URL is required" });
      }

      if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        return res.status(500).json({ message: "Spotify API credentials are not configured" });
      }

      if (!process.env.YOUTUBE_API_KEY) {
        return res.status(500).json({ message: "YouTube API key is required for Spotify import (to find YouTube videos)" });
      }

      // Log the YouTube API usage (since we use YouTube API to find videos)
      try {
        await storage.logYoutubeApiUsage({
          endpointType: 'playlist_import',
          userId: userId
        });
      } catch (logError) {
        console.error('Error logging YouTube API usage:', logError);
        // Don't throw - continue with the import even if logging fails
      }

      // Import the playlist to main playlist
      const result = await importSpotifyPlaylistToMain(
        spotifyPlaylistUrl,
        userId,
        storage,
        process.env.SPOTIFY_CLIENT_ID,
        process.env.SPOTIFY_CLIENT_SECRET,
        process.env.YOUTUBE_API_KEY
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error importing Spotify playlist to main:', error);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('authentication')) {
          return res.status(401).json({
            message: "Spotify API authentication failed",
            error: error.message
          });
        }
        if (error.message.includes('403') || error.message.includes('Access denied')) {
          return res.status(403).json({
            message: "Access denied to Spotify playlist",
            error: error.message
          });
        }
        if (error.message.includes('404') || error.message.includes('not found')) {
          return res.status(404).json({
            message: "Spotify playlist not found",
            error: error.message
          });
        }
        if (error.message.includes('Invalid playlist URL')) {
          return res.status(400).json({
            message: "Invalid Spotify playlist URL",
            error: error.message
          });
        }
      }

      res.status(500).json({
        message: "Failed to import Spotify playlist",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Import Spotify playlist to saved playlist
  app.post("/api/playlists/:id/import-spotify", async (req, res) => {
    console.log("Spotify import endpoint hit for playlist:", req.params.id);
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const targetPlaylistId = parseInt(req.params.id);
      const { url: spotifyPlaylistUrl } = req.body;
      console.log("Importing Spotify playlist:", spotifyPlaylistUrl);

      if (!spotifyPlaylistUrl) {
        return res.status(400).json({ message: "Spotify playlist URL is required" });
      }

      const userId = req.user!.id;

      // Verify playlist belongs to user
      const playlist = await storage.getPlaylistById(targetPlaylistId);
      if (!playlist || playlist.userId !== userId) {
        return res.status(403).json({ message: "Playlist not found or unauthorized" });
      }

      if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        return res.status(500).json({ message: "Spotify API credentials are not configured" });
      }

      if (!process.env.YOUTUBE_API_KEY) {
        return res.status(500).json({ message: "YouTube API key is required for Spotify import (to find YouTube videos)" });
      }

      // Log the YouTube API usage (since we use YouTube API to find videos)
      try {
        await storage.logYoutubeApiUsage({
          endpointType: 'playlist_import',
          userId: userId
        });
      } catch (logError) {
        console.error('Error logging YouTube API usage:', logError);
        // Don't throw - continue with the import even if logging fails
      }

      // Import the playlist
      const result = await importSpotifyPlaylist(
        spotifyPlaylistUrl,
        userId,
        targetPlaylistId,
        storage,
        process.env.SPOTIFY_CLIENT_ID,
        process.env.SPOTIFY_CLIENT_SECRET,
        process.env.YOUTUBE_API_KEY
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error importing Spotify playlist:', error);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('authentication')) {
          return res.status(401).json({
            message: "Spotify API authentication failed",
            error: error.message
          });
        }
        if (error.message.includes('403') || error.message.includes('Access denied')) {
          return res.status(403).json({
            message: "Access denied to Spotify playlist",
            error: error.message
          });
        }
        if (error.message.includes('404') || error.message.includes('not found')) {
          return res.status(404).json({
            message: "Spotify playlist not found",
            error: error.message
          });
        }
        if (error.message.includes('Invalid playlist URL')) {
          return res.status(400).json({
            message: "Invalid Spotify playlist URL",
            error: error.message
          });
        }
      }

      res.status(500).json({
        message: "Failed to import Spotify playlist",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Import YouTube Music playlist to saved playlist
  app.post("/api/playlists/:id/import-youtube", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const targetPlaylistId = parseInt(req.params.id);
      const { url: youtubePlaylistUrl } = req.body;

      if (!youtubePlaylistUrl) {
        return res.status(400).json({ message: "YouTube playlist URL is required" });
      }

      if (!process.env.YOUTUBE_API_KEY) {
        return res.status(500).json({ message: "YouTube API key is not configured" });
      }

      const userId = req.user!.id;

      // Verify playlist belongs to user
      const playlist = await storage.getPlaylistById(targetPlaylistId);
      if (!playlist || playlist.userId !== userId) {
        return res.status(403).json({ message: "Playlist not found or unauthorized" });
      }

      // Log the YouTube API usage (using storage directly to support playlist_import type)
      try {
        await storage.logYoutubeApiUsage({
          endpointType: 'playlist_import',
          userId: userId
        });
      } catch (logError) {
        console.error('Error logging YouTube API usage:', logError);
        // Don't throw - continue with the import even if logging fails
      }

      // Import the playlist
      const result = await importYouTubeMusicPlaylist(
        youtubePlaylistUrl,
        userId,
        targetPlaylistId,
        storage,
        process.env.YOUTUBE_API_KEY
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error importing YouTube playlist:', error);

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('403')) {
          return res.status(403).json({
            message: "Failed to access YouTube playlist",
            error: error.message
          });
        }
        if (error.message.includes('404') || error.message.includes('not found')) {
          return res.status(404).json({
            message: "YouTube playlist not found",
            error: error.message
          });
        }
        if (error.message.includes('quota')) {
          return res.status(429).json({
            message: "YouTube API quota exceeded",
            error: error.message
          });
        }
        if (error.message.includes('Invalid playlist URL')) {
          return res.status(400).json({
            message: "Invalid YouTube playlist URL",
            error: error.message
          });
        }
      }

      res.status(500).json({
        message: "Failed to import YouTube playlist",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get playlist with songs
  app.get("/api/playlists/:playlistId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const playlistId = parseInt(req.params.playlistId);
      const playlist = await storage.getPlaylistById(playlistId);

      if (!playlist || playlist.userId !== req.user!.id) {
        return res.status(403).json({ message: "Playlist not found or unauthorized" });
      }

      // Get the songs for this playlist
      const songs = await storage.getPlaylistSongs(playlistId);
      res.json({ playlist, songs });
    } catch (error) {
      console.error('Error fetching playlist:', error);
      res.status(500).json({
        message: "Failed to fetch playlist",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Delete song from playlist
  app.delete("/api/playlists/:playlistId/songs/:songId", async (req, res) => {
    let userId: number;

    // 1. Try session auth
    if (req.isAuthenticated() && req.user) {
      userId = req.user.id;
    }
    // 2. Try JWT token
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }
        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }
        // Look up user
        let usernameForLookup = req.query.username || req.headers['x-username'];
        if (!usernameForLookup && req.body.username) {
          usernameForLookup = req.body.username;
        }

        if (usernameForLookup) {
          const user = await storage.getUserByUsername(usernameForLookup as string);
          if (user) {
            userId = user.id;
          } else {
            return res.status(404).json({ message: "User not found" });
          }
        } else {
          return res.status(401).json({ message: "Unauthorized - Username required for JWT auth" });
        }
      } catch (error) {
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const playlistId = parseInt(req.params.playlistId);
      const songId = parseInt(req.params.songId);

      // Verify playlist belongs to user
      const playlist = await storage.getPlaylistById(playlistId);
      if (!playlist || playlist.userId !== userId) {
        return res.status(403).json({ message: "Playlist not found or unauthorized" });
      }

      // Remove song from playlist
      await storage.removeSongFromPlaylist(playlistId, songId);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error removing song from playlist:', error);
      res.status(500).json({
        message: "Failed to remove song from playlist",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Reorder songs in playlist
  app.patch("/api/playlists/:playlistId/reorder", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const playlistId = parseInt(req.params.playlistId);
      const { songId, position } = req.body;

      console.log('DEBUG - Reorder request received:', {
        playlistId,
        songId,
        position,
        body: req.body,
        userId: req.user!.id
      });

      // Input validation
      if (!Number.isInteger(songId) || !Number.isInteger(position)) {
        console.log('DEBUG - Invalid input types:', { songId, position });
        return res.status(400).json({ message: "Invalid songId or position" });
      }

      // Verify playlist belongs to user
      const playlist = await storage.getPlaylistById(playlistId);
      if (!playlist || playlist.userId !== req.user!.id) {
        console.log('DEBUG - Playlist verification failed:', {
          playlistExists: !!playlist,
          playlistUserId: playlist?.userId,
          requestUserId: req.user!.id
        });
        return res.status(403).json({ message: "Playlist not found or unauthorized" });
      }

      await storage.reorderPlaylistSong(playlistId, songId, position);

      console.log('DEBUG - Reorder completed successfully');
      res.json({ success: true });
    } catch (error) {
      console.error('DEBUG - Error in reorder endpoint:', error);
      res.status(500).json({
        message: "Failed to reorder playlist",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Add route to handle playlist visibility updates
  app.patch("/api/playlists/:playlistId/visibility", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const playlistId = parseInt(req.params.playlistId);
      const { isVisible } = req.body;

      if (typeof isVisible !== 'boolean') {
        return res.status(400).json({ message: "Invalid visibility value" });
      }

      // Verify playlist belongs to user
      const playlist = await storage.getPlaylistById(playlistId);
      if (!playlist || playlist.userId !== req.user!.id) {
        return res.status(403).json({ message: "Playlist not found or unauthorized" });
      }

      // Update playlist visibility
      await storage.updatePlaylistVisibility(playlistId, isVisible);

      res.json({ success: true, isVisibleToGuests: isVisible });
    } catch (error) {
      console.error('Error updating playlist visibility:', error);
      res.status(500).json({
        message: "Failed to update playlist visibility",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Get playlist for a user (works for both host and guest URLs)
  app.get("/api/playlist/:guestUrl", async (req, res) => {
    console.log('Fetching playlist for guestUrl:', req.params.guestUrl);
    try {
      const user = await storage.getUserByGuestUrl(req.params.guestUrl);
      if (!user) {
        console.log('User not found for guestUrl:', req.params.guestUrl);
        return res.status(404).json({ message: "Playlist not found" });
      }

      // Debug log user settings
      console.log('User playlist sharing settings:', {
        userId: user.id,
        allowPlaylistSharing: user.allowPlaylistSharing,
        venueName: user.venueName
      });

      // Fetch all required data
      const songs = await storage.getSongs(user.id);
      const currentlyPlaying = await storage.getCurrentlyPlaying(user.id);
      const playedSongs = await storage.getPlayedSongs(user.id);

      // Define type for playlists with songs
      type PlaylistWithSongs = {
        id: number;
        name: string;
        isVisibleToGuests: boolean;
        songs: Array<{
          id: number;
          title: string;
          artist: string;
          youtubeId: string;
          thumbnailUrl: string;
        }>;
      };

      // Fetch playlists only if playlist sharing is enabled
      let visiblePlaylists: PlaylistWithSongs[] = [];
      if (user.allowPlaylistSharing) {
        console.log('Playlist sharing is enabled, fetching playlists');
        const allPlaylists = await storage.getPlaylists(user.id);
        console.log('Found playlists:', allPlaylists.map(p => ({
          id: p.id,
          name: p.name,
          isVisible: p.isVisibleToGuests
        })));

        // Only include playlists that are marked as visible to guests
        visiblePlaylists = allPlaylists.filter(p => p.isVisibleToGuests);

        // For each playlist, fetch its songs
        for (const playlist of visiblePlaylists) {
          playlist.songs = await storage.getPlaylistSongs(playlist.id);
          console.log(`Playlist ${playlist.name} has ${playlist.songs.length} songs`);
        }
      } else {
        console.log('Playlist sharing is disabled for this user');
      }

      // Debug log the final response data
      console.log('Sending playlist data:', {
        songsCount: songs.length,
        userId: user.id,
        allowGuestPlayOnDevice: user.allowGuestPlayOnDevice,
        allowPlaylistSharing: user.allowPlaylistSharing,
        allowRecentlyPlayedVisibility: user.allowRecentlyPlayedVisibility,
        visiblePlaylistsCount: visiblePlaylists.length,
        currentlyPlaying: currentlyPlaying ? {
          id: currentlyPlaying.id,
          title: currentlyPlaying.title
        } : null
      });

      res.json({
        songs,
        user,
        currentlyPlaying,
        playedSongs,
        allowGuestPlayOnDevice: user.allowGuestPlayOnDevice,
        allowRecentlyPlayedVisibility: user.allowRecentlyPlayedVisibility,
        playlists: user.allowPlaylistSharing ? visiblePlaylists : undefined
      });

    } catch (error) {
      console.error('Error fetching playlist data:', error);
      res.status(500).json({ message: "Failed to fetch playlist data" });
    }
  });

  // Update currently playing song
  app.post("/api/playlist/currently-playing", async (req, res) => {
    console.log('Updating currently playing song:', req.body);

    // Allow both authenticated users and guest URL access
    let userId: number;

    // 1. Try session auth
    if (req.isAuthenticated() && req.user) {
      userId = req.user.id;
    }
    // 2. Try JWT token
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }

        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }

        // Look up user
        let usernameForLookup = req.query.username || req.headers['x-username'];
        if (!usernameForLookup && req.body.username) {
          usernameForLookup = req.body.username;
        }

        if (usernameForLookup) {
          const user = await storage.getUserByUsername(usernameForLookup as string);
          if (user) {
            userId = user.id;
          } else {
            return res.status(404).json({ message: "User not found" });
          }
        } else {
          console.error('❌ Username not provided for JWT auth in currently-playing');
          // Fallback to guest URL check if no username provided
        }
      } catch (error) {
        console.error('❌ JWT validation error:', error);
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    }

    // 3. Fallback to guest URL if not authenticated yet
    if (!userId!) {
      const guestUrl = req.query.guestUrl as string;
      if (!guestUrl) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUserByGuestUrl(guestUrl);
      if (!user) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      userId = user.id;
    }

    const { songId } = req.body;
    if (typeof songId !== "number" && songId !== null) {
      return res.status(400).json({ message: "Invalid song ID" });
    }

    await storage.setCurrentlyPlaying(userId, songId);

    res.sendStatus(200);
  });

  // Add song to playlist (host or guest)
  app.post("/api/playlist/songs", async (req, res) => {
    let userId: number;
    console.log('Add song request received:', {
      body: req.body,
      query: req.query,
      isAuthenticated: req.isAuthenticated(),
      hasAuthHb: !!req.headers.authorization
    });

    // 1. Try session auth (traditional)
    if (req.isAuthenticated() && req.user) {
      userId = req.user.id;
    }
    // 2. Try JWT token (new system)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        // Decode JWT to validate
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }

        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }

        console.log('✅ Add song - JWT validated for Strapi user:', decoded.id);

        // Look up Neon DB user by username from query or header
        let usernameForLookup = req.query.username || req.headers['x-username'];

        if (!usernameForLookup) { // Try to get from body if not in query headers
          usernameForLookup = req.body.username;
        }

        if (!usernameForLookup) {
          console.error('❌ Username not found in query or headers');
          // Fallback to guest URL check if no username provided with token
          // This allows mixed mode where JWT is present but might not be for this specific action if username missing
        } else {
          console.log('🔍 Looking up user by username:', usernameForLookup);
          const user = await storage.getUserByUsername(usernameForLookup as string);
          if (user) {
            console.log('✅ Mapped JWT to Neon DB user:', user.username, '(ID:', user.id, ')');
            userId = user.id;
          } else {
            console.error('❌ User not found in database:', usernameForLookup);
            return res.status(404).json({ message: "User not found" });
          }
        }
      } catch (error) {
        console.error('❌ JWT validation error:', error);
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    }

    // 3. Fallback: try to get user ID from guest URL if not authenticated as user
    if (!userId!) {
      const guestUrl = req.query.guestUrl as string;
      if (!guestUrl) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUserByGuestUrl(guestUrl);
      if (!user) {
        return res.status(404).json({ message: "Playlist not found" });
      }

      // Check if song requests are allowed
      if (!user.allowSongRequests) {
        return res.status(403).json({ message: "Song requests are not allowed for this playlist" });
      }

      userId = user.id;

      // Log guest song request
      try {
        await db.execute(
          `INSERT INTO guest_interactions 
          (user_id, guest_id, song_request, interaction_type, created_at) 
          VALUES ($1, $2, true, 'song_request', NOW())`,
          [userId, req.sessionID]
        );
      } catch (error) {
        console.error('Error logging song request:', error);
      }
    }

    try {
      console.log('Adding song for user:', userId);
      const song = await storage.addSong(userId, req.body);
      res.status(201).json(song);
    } catch (error) {
      console.error('Error adding song:', error);
      res.status(500).json({ message: "Failed to add song to playlist" });
    }
  });

  // Remove song from playlist (host only)
  app.delete("/api/playlist/songs/:songId", async (req, res) => {
    // Support multiple auth methods
    let userId: number;

    // 1. Try session auth first (old system)
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      userId = req.user.id;
      console.log('✅ Delete song - session auth - User ID:', req.user.id);
    }
    // 2. Try JWT token (new system)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        // Decode JWT to validate it's a real token
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }

        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }

        console.log('✅ Delete song - JWT validated for Strapi user:', decoded.id);

        // Look up Neon DB user by username
        const username = req.query.username as string;
        if (!username) {
          return res.status(400).json({ message: "Username required with JWT auth" });
        }

        const user = await storage.getUserByUsername(username);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        console.log('✅ Mapped JWT to Neon DB user:', user.username);
        userId = user.id;
      } catch (error) {
        console.error('❌ JWT validation error:', error);
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    }
    // 3. Legacy fallback
    else if (req.query.userId) {
      userId = parseInt(req.query.userId as string);
    }
    else {
      return res.status(401).json({ message: "Unauthorized - authentication required" });
    }

    try {
      await storage.removeSong(userId, parseInt(req.params.songId));
      res.sendStatus(200);
    } catch (error) {
      console.error('Error removing song:', error);
      res.status(500).json({ message: "Failed to remove song from playlist" });
    }
  });

  // Update song position (host only)
  app.patch("/api/playlist/songs/:songId/position", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { position } = req.body;
    if (typeof position !== "number") {
      return res.status(400).json({ message: "Invalid position" });
    }

    try {
      await storage.updateSongPosition(
        req.user!.id,
        parseInt(req.params.songId),
        position
      );
      res.sendStatus(200);
    } catch (error) {
      console.error('Error updating song position:', error);
      res.status(500).json({ message: "Failed to update song position" });
    }
  });

  // Add bulk delete route with proper error handling
  app.delete("/api/playlist/songs/bulk", async (req, res) => {
    console.log('Server: Bulk delete request received:', {
      body: req.body,
      isAuthenticated: req.isAuthenticated(),
      userId: req.user?.id
    });

    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const { songIds } = req.body;

      // Validate request body
      if (!songIds || !Array.isArray(songIds)) {
        console.error('Server: Invalid request body:', req.body);
        return res.status(400).json({ message: "Invalid request. Expected songIds array." });
      }

      // Convert to numbers and validate
      const validSongIds = songIds
        .map(id => typeof id === 'string' ? parseInt(id, 10) : id)
        .filter(id => !isNaN(id) && typeof id === 'number');

      if (validSongIds.length === 0) {
        console.error('Server: No valid song IDs found in:', songIds);
        return res.status(400).json({ message: "No valid song IDs provided" });
      }

      console.log(`Server: Attempting to delete ${validSongIds.length} songs for user ${req.user!.id}:`, validSongIds);

      // First verify all songs belong to the user
      const userSongs = await storage.getSongs(req.user!.id);
      const userSongIds = new Set(userSongs.map(song => song.id));
      const invalidSongIds = validSongIds.filter(id => !userSongIds.has(id));

      if (invalidSongIds.length > 0) {
        console.error('Server: Found invalid song IDs:', invalidSongIds);
        return res.status(403).json({ message: "Some songs do not belong to the user" });
      }

      await storage.removeMultipleSongs(req.user!.id, validSongIds);

      console.log('Server: Successfully deleted songs');
      res.sendStatus(200);
    } catch (error) {
      console.error('Server: Error in bulk delete route:', error);
      res.status(500).json({
        message: "Failed to remove songs",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Add route to clear playlist history
  app.delete("/api/playlist/history", async (req, res) => {
    console.log('Clear history request received:', {
      isAuthenticated: req.isAuthenticated(),
      userId: req.user?.id
    });

    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      console.log(`Attempting to clear history for user ${req.user!.id}`);
      await storage.clearHistory(req.user!.id);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error clearing history:', error);
      res.status(500).json({ message: "Failed to clear history" });
    }
  });

}
