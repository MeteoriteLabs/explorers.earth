import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { storage } from "./storage";
import { Server as SocketIOServer } from 'socket.io';
import type { Socket } from 'socket.io';
import { log } from './vite';
import session from 'express-session';
import express from 'express';
import { themeSchema } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { db } from './db';
import passport from 'passport';
import { setupSwagger } from './swagger';
import { setupUserRoutes } from './user-routes';
import { setupSeoRoutes } from './seo-routes';
import { setupPaymentRoutes } from './routes/paymentRoutes';
import { setupSubscriptionRoutes } from './routes/subscriptionRoutes';
import { setupAdminRoutes } from './routes/adminRoutes';
import { randomBytes, createHash } from 'crypto';
import { emailService } from './services/email-service';
import { importYouTubeMusicPlaylist, importYouTubeMusicPlaylistToMain } from './services/youtube-playlist-import';
import { importSpotifyPlaylist, importSpotifyPlaylistToMain } from './services/spotify-playlist-import';
import { strapiService } from './services/strapi-service';
import { extractYouTubeVideoId, isYouTubeUrl } from './utils/youtube';
import { setupGeminiRoutes } from './routes/geminiRoutes';
import { setupInstagramRoutes } from './routes/instagramRoutes';
import { setupGoogleOAuthRoutes } from './google-oauth-routes';
import { setupAuthBridgeRoutes } from './auth-bridge-routes';
import jwt from 'jsonwebtoken';
import { extractDeviceInfo, extractBrowserInfo, extractOSInfo } from './auth';
import { getGeoInfo } from './utils/geolocation';

// Helper function for logging YouTube API usage
async function logYouTubeAPIUsage(endpointType: 'search' | 'video_details', userId?: number) {
  try {
    // Add debug logging
    console.log('Attempting to log YouTube API usage:', { endpointType, userId });

    const result = await storage.logYoutubeApiUsage({
      endpointType,
      userId
    });

    console.log('Successfully logged YouTube API usage:', {
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging YouTube API usage:', error);
    // Don't throw error to prevent disrupting the main API call
  }
}

export function registerRoutes(app: Express): Server {
  const server = createServer(app);

  // Basic middleware setup
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Log route registration for debugging
  console.log("Registering routes...");
  console.log("Spotify import functions available:", {
    importSpotifyPlaylist: typeof importSpotifyPlaylist,
    importSpotifyPlaylistToMain: typeof importSpotifyPlaylistToMain
  });

  // Setup Swagger documentation
  setupSwagger(app);

  // Setup authentication first - must be before protected routes
  setupAuth(app);

  // Setup Google OAuth routes
  setupGoogleOAuthRoutes(app);

  // Setup Auth Bridge routes (sync Strapi auth with Neon DB)
  setupAuthBridgeRoutes(app);

  // Strapi configuration endpoint for client
  app.get('/api/strapi/config', (req, res) => {
    res.json({
      strapiUrl: process.env.STRAPI_URL || 'https://api.localqr.earth',
      accessToken: process.env.STRAPI_ACCESS_TOKEN || '',
    });
  });

  // Setup user-related routes
  setupUserRoutes(app);

  // Setup admin routes
  setupAdminRoutes(app, storage);

  // Setup SEO-related routes
  setupSeoRoutes(app);

  // Setup payment-related routes
  setupPaymentRoutes(app);

  // Setup subscription-related routes
  setupSubscriptionRoutes(app);

  // Setup Gemini AI routes
  setupGeminiRoutes(app);

  // Setup Instagram scraping routes
  setupInstagramRoutes(app);

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

  // Add the reset password endpoint (moved from auth.ts)

  // Add endpoint to resend verification email

  // Add user password reset endpoint

  // Add team management endpoints




  // API Tokens Management Endpoints

  // Get all API tokens (admin-only)

  // Get user-specific API tokens
  app.get("/api/user/tokens", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = req.user!.id;
      const tokens = await storage.getApiTokens(userId);

      // Only return safe data (mask actual token value)
      const safeTokens = tokens.map(token => ({
        ...token,
        token: token.token ? `${token.token.substring(0, 5)}...${token.token.substring(token.token.length - 5)}` : null
      }));

      res.json(safeTokens);
    } catch (error) {
      console.error('Error fetching user API tokens:', error);
      res.status(500).json({
        message: "Failed to fetch API tokens",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Create new API token

  // Deactivate an API token

  // Delete an API token

  // Email Management Endpoints

  // Email Templates

  // Get all email templates (admin-only)

  // Create new email template

  // Get a specific email template

  // Update an email template

  // Delete an email template

  // Email Logs

  // Get all email logs (admin-only, with pagination)

  // Get single email log by ID

  // Get email logs by status

  // Get email stats

  // Verify email address with SES

  // Send a test email using a template

  // Send email (API)
  app.post("/api/email/send", async (req, res) => {
    // API token authentication
    const apiToken = req.headers.authorization?.split(' ')[1];
    if (!apiToken) {
      return res.status(401).json({ message: "API token is required" });
    }

    try {
      // Validate token
      const token = await storage.getApiTokenByToken(apiToken);
      if (!token || !token.isActive) {
        return res.status(401).json({ message: "Invalid or inactive API token" });
      }

      // Update token last used timestamp
      await storage.updateApiTokenLastUsed(token.id);

      // Get required parameters
      const { recipient, templateId, variables, subject } = req.body;

      // Validate required fields
      if (!recipient || !templateId || !variables) {
        return res.status(400).json({
          message: "Missing required fields",
          required: ["recipient", "templateId", "variables"]
        });
      }

      // Check if AWS SES is configured
      const configValidation = emailService.validateConfig();
      if (!configValidation.isValid) {
        return res.status(500).json({
          message: "Email service is not properly configured",
          details: configValidation.message
        });
      }

      // Send email
      const result = await emailService.sendEmail(
        recipient,
        templateId,
        variables,
        token.id,
        subject
      );

      if (result.success) {
        res.json({
          message: "Email sent successfully",
          messageId: result.messageId
        });
      } else {
        res.status(400).json({
          message: "Failed to send email",
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({
        message: "Failed to send email",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Add user update endpoint
  app.patch("/api/user", async (req, res) => {
    // Support multiple auth methods:
    // 1. Session auth (old)
    // 2. JWT token (new)
    let userId: number;

    // 1. Try session auth first (old system)
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      userId = req.user.id;
      console.log('✅ User update - session auth - User ID:', userId);
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

        console.log('✅ User update - JWT validated for Strapi user:', decoded.id);

        // Look up Neon DB user by username from multiple sources
        // Priority: 1. body (for updates), 2. query params, 3. custom header
        let usernameForLookup = req.body.currentUsername || req.body.username || req.query.username || req.headers['x-username'];

        if (!usernameForLookup) {
          console.error('❌ Username not found in body, query, or headers');
          return res.status(400).json({
            message: "Username required with JWT auth. Please provide username in request body, query parameter, or X-Username header"
          });
        }

        console.log('🔍 Looking up user by username:', usernameForLookup);
        const user = await storage.getUserByUsername(usernameForLookup as string);
        if (!user) {
          console.error('❌ User not found in database:', usernameForLookup);
          return res.status(404).json({ message: "User not found" });
        }

        console.log('✅ Mapped JWT to Neon DB user:', user.username, '(ID:', user.id, ')');
        userId = user.id;

        // Attach user to request for compatibility with existing code
        (req as any).user = user;

        // Track JWT session (same as traditional login)
        try {
          // Use a hash of the JWT token as session ID for tracking
          const jwtSessionId = createHash('sha256').update(token).digest('hex').substring(0, 32);

          const userAgent = req.headers['user-agent'] || '';
          const ipAddress = (
            req.headers['x-forwarded-for'] as string ||
            req.socket.remoteAddress ||
            'Unknown'
          ).split(',')[0].trim();

          const deviceInfo = extractDeviceInfo(userAgent);
          const browserInfo = extractBrowserInfo(userAgent);
          const osInfo = extractOSInfo(userAgent);
          const { countryCode, region, geoData } = getGeoInfo(ipAddress);

          await storage.createUserSession(
            user.id,
            jwtSessionId,
            ipAddress,
            {
              device: {
                type: deviceInfo.type,
                model: deviceInfo.model
              },
              browser: browserInfo,
              os: osInfo,
              isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent.toLowerCase()),
              language: req.headers['accept-language'] || 'en-US'
            },
            countryCode,
            region,
            geoData ? JSON.stringify(geoData) : null
          );

          console.log('📱 JWT session tracked for user:', user.id);
        } catch (sessionError) {
          console.error('Failed to track JWT session:', sessionError);
          // Non-critical, continue anyway
        }
      } catch (error) {
        console.error('❌ JWT validation error:', error);
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    }
    else {
      return res.status(401).json({ message: "Unauthorized - authentication required" });
    }

    const { venueName, theme, allowSongRequests, allowGuestPlayOnDevice, allowPlaylistSharing, allowRecentlyPlayedVisibility, email, username } = req.body;
    console.log('Updating user settings:', { venueName, theme, allowSongRequests, allowGuestPlayOnDevice, allowPlaylistSharing, allowRecentlyPlayedVisibility, email, username });

    try {
      // Validate theme if provided
      if (theme) {
        try {
          const validatedTheme = themeSchema.parse(theme);
          console.log('Theme validation passed:', validatedTheme);
        } catch (error) {
          console.error('Theme validation failed:', error);
          return res.status(400).json({
            message: "Invalid theme format",
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      }

      // Validate email if provided
      if (email !== undefined) {
        // Basic email validation
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({
            message: "Invalid email format"
          });
        }

        // Check if email is already in use (except by current user)
        if (email) {
          const existingUser = await storage.getUserByEmail(email);
          if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({
              message: "Email is already in use by another account"
            });
          }
        }
      }

      // Validate username if provided AND different from current
      // If username equals current user, it's likely for JWT auth, not an update
      if (username !== undefined && (!req.user || username !== req.user.username)) {
        // Validate username format: 3-30 characters, only alphanumeric, underscore, hyphen
        if (!username || username.length < 3 || username.length > 30) {
          return res.status(400).json({
            message: "Username must be between 3 and 30 characters"
          });
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
          return res.status(400).json({
            message: "Username can only contain letters, numbers, underscores, and hyphens"
          });
        }

        // Check if username is already taken (except by current user)
        const existingUser = await storage.getUserByUsername(username);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({
            message: "Username is already taken"
          });
        }
      }

      let updateData: any = {};
      if (venueName) updateData.venueName = venueName;
      if (theme) updateData.theme = theme;
      if (typeof allowSongRequests === 'boolean') {
        updateData.allowSongRequests = allowSongRequests;
      }
      if (typeof allowGuestPlayOnDevice === 'boolean') {
        updateData.allowGuestPlayOnDevice = allowGuestPlayOnDevice;
      }
      if (typeof allowPlaylistSharing === 'boolean') {
        updateData.allowPlaylistSharing = allowPlaylistSharing;
      }
      if (typeof allowRecentlyPlayedVisibility === 'boolean') {
        updateData.allowRecentlyPlayedVisibility = allowRecentlyPlayedVisibility;
      }
      if (email !== undefined) {
        updateData.email = email;
      }
      // Only update username if it's actually changing
      if (username !== undefined && (!req.user || username !== req.user.username)) {
        updateData.username = username;
      }

      console.log('Update data:', updateData);

      const updatedUser = await storage.updateUser(userId, updateData);
      console.log('User updated successfully:', updatedUser);

      // Emit socket events for real-time updates
      if (updatedUser.guestUrl) {
        // Emit appropriate events based on what was updated
        if (typeof allowSongRequests === 'boolean') {
          io.to(updatedUser.guestUrl).emit('message', {
            type: 'SONG_REQUESTS_TOGGLE',
            payload: allowSongRequests
          });
        }

        if (typeof allowGuestPlayOnDevice === 'boolean') {
          io.to(updatedUser.guestUrl).emit('message', {
            type: 'GUEST_PLAY_TOGGLE',
            payload: allowGuestPlayOnDevice
          });
        }

        if (typeof allowPlaylistSharing === 'boolean') {
          io.to(updatedUser.guestUrl).emit('message', {
            type: 'PLAYLIST_SHARING_TOGGLE',
            payload: allowPlaylistSharing
          });
        }

        if (typeof allowRecentlyPlayedVisibility === 'boolean') {
          io.to(updatedUser.guestUrl).emit('message', {
            type: 'RECENTLY_PLAYED_TOGGLE',
            payload: { enabled: allowRecentlyPlayedVisibility }
          });
        }

        // Send an overall update to refresh the UI
        io.to(updatedUser.guestUrl).emit('message', {
          type: 'PLAYLIST_UPDATE'
        });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({
        message: "Failed to update user settings",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get user profile
  app.get("/api/user/profile", async (req, res) => {
    console.log('🔍 Profile request received:', {
      hasSession: req.isAuthenticated?.() && !!req.user,
      hasAuthHeader: !!req.headers.authorization,
      userId: req.query.userId,
      username: req.query.username,
    });

    // Support multiple auth methods
    let userId: number;

    // 1. Try session auth first (old system)
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      console.log('✅ Using session auth - User ID:', req.user.id);
      userId = req.user.id;
    }
    // 2. Try JWT token (new system)
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.substring(7);
      try {
        // Decode JWT to validate it's a real token
        const decoded = jwt.decode(token) as any;
        if (!decoded || !decoded.id) {
          console.log('❌ Invalid JWT token');
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }

        // Check expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          console.log('❌ JWT token expired');
          return res.status(401).json({ message: "Unauthorized - Token expired" });
        }

        console.log('✅ JWT validated for Strapi user ID:', decoded.id);

        // Now look up Neon DB user by username (passed in query)
        const username = req.query.username as string;
        if (!username) {
          return res.status(400).json({ message: "Username required with JWT auth" });
        }

        const user = await storage.getUserByUsername(username);
        if (!user) {
          console.log('❌ User not found:', username);
          return res.status(404).json({ message: "User not found" });
        }

        console.log('✅ Mapped JWT to Neon DB user:', user.username, '(ID:', user.id, ')');
        userId = user.id;
      } catch (error) {
        console.error('❌ JWT validation error:', error);
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    }
    // 3. Legacy: Direct userId (less secure, keeping for backwards compatibility)
    else if (req.query.userId) {
      console.log('⚠️ Using legacy userId param:', req.query.userId);
      userId = parseInt(req.query.userId as string);
    }
    else {
      console.log('❌ No valid auth method provided');
      return res.status(401).json({ message: "Unauthorized - authentication required" });
    }

    try {
      const profile = await storage.getUserProfile(userId);
      res.json(profile || {});
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({
        message: "Failed to fetch profile",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Verify email with token (GET method)
  app.get("/api/verify-email", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Invalid verification token"
        });
      }

      console.log('Verifying email with token (GET):', token);

      // First try the email service verification
      let result = await emailService.verifyUserEmail(token);

      // If the email service verification fails, try direct verification as a fallback
      if (!result.success) {
        console.log('Email service verification failed, attempting direct verification');
        // Find the user by the verification token
        const user = await storage.getUserByVerificationToken(token);

        if (!user) {
          return res.status(400).json({
            success: false,
            message: "Invalid or expired verification token"
          });
        }

        // Check if token is expired
        if (user.emailVerificationExpiry && new Date() > new Date(user.emailVerificationExpiry)) {
          return res.status(400).json({
            success: false,
            message: "Verification token has expired"
          });
        }

        // Mark email as verified and clear the token
        const updated = await storage.markEmailAsVerified(user.id);

        if (updated) {
          result = {
            success: true,
            message: "Email verified successfully",
            userId: user.id
          };
        } else {
          return res.status(500).json({
            success: false,
            message: "Failed to mark email as verified"
          });
        }
      }

      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      res.status(500).json({
        success: false,
        message: "An error occurred while verifying your email"
      });
    }
  });

  // Verify email with token (POST method for forward compatibility)
  app.post("/api/verify-email/:token", async (req, res) => {
    try {
      const { token } = req.params;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
          success: false,
          message: "Invalid verification token"
        });
      }

      console.log('Verifying email with token (POST):', token);

      // First try the email service verification
      let result = await emailService.verifyUserEmail(token);

      // If the email service verification fails, try direct verification as a fallback
      if (!result.success) {
        console.log('Email service verification failed, attempting direct verification');
        // Find the user by the verification token
        const user = await storage.getUserByVerificationToken(token);

        if (!user) {
          return res.status(400).json({
            success: false,
            message: "Invalid or expired verification token"
          });
        }

        // Check if token is expired
        if (user.emailVerificationExpiry && new Date() > new Date(user.emailVerificationExpiry)) {
          return res.status(400).json({
            success: false,
            message: "Verification token has expired"
          });
        }

        // Mark email as verified and clear the token
        const updated = await storage.markEmailAsVerified(user.id);

        if (updated) {
          result = {
            success: true,
            message: "Email verified successfully",
            userId: user.id
          };
        } else {
          return res.status(500).json({
            success: false,
            message: "Failed to mark email as verified"
          });
        }
      }

      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      res.status(500).json({
        success: false,
        message: "An error occurred while verifying your email"
      });
    }
  });

  // Resend verification email
  app.post("/api/resend-verification", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = req.user!;

      if (!user.email) {
        return res.status(400).json({
          success: false,
          message: "No email address is associated with this account"
        });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: "Email is already verified"
        });
      }

      console.log('Resending verification email to user:', user.id);
      const result = await emailService.sendEmailVerification(
        user.id,
        user.email,
        user.username
      );

      if (result.success) {
        res.json({
          success: true,
          message: `Verification email has been sent to ${user.email}`
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error || "Failed to send verification email"
        });
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
      res.status(500).json({
        success: false,
        message: "An error occurred while resending verification email"
      });
    }
  });

  // Create or update user profile  
  app.post("/api/user/profile", async (req, res) => {
    // Support multiple auth methods:
    // 1. Session auth (old)
    // 2. JWT token (new)
    let userId: number;

    // 1. Try session auth first (old system)
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      userId = req.user.id;
      console.log('✅ User profile - session auth - User ID:', userId);
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

        console.log('✅ User profile - JWT validated for Strapi user:', decoded.id);

        // Look up Neon DB user by username from body or query
        let usernameForLookup = req.body.username || req.query.username || req.headers['x-username'];

        if (!usernameForLookup) {
          console.error('❌ Username not found in body, query, or headers');
          return res.status(400).json({
            message: "Username required with JWT auth. Please provide username in request body, query parameter, or X-Username header"
          });
        }

        console.log('🔍 Looking up user by username:', usernameForLookup);
        const user = await storage.getUserByUsername(usernameForLookup as string);
        if (!user) {
          console.error('❌ User not found in database:', usernameForLookup);
          return res.status(404).json({ message: "User not found" });
        }

        console.log('✅ Mapped JWT to Neon DB user:', user.username, '(ID:', user.id, ')');
        userId = user.id;
      } catch (error) {
        console.error('❌ JWT validation error:', error);
        return res.status(401).json({ message: "Unauthorized - Invalid token" });
      }
    }
    else {
      return res.status(401).json({ message: "Unauthorized - authentication required" });
    }

    try {
      const existingProfile = await storage.getUserProfile(userId);
      let profile;

      if (existingProfile) {
        profile = await storage.updateUserProfile(userId, req.body);
      } else {
        profile = await storage.createUserProfile(userId, req.body);
      }

      res.json(profile);
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({
        message: "Failed to update profile",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Delete user profile
  app.delete("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      await storage.deleteUserProfile(req.user!.id);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error deleting user profile:', error);
      res.status(500).json({
        message: "Failed to delete profile",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Add password change endpoint
  app.post("/api/user/change-password", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await storage.getUser(req.user!.id);

    if (!user || !(await comparePasswords(currentPassword, user.password))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    try {
      await storage.updateUserPassword(user.id, await hashPassword(newPassword));
      res.sendStatus(200);
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: "Failed to change password" });
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

  // Admin routes

  // Update user's account manager endpoint



  // Add the stats endpoint after the existing admin endpoints


  // Add YouTube API endpoints
  // Get video details from YouTube URL (register before search to ensure it's matched)
  console.log('\n✅ ============================================');
  console.log('✅ Registering route: POST /api/youtube/video-from-url');
  console.log('✅ Route will be available at: http://localhost:5000/api/youtube/video-from-url');
  console.log('✅ ============================================\n');

  // Register the route with explicit method matching
  // IMPORTANT: This route MUST be registered before Vite middleware is added
  // CRITICAL: Do NOT include 'next' parameter - this is a route handler, not middleware
  app.post("/api/youtube/video-from-url", async (req, res) => {
    console.log('\n🔵 ============================================');
    console.log('🔵 YouTube video-from-url endpoint HIT!');
    console.log('🔵 ============================================');
    console.log('🔵 Request method:', req.method);
    console.log('🔵 Request path:', req.path);
    console.log('🔵 Request originalUrl:', req.originalUrl);
    console.log('🔵 Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('🔵 Request body:', req.body);
    console.log('🔵 ============================================\n');

    const { url } = req.body;
    console.log('YouTube video-from-url request:', {
      url,
      userId: req.user?.id,
      isAuthenticated: req.isAuthenticated()
    });

    try {
      if (!url || typeof url !== 'string') {
        return res.status(400).json({
          message: "URL is required",
          error: "Missing or invalid URL parameter"
        });
      }

      if (!process.env.YOUTUBE_API_KEY) {
        throw new Error("YouTube API key is not configured");
      }

      // Extract video ID from URL
      const videoId = extractYouTubeVideoId(url);
      if (!videoId) {
        return res.status(400).json({
          message: "Invalid YouTube URL",
          error: "Could not extract video ID from URL"
        });
      }

      // Log the video details API usage
      await logYouTubeAPIUsage('video_details', req.user?.id);

      // Call YouTube Data API v3 videos endpoint
      const params = new URLSearchParams({
        part: 'snippet',
        id: videoId,
        key: process.env.YOUTUBE_API_KEY
      });

      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
      console.log('Making YouTube API request to:', apiUrl.replace(process.env.YOUTUBE_API_KEY, '[REDACTED]'));

      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'referer': 'https://cosmic-playlist.replit.app/'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('YouTube API error response:', errorData);

        if (response.status === 404 || response.status === 400) {
          return res.status(404).json({
            message: "Video not found",
            error: errorData.error?.message || "The video could not be found"
          });
        }

        if (response.status === 403) {
          const errorMessage = errorData.error?.message || "API key validation failed";
          throw new Error(`YouTube API error: ${errorMessage}`);
        }
        throw new Error(`YouTube API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('YouTube API request successful:', {
        itemsCount: data.items?.length,
        timestampUTC: new Date().toISOString()
      });

      // Check if video was found
      if (!data.items || data.items.length === 0) {
        return res.status(404).json({
          message: "Video not found",
          error: "The video could not be found"
        });
      }

      // Transform the response to match search results format
      const video = data.items[0];
      const result = {
        id: { videoId: video.id },
        snippet: {
          title: video.snippet.title,
          channelTitle: video.snippet.channelTitle,
          thumbnails: {
            default: { url: video.snippet.thumbnails.default?.url || '' }
          }
        }
      };

      res.json(result);
    } catch (error) {
      console.error('Error in YouTube video-from-url:', error);
      res.status(500).json({
        message: "Failed to fetch video from URL",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/youtube/search", async (req, res) => {
    const { query, pageToken } = req.body;
    console.log('YouTube search request:', {
      query,
      pageToken,
      userId: req.user?.id,
      isAuthenticated: req.isAuthenticated()
    });

    try {
      if (!process.env.YOUTUBE_API_KEY) {
        throw new Error("YouTube API key is not configured");
      }

      // Log the YouTube API key length for debugging (don't log the actual key)
      console.log('YouTube API key length:', process.env.YOUTUBE_API_KEY.length);

      // Log the search API usage with enhanced debugging
      console.log('Attempting to log YouTube API usage for user:', req.user?.id);
      await logYouTubeAPIUsage('search', req.user?.id);
      console.log('Successfully logged YouTube API usage');

      const params = new URLSearchParams({
        part: 'snippet',
        maxResults: '20',
        q: query,
        type: 'video',
        key: process.env.YOUTUBE_API_KEY
      });

      if (pageToken) {
        params.append('pageToken', pageToken);
      }

      const apiUrl = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
      console.log('Making YouTube API request to:', apiUrl.replace(process.env.YOUTUBE_API_KEY, '[REDACTED]'));

      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'referer': 'https://cosmic-playlist.replit.app/'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('YouTube API error response:', errorData);

        if (response.status === 403) {
          const errorMessage = errorData.error?.message || "API key validation failed";
          throw new Error(`YouTube API error: ${errorMessage}`);
        }
        throw new Error(`YouTube API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('YouTube API request successful:', {
        itemsCount: data.items?.length,
        nextPageToken: data.nextPageToken,
        totalResults: data.pageInfo?.totalResults,
        timestampUTC: new Date().toISOString()
      });

      // Send response immediately to user
      res.json(data);

      // Track song search in Strapi after successful API response (non-blocking)
      // This runs in the background and won't delay the user's response
      console.log('🔍 [STRAPI] Checking Strapi tracking conditions:', {
        isAuthenticated: req.isAuthenticated(),
        userId: req.user?.id,
        username: req.user?.username,
        userObject: req.user ? { id: req.user.id, username: req.user.username } : null,
        hasUser: !!req.user
      });

      // Get username - try from req.user first, then request body (for guests), then fetch from DB if needed
      let username: string | undefined = req.user?.username || req.body.username;

      // If username is not available but user ID is, fetch from database
      if (!username && req.user?.id) {
        try {
          const user = await storage.getUser(req.user.id);
          username = user?.username;
          console.log(`🔍 [STRAPI] Fetched username from DB: ${username}`);
        } catch (error) {
          console.error('❌ [STRAPI] Failed to fetch user from DB:', error);
        }
      }

      if (username) {
        console.log(`📊 [STRAPI] Starting Strapi tracking for username: ${username}`);
        console.log(`📊 [STRAPI] About to call strapiService.incrementSongRequests('${username}')`);

        // Make the GraphQL call - this should appear in network tab
        try {
          // Await the Strapi call to ensure it runs
          const result = await strapiService.incrementSongRequests(username);
          console.log(`✅ [STRAPI] Successfully tracked song search in Strapi for user: ${username}, song_requests: ${result.song_requests}`);
        } catch (strapiError) {
          console.error(`❌ [STRAPI] Failed to track song search in Strapi for user: ${username}:`, strapiError);
          if (strapiError instanceof Error) {
            console.error(`❌ [STRAPI] Error details:`, strapiError.message);
            console.error(`❌ [STRAPI] Error stack:`, strapiError.stack);
          }
        }
      } else {
        console.log('⚠️ [STRAPI] Skipping Strapi tracking - username not available:', {
          isAuthenticated: req.isAuthenticated(),
          hasUser: !!req.user,
          hasUsername: !!req.user?.username,
          userId: req.user?.id,
          fetchedUsername: username
        });
      }
    } catch (error) {
      console.error('Error in YouTube search:', error);
      res.status(500).json({
        message: "Failed to search YouTube",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Debug endpoint to test Strapi connection
  app.get("/api/debug/strapi", async (req, res) => {
    try {
      const config = {
        strapiUrl: process.env.STRAPI_URL || 'NOT SET',
        accessToken: process.env.STRAPI_ACCESS_TOKEN ? 'SET (hidden)' : 'NOT SET',
        isConfigured: !!(process.env.STRAPI_URL && process.env.STRAPI_ACCESS_TOKEN)
      };

      if (!config.isConfigured) {
        return res.json({
          status: 'error',
          message: 'Strapi environment variables not configured',
          config
        });
      }

      // Try to make a simple query to test connection
      try {
        const testResult = await strapiService.findSongLimitByUsername('test_user_12345');
        res.json({
          status: 'success',
          message: 'Strapi connection is working',
          config: {
            ...config,
            accessToken: 'SET (hidden)'
          },
          testQuery: testResult ? 'Found test record' : 'No test record found (this is normal)'
        });
      } catch (error) {
        res.json({
          status: 'error',
          message: 'Strapi connection failed',
          config,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Debug endpoint error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get Strapi configuration for client
  app.get("/api/strapi/config", async (req, res) => {
    try {
      const strapiUrl = process.env.STRAPI_URL;
      const accessToken = process.env.STRAPI_ACCESS_TOKEN;

      if (!strapiUrl || !accessToken) {
        return res.status(500).json({
          error: 'Strapi configuration is missing on the server'
        });
      }

      // Return the URL and token to the client
      // Note: In production, you might want to use a more secure approach
      res.json({
        strapiUrl: strapiUrl.endsWith('/') ? strapiUrl.slice(0, -1) : strapiUrl,
        accessToken,
      });
    } catch (error) {
      console.error('Error getting Strapi config:', error);
      res.status(500).json({
        error: 'Failed to get Strapi configuration'
      });
    }
  });

  // Strapi GraphQL proxy endpoint
  app.post("/api/strapi/graphql", async (req, res) => {
    try {
      const { query, variables } = req.body;

      if (!query) {
        return res.status(400).json({
          errors: [{ message: 'GraphQL query is required' }]
        });
      }

      const strapiUrl = process.env.STRAPI_URL;
      const accessToken = process.env.STRAPI_ACCESS_TOKEN;

      if (!strapiUrl || !accessToken) {
        return res.status(500).json({
          errors: [{ message: 'Strapi configuration is missing. Please set STRAPI_URL and STRAPI_ACCESS_TOKEN environment variables.' }]
        });
      }

      const graphqlEndpoint = `${strapiUrl}/graphql`;

      const response = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Strapi API error response:', errorText);
        return res.status(response.status).json({
          errors: [{ message: `Strapi API error: ${response.status} ${response.statusText}` }]
        });
      }

      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        console.error('GraphQL errors:', result.errors);
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('Strapi GraphQL proxy error:', error);
      res.status(500).json({
        errors: [{ message: error instanceof Error ? error.message : 'Unknown error occurred' }]
      });
    }
  });

  // Video details endpoint
  app.get("/api/youtube/video/:id", async (req, res) => {
    try {
      // Log the video details API usage
      await logYouTubeAPIUsage('video_details', req.user?.id);

      // Your existing video details logic here
      // ... (replace with actual video details logic)
      res.json({ message: "Video details fetched" }); // Placeholder

    } catch (error) {
      console.error('Error fetching video details:', error);
      res.status(500).json({ message: "Failed to fetch video details" });
    }
  });

  // Add YouTube stats endpoint for admin

  // Add new system endpoint within registerRoutes function

  // Add the YouTube costs endpoint

  // Modify existing endpoints to log API usage



  // In your video details endpoint
  app.get("/api/youtube/video/:id", async (req, res) => {
    try {
      // Log the video details API usage
      await logYouTubeAPIUsage('video_details');

      // Your existing video details logic here
      // ... (replace with actual video details logic)
      res.json({ message: "Video details fetched" }); // Placeholder

    } catch (error) {
      console.error('Error fetching video details:', error);
      res.status(500).json({ message: "Failed to fetch video details" });
    }
  });

  // Add the user analytics endpoint
  app.get("/api/user/analytics", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = req.user!.id;

      // Get guest interaction metrics
      const guestMetrics = await db.execute(
        `SELECT 
          COUNT(DISTINCT guest_id) as total_views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as total_song_requests,
          AVG(session_duration) as avg_session_duration
        FROM guest_interactions 
        WHERE user_id = $1`,
        [userId]
      );

      // Get daily views and song requests for the last 30 days
      const dailyStats = await db.execute(
        `SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY date
        ORDER BY date`,
        [userId]
      );

      // Get weekly aggregation
      const weeklyStats = await db.execute(
        `SELECT 
          DATE_TRUNC('week', created_at) as week_start,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week_start
        ORDER BY week_start`,
        [userId]
      );

      // Get monthly aggregation
      const monthlyStats = await db.execute(
        `SELECT 
          DATE_TRUNC('month', created_at) as month_start,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month_start
        ORDER BY month_start`,
        [userId]
      );

      // Get session statistics and peak hours
      const sessionStats = await db.execute(
        `SELECT 
          EXTRACT(HOUR FROM start_time) as hour,
          COUNT(*) as session_count
        FROM user_sessions 
        WHERE user_id = $1 
        GROUP BY hour 
        ORDER BY session_count DESC 
        LIMIT 1`,
        [userId]
      );

      // Get playlist statistics
      const playlistStats = await db.execute(
        `SELECT COUNT(*) as total_songs_played
        FROM played_songs 
        WHERE user_id = $1`,
        [userId]
      );

      const peakHour = sessionStats.rows[0]?.hour
        ? `${sessionStats.rows[0].hour}:00`
        : '--';

      res.json({
        guestMetrics: {
          totalViews: parseInt(guestMetrics.rows[0]?.total_views || '0'),
          totalSongRequests: parseInt(guestMetrics.rows[0]?.total_song_requests || '0'),
          avgSessionDuration: Math.round(guestMetrics.rows[0]?.avg_session_duration || 0)
        },
        sessionStats: {
          peakHour,
          avgSessionDuration: Math.round(guestMetrics.rows[0]?.avg_session_duration || 0)
        },
        playlistStats: {
          totalSongsPlayed: parseInt(playlistStats.rows[0]?.total_songs_played || '0')
        },
        timeSeriesData: {
          daily: dailyStats.rows,
          weekly: weeklyStats.rows,
          monthly: monthlyStats.rows
        }
      });

    } catch (error) {
      console.error('Error fetching user analytics:', error);
      res.status(500).json({
        message: "Failed to fetch analytics",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Log user session start
  app.post("/api/login", passport.authenticate("local"), async (req, res) => {
    try {
      // Log user session
      await db.execute(
        `INSERT INTO user_sessions 
        (user_id, start_time, device_info, ip_address) 
        VALUES ($1, NOW(), $2, $3)`,
        [
          req.user!.id,
          JSON.stringify({ userAgent: req.headers['user-agent'] }),
          req.ip
        ]
      );
    } catch (error) {
      console.error('Error logging user session:', error);
    }
    res.status(200).json(req.user);
  });

  // Log user session end
  app.post("/api/logout", async (req, res, next) => {
    if (req.user) {
      try {
        // Update session end time
        await db.execute(
          `UPDATE user_sessions 
          SET end_time = NOW() 
          WHERE user_id = $1 
          AND end_time IS NULL`,
          [req.user.id]
        );
      } catch (error) {
        console.error('Error updating session end time:', error);
      }
    }

    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Add route to log user activity
  app.use(async (req, res, next) => {
    if (req.isAuthenticated()) {
      try {
        const userId = req.user!.id;
        const path = req.path;
        const method = req.method;

        // Use the centralized storage method instead of direct SQL
        await storage.logUserActivity(userId, path, method);
      } catch (error) {
        console.error('Error logging user activity:', error);
      }
    }
    next();
  });


  // Add new system endpoint within registerRoutes function

  // Add the YouTube costs endpoint



  // Add the user analytics endpoint
  app.get("/api/user/analytics", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = req.user!.id;

      // Get guest interaction metrics
      const guestMetrics = await db.execute(
        `SELECT 
          COUNT(DISTINCT guest_id) as total_views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as total_song_requests,
          AVG(session_duration) as avg_session_duration
        FROM guest_interactions 
        WHERE user_id = $1`,
        [userId]
      );

      // Get daily views and song requests for the last 30 days
      const dailyStats = await db.execute(
        `SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY date
        ORDER BY date`,
        [userId]
      );

      // Get weekly aggregation
      const weeklyStats = await db.execute(
        `SELECT 
          DATE_TRUNC('week', created_at) as week_start,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week_start
        ORDER BY week_start`,
        [userId]
      );

      // Get monthly aggregation
      const monthlyStats = await db.execute(
        `SELECT 
          DATE_TRUNC('month', created_at) as month_start,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month_start
        ORDER BY month_start`,
        [userId]
      );

      // Get session statistics and peak hours
      const sessionStats = await db.execute(
        `SELECT 
          EXTRACT(HOUR FROM start_time) as hour,
          COUNT(*) as session_count
        FROM user_sessions 
        WHERE user_id = $1 
        GROUP BY hour 
        ORDER BY session_count DESC 
        LIMIT 1`,
        [userId]
      );

      // Get playlist statistics
      const playlistStats = await db.execute(
        `SELECT COUNT(*) as total_songs_played
        FROM played_songs 
        WHERE user_id = $1`,
        [userId]
      );

      const peakHour = sessionStats.rows[0]?.hour
        ? `${sessionStats.rows[0].hour}:00`
        : '--';

      res.json({
        guestMetrics: {
          totalViews: parseInt(guestMetrics.rows[0]?.total_views || '0'),
          totalSongRequests: parseInt(guestMetrics.rows[0]?.total_song_requests || '0'),
          avgSessionDuration: Math.round(guestMetrics.rows[0]?.avg_session_duration || 0)
        },
        sessionStats: {
          peakHour,
          avgSessionDuration: Math.round(guestMetrics.rows[0]?.avg_session_duration || 0)
        },
        playlistStats: {
          totalSongsPlayed: parseInt(playlistStats.rows[0]?.total_songs_played || '0')
        },
        timeSeriesData: {
          daily: dailyStats.rows,
          weekly: weeklyStats.rows,
          monthly: monthlyStats.rows
        }
      });

    } catch (error) {
      console.error('Error fetching user analytics:', error);
      res.status(500).json({
        message: "Failed to fetch analytics",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Log user session start
  app.post("/api/login", passport.authenticate("local"), async (req, res) => {
    try {
      // Log user session
      await db.execute(
        `INSERT INTO user_sessions 
        (user_id, start_time, device_info, ip_address) 
        VALUES ($1, NOW(), $2, $3)`,
        [
          req.user!.id,
          JSON.stringify({ userAgent: req.headers['user-agent'] }),
          req.ip
        ]
      );
    } catch (error) {
      console.error('Error logging user session:', error);
    }
    res.status(200).json(req.user);
  });

  // Log user session end
  app.post("/api/logout", async (req, res, next) => {
    if (req.user) {
      try {
        // Update session end time
        await db.execute(
          `UPDATE user_sessions 
          SET end_time = NOW() 
          WHERE user_id = $1 
          AND end_time IS NULL`,
          [req.user.id]
        );
      } catch (error) {
        console.error('Error updating session end time:', error);
      }
    }

    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Add route to log user activity
  app.use(async (req, res, next) => {
    if (req.isAuthenticated()) {
      try {
        const userId = req.user!.id;
        const path = req.path;
        const method = req.method;

        // Use the centralized storage method instead of direct SQL
        await storage.logUserActivity(userId, path, method);
      } catch (error) {
        console.error('Error logging user activity:', error);
      }
    }
    next();
  });

  // Get playlist for a user (works for both host and guest URLs)
  app.get("/api/playlist/:guestUrl", async (req, res) => {
    console.log('Fetching playlist for guestUrl:', req.params.guestUrl);
    const user = await storage.getUserByGuestUrl(req.params.guestUrl);
    if (!user) {
      console.log('User not found for guestUrl:', req.params.guestUrl);
      return res.status(404).json({ message: "Playlist not found" });
    }

    const songs = await storage.getSongs(user.id);
    const currentlyPlaying = await storage.getCurrentlyPlaying(user.id);
    const playedSongs = await storage.getPlayedSongs(user.id);

    // Debug log to verify data
    console.log('Sending playlist data:', {
      songs: songs.length,
      user: user.id,
      allowGuestPlayOnDevice: user.allowGuestPlayOnDevice,
      allowRecentlyPlayedVisibility: user.allowRecentlyPlayedVisibility,
      currentlyPlaying: currentlyPlaying ? {
        id: currentlyPlaying.id,
        title: currentlyPlaying.title
      } : null,
      playedSongs: playedSongs.length
    });

    res.json({
      songs,
      user,
      currentlyPlaying,
      playedSongs,
      allowGuestPlayOnDevice: user.allowGuestPlayOnDevice,
      allowRecentlyPlayedVisibility: user.allowRecentlyPlayedVisibility
    });
  });

  // Update currently playing song
  app.post("/api/playlist/currently-playing", async (req, res) => {
    console.log('Updating currently playing song:', req.body);

    // Allow both authenticated users and guest URL access
    let userId: number;

    if (req.isAuthenticated()) {
      userId = req.user!.id;
    } else {
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
      isAuthenticated: req.isAuthenticated()
    });

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

  // Admin routes

  // Update user's account manager endpoint



  // Add the stats endpoint after the existing admin endpoints


  // Add new system endpoint within registerRoutes function

  // Add the YouTube costs endpoint



  // Add the user analytics endpoint
  app.get("/api/user/analytics", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = req.user!.id;

      // Get guest interaction metrics
      const guestMetrics = await db.execute(
        `SELECT 
          COUNT(DISTINCT guest_id) as total_views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as total_song_requests,
          AVG(session_duration) as avg_session_duration
        FROM guest_interactions 
        WHERE user_id = $1`,
        [userId]
      );

      // Get daily views and song requests for the last 30 days
      const dailyStats = await db.execute(
        `SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY date
        ORDER BY date`,
        [userId]
      );

      // Get weekly aggregation
      const weeklyStats = await db.execute(
        `SELECT 
          DATE_TRUNC('week', created_at) as week_start,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week_start
        ORDER BY week_start`,
        [userId]
      );

      // Get monthly aggregation
      const monthlyStats = await db.execute(
        `SELECT 
          DATE_TRUNC('month', created_at) as month_start,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month_start
        ORDER BY month_start`,
        [userId]
      );

      // Get session statistics and peak hours
      const sessionStats = await db.execute(
        `SELECT 
          EXTRACT(HOUR FROM start_time) as hour,
          COUNT(*) as session_count
        FROM user_sessions 
        WHERE user_id = $1 
        GROUP BY hour 
        ORDER BY session_count DESC 
        LIMIT 1`,
        [userId]
      );

      // Get playlist statistics
      const playlistStats = await db.execute(
        `SELECT COUNT(*) as total_songs_played
        FROM played_songs 
        WHERE user_id = $1`,
        [userId]
      );

      const peakHour = sessionStats.rows[0]?.hour
        ? `${sessionStats.rows[0].hour}:00`
        : '--';

      res.json({
        guestMetrics: {
          totalViews: parseInt(guestMetrics.rows[0]?.total_views || '0'),
          totalSongRequests: parseInt(guestMetrics.rows[0]?.total_song_requests || '0'),
          avgSessionDuration: Math.round(guestMetrics.rows[0]?.avg_session_duration || 0)
        },
        sessionStats: {
          peakHour,
          avgSessionDuration: Math.round(guestMetrics.rows[0]?.avg_session_duration || 0)
        },
        playlistStats: {
          totalSongsPlayed: parseInt(playlistStats.rows[0]?.total_songs_played || '0')
        },
        timeSeriesData: {
          daily: dailyStats.rows,
          weekly: weeklyStats.rows,
          monthly: monthlyStats.rows
        }
      });

    } catch (error) {
      console.error('Error fetching user analytics:', error);
      res.status(500).json({
        message: "Failed to fetch analytics",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Log user session start
  app.post("/api/login", passport.authenticate("local"), async (req, res) => {
    try {
      // Log user session
      await db.execute(
        `INSERT INTO user_sessions 
        (user_id, start_time, device_info, ip_address) 
        VALUES ($1, NOW(), $2, $3)`,
        [
          req.user!.id,
          JSON.stringify({ userAgent: req.headers['user-agent'] }),
          req.ip
        ]
      );
    } catch (error) {
      console.error('Error logging user session:', error);
    }
    res.status(200).json(req.user);
  });

  // Log user session end
  app.post("/api/logout", async (req, res, next) => {
    if (req.user) {
      try {
        // Update session end time
        await db.execute(
          `UPDATE user_sessions 
          SET end_time = NOW() 
          WHERE user_id = $1 
          AND end_time IS NULL`,
          [req.user.id]
        );
      } catch (error) {
        console.error('Error updating session end time:', error);
      }
    }

    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Add route to log user activity
  app.use(async (req, res, next) => {
    if (req.isAuthenticated()) {
      try {
        const userId = req.user!.id;
        const path = req.path;
        const method = req.method;
        // Use the centralized storage method instead of direct SQL
        await storage.logUserActivity(userId, path, method);
      } catch (error) {
        console.error('Error logging user activity:', error);
      }
    }
    next();
  });

  // Add the remaining routes from original code here.

  // Update user's account manager endpoint



  // Add the stats endpoint after the existing admin endpoints


  // Add new system endpoint within registerRoutes function

  // Add the YouTube costs endpoint



  // Add the user analytics endpoint
  app.get("/api/user/analytics", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = req.user!.id;

      // Get guest interaction metrics
      const guestMetrics = await db.execute(
        `SELECT 
          COUNT(DISTINCT guest_id) as total_views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as total_song_requests,
          AVG(session_duration) as avg_session_duration
        FROM guest_interactions 
        WHERE user_id = $1`,
        [userId]
      );

      // Get daily views and song requests for the last 30 days
      const dailyStats = await db.execute(
        `SELECT 
          DATE(created_at) as date,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY date
        ORDER BY date`,
        [userId]
      );

      // Get weekly aggregation
      const weeklyStats = await db.execute(
        `SELECT 
          DATE_TRUNC('week', created_at) as week_start,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '12 weeks'
        GROUP BY week_start
        ORDER BY week_start`,
        [userId]
      );

      // Get monthly aggregation
      const monthlyStats = await db.execute(
        `SELECT 
          DATE_TRUNC('month', created_at) as month_start,
          COUNT(DISTINCT CASE WHEN page_view = true THEN guest_id END) as views,
          COUNT(CASE WHEN song_request = true THEN 1 END) as song_requests
        FROM guest_interactions
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY month_start
        ORDER BY month_start`,
        [userId]
      );

      // Get session statistics and peak hours
      const sessionStats = await db.execute(
        `SELECT 
          EXTRACT(HOUR FROM start_time) as hour,
          COUNT(*) as session_count
        FROM user_sessions 
        WHERE user_id = $1 
        GROUP BY hour 
        ORDER BY session_count DESC 
        LIMIT 1`,
        [userId]
      );

      // Get playlist statistics
      const playlistStats = await db.execute(
        `SELECT COUNT(*) as total_songs_played
        FROM played_songs 
        WHERE user_id = $1`,
        [userId]
      );

      const peakHour = sessionStats.rows[0]?.hour
        ? `${sessionStats.rows[0].hour}:00`
        : '--';

      res.json({
        guestMetrics: {
          totalViews: parseInt(guestMetrics.rows[0]?.total_views || '0'),
          totalSongRequests: parseInt(guestMetrics.rows[0]?.total_song_requests || '0'),
          avgSessionDuration: Math.round(guestMetrics.rows[0]?.avg_session_duration || 0)
        },
        sessionStats: {
          peakHour,
          avgSessionDuration: Math.round(guestMetrics.rows[0]?.avg_session_duration || 0)
        },
        playlistStats: {
          totalSongsPlayed: parseInt(playlistStats.rows[0]?.total_songs_played || '0')
        },
        timeSeriesData: {
          daily: dailyStats.rows,
          weekly: weeklyStats.rows,
          monthly: monthlyStats.rows
        }
      });

    } catch (error) {
      console.error('Error fetching user analytics:', error);
      res.status(500).json({
        message: "Failed to fetch analytics",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Log user session start
  app.post("/api/login", passport.authenticate("local"), async (req, res) => {
    try {
      // Log user session
      await db.execute(
        `INSERT INTO user_sessions 
        (user_id, start_time, device_info, ip_address) 
        VALUES ($1, NOW(), $2, $3)`,
        [
          req.user!.id,
          JSON.stringify({ userAgent: req.headers['user-agent'] }),
          req.ip
        ]
      );
    } catch (error) {
      console.error('Error logging user session:', error);
    }
    res.status(200).json(req.user);
  });

  // Log user session end
  app.post("/api/logout", async (req, res, next) => {
    if (req.user) {
      try {
        // Update session end time
        await db.execute(
          `UPDATE user_sessions 
          SET end_time = NOW() 
          WHERE user_id = $1 
          AND end_time IS NULL`,
          [req.user.id]
        );
      } catch (error) {
        console.error('Error updating session end time:', error);
      }
    }

    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Add route to log user activity
  app.use(async (req, res, next) => {
    if (req.isAuthenticated()) {
      try {
        const userId = req.user!.id;
        const path = req.path;
        const method = req.method;
        await storage.logUserActivity(userId, path, method);
      } catch (error) {
        console.error('Error logging user activity:', error);
      }
    }
    next();
  });

  // Add the remaining routes from original code here.

  // Update user's account manager endpoint



  // Add the stats endpoint after the existing admin endpoints


  // Add new system endpoint within registerRoutes function

  // Add the YouTube costs endpoint

  // Modify existing endpoints to log API usage



  // Page content API routes (for Terms & Conditions, Privacy Policy, etc.)
  app.get("/api/page-contents/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const pageContent = await storage.getPageContentBySlug(slug);

      if (!pageContent) {
        return res.status(404).json({ error: "Page content not found" });
      }

      // Only return published content to regular users
      if (!pageContent.isPublished && (!req.user || (req.user as any).role !== 'admin')) {
        return res.status(404).json({ error: "Page content not found" });
      }

      return res.json(pageContent);
    } catch (error) {
      console.error('Error fetching page content:', error);
      return res.status(500).json({ error: "Server error" });
    }
  });

  // Admin routes for managing page content




  const httpServer = createServer(app);
  const sessionMiddleware = app.get('session middleware');

  // Socket.IO setup with better error handling
  const io = new SocketIOServer(httpServer, {
    path: '/ws',
    cors: {
      origin: true,
      credentials: true,
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20000,
    pingInterval: 10000
  });

  // Use session middleware with Socket.IO with better error handling
  io.use((socket, next) => {
    try {
      // For guest connections, skip session check if guestUrl is provided
      const guestUrl = socket.handshake.query.guestUrl;
      if (guestUrl) {
        return next();
      }

      // Otherwise, try to get session
      sessionMiddleware(socket.request as any, {} as any, (err: any) => {
        if (err) {
          console.error('Session middleware error:', err);
          next(new Error('Authentication failed'));
          return;
        }
        next();
      });
    } catch (error) {
      console.error('Error in session middleware:', error);
      next(new Error('Internal server error'));
    }
  });

  // Track clients by room (guestUrl)
  const rooms = new Map<string, Set<string>>();

  io.on('connection', async (socket: Socket) => {
    console.log('New Socket.IO connection attempt');

    try {
      // Extract guestUrl from handshake query
      const { guestUrl } = socket.handshake.query;
      let roomId: string | undefined;

      // Handle guest connections
      if (guestUrl && typeof guestUrl === 'string') {
        const user = await storage.getUserByGuestUrl(guestUrl);
        if (!user) {
          console.log('Invalid guestUrl for Socket.IO connection:', guestUrl);
          socket.emit('connection_status', {
            status: 'error',
            message: 'Invalid guest URL'
          });
          socket.disconnect();
          return;
        }
        roomId = guestUrl;
      }
      // Handle authenticated host connections
      else {
        const session = (socket.request as any).session;
        if (session?.passport?.user) {
          const user = await storage.getUser(session.passport.user);
          if (user) {
            roomId = user.guestUrl;
            console.log('Authenticated host connection for user:', user.id);
          }
        }

        if (!roomId) {
          console.log('No valid authentication or guestUrl provided');
          socket.emit('connection_status', {
            status: 'error',
            message: 'Authentication required'
          });
          socket.disconnect();
          return;
        }
      }

      // Join the room
      await socket.join(roomId);

      // Track clients in room
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }
      rooms.get(roomId)!.add(socket.id);

      console.log(`Client ${socket.id} joined room ${roomId}, total clients:`, rooms.get(roomId)!.size);

      // Send connection confirmation
      socket.emit('connection_status', {
        status: 'connected',
        room: roomId
      });

      // Handle player state updates
      socket.on('player_state', (data) => {
        console.log('Received player state update:', data);
        try {
          // Broadcast to all clients in the room except sender
          socket.to(roomId!).emit('player_state', data);
        } catch (error) {
          console.error('Error broadcasting player state:', error);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Client ${socket.id} disconnected from room ${roomId}`);
        if (roomId && rooms.has(roomId)) {
          rooms.get(roomId)!.delete(socket.id);
          if (rooms.get(roomId)!.size === 0) {
            rooms.delete(roomId);
          }
        }
      });

    } catch (error) {
      console.error('Error handling Socket.IO connection:', error);
      socket.emit('connection_status', {
        status: 'error',
        message: 'Server error'
      });
      socket.disconnect();
    }
  });

  // System settings API endpoints (super admin only)





  // Utility endpoint to get a system setting by key (available for all authenticated users)
  app.get("/api/system-settings/:key", async (req, res) => {
    try {
      const key = req.params.key;
      const setting = await storage.getSystemSetting(key);

      if (!setting) {
        return res.status(404).json({ message: `Setting with key "${key}" not found` });
      }

      // Don't expose secret values to non-super-admins
      if (setting.isSecret && (!req.isAuthenticated() || req.user!.username !== 'yapral27')) {
        return res.status(403).json({ message: "Access to this setting is restricted" });
      }

      res.json(setting);
    } catch (error) {
      console.error('Error fetching system setting:', error);
      res.status(500).json({ message: "Failed to fetch system setting" });
    }
  });

  // Route for admin to create or update system settings

  return httpServer;
}
