import { Express } from 'express';
import { storage } from '../storage';
import { strapiService } from '../services/strapi-service';
import { extractYouTubeVideoId } from '../utils/youtube';

async function logYouTubeAPIUsage(endpointType: 'search' | 'video_details', userId?: number) {
  try {
    console.log('Attempting to log YouTube API usage:', { endpointType, userId });

    const result = await storage.logYoutubeApiUsage({
      endpointType,
      userId,
    });

    console.log('Successfully logged YouTube API usage:', {
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging YouTube API usage:', error);
  }
}

/**
 * Registers YouTube routes
 */
export function setupYouTubeRoutes(app: Express) {
  console.log('\n[YT] ============================================');
  console.log('[YT] Registering route: POST /api/youtube/video-from-url');
  console.log('[YT] Route will be available at: http://localhost:5000/api/youtube/video-from-url');
  console.log('[YT] ============================================\n');

  app.post('/api/youtube/video-from-url', async (req, res) => {
    console.log('\n[YT] ============================================');
    console.log('[YT] YouTube video-from-url endpoint HIT');
    console.log('[YT] ============================================');
    console.log('[YT] Request method:', req.method);
    console.log('[YT] Request path:', req.path);
    console.log('[YT] Request originalUrl:', req.originalUrl);
    console.log('[YT] Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('[YT] Request body:', req.body);
    console.log('[YT] ============================================\n');

    const { url } = req.body;
    console.log('YouTube video-from-url request:', {
      url,
      userId: req.user?.id,
      isAuthenticated: req.isAuthenticated(),
    });

    try {
      if (!url || typeof url !== 'string') {
        return res.status(400).json({
          message: 'URL is required',
          error: 'Missing or invalid URL parameter',
        });
      }

      if (!process.env.YOUTUBE_API_KEY) {
        throw new Error('YouTube API key is not configured');
      }

      const videoId = extractYouTubeVideoId(url);
      if (!videoId) {
        return res.status(400).json({
          message: 'Invalid YouTube URL',
          error: 'Could not extract video ID from URL',
        });
      }

      await logYouTubeAPIUsage('video_details', req.user?.id);

      const params = new URLSearchParams({
        part: 'snippet',
        id: videoId,
        key: process.env.YOUTUBE_API_KEY,
      });

      const apiUrl = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
      console.log('Making YouTube API request to:', apiUrl.replace(process.env.YOUTUBE_API_KEY, '[REDACTED]'));

      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/json',
          referer: 'https://cosmic-playlist.replit.app/',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('YouTube API error response:', errorData);

        if (response.status === 404 || response.status === 400) {
          return res.status(404).json({
            message: 'Video not found',
            error: errorData.error?.message || 'The video could not be found',
          });
        }

        if (response.status === 403) {
          const errorMessage = errorData.error?.message || 'API key validation failed';
          throw new Error(`YouTube API error: ${errorMessage}`);
        }

        throw new Error(`YouTube API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('YouTube API request successful:', {
        itemsCount: data.items?.length,
        timestampUTC: new Date().toISOString(),
      });

      if (!data.items || data.items.length === 0) {
        return res.status(404).json({
          message: 'Video not found',
          error: 'The video could not be found',
        });
      }

      const video = data.items[0];
      const result = {
        id: { videoId: video.id },
        snippet: {
          title: video.snippet.title,
          channelTitle: video.snippet.channelTitle,
          thumbnails: {
            default: { url: video.snippet.thumbnails.default?.url || '' },
          },
        },
      };

      res.json(result);
    } catch (error) {
      console.error('Error in YouTube video-from-url:', error);
      res.status(500).json({
        message: 'Failed to fetch video from URL',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  app.post('/api/youtube/search', async (req, res) => {
    const { query, pageToken } = req.body;
    console.log('YouTube search request:', {
      query,
      pageToken,
      userId: req.user?.id,
      isAuthenticated: req.isAuthenticated(),
    });

    try {
      if (!process.env.YOUTUBE_API_KEY) {
        throw new Error('YouTube API key is not configured');
      }

      console.log('YouTube API key length:', process.env.YOUTUBE_API_KEY.length);
      console.log('Attempting to log YouTube API usage for user:', req.user?.id);
      await logYouTubeAPIUsage('search', req.user?.id);
      console.log('Successfully logged YouTube API usage');

      const params = new URLSearchParams({
        part: 'snippet',
        maxResults: '20',
        q: query,
        type: 'video',
        key: process.env.YOUTUBE_API_KEY,
      });

      if (pageToken) {
        params.append('pageToken', pageToken);
      }

      const apiUrl = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
      console.log('Making YouTube API request to:', apiUrl.replace(process.env.YOUTUBE_API_KEY, '[REDACTED]'));

      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/json',
          referer: 'https://cosmic-playlist.replit.app/',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('YouTube API error response:', errorData);

        if (response.status === 403) {
          const errorMessage = errorData.error?.message || 'API key validation failed';
          throw new Error(`YouTube API error: ${errorMessage}`);
        }

        throw new Error(`YouTube API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('YouTube API request successful:', {
        itemsCount: data.items?.length,
        nextPageToken: data.nextPageToken,
        totalResults: data.pageInfo?.totalResults,
        timestampUTC: new Date().toISOString(),
      });

      res.json(data);

      console.log('[STRAPI] Checking Strapi tracking conditions:', {
        isAuthenticated: req.isAuthenticated(),
        userId: req.user?.id,
        username: req.user?.username,
        userObject: req.user ? { id: req.user.id, username: req.user.username } : null,
        hasUser: !!req.user,
      });

      let username: string | undefined = req.user?.username || req.body.username;

      if (!username && req.user?.id) {
        console.log(`[STRAPI] No username in req.user, fetching from DB for user ID: ${req.user.id}`);
        const user = await storage.getUser(req.user.id);
        username = user?.username;
        console.log(`[STRAPI] Fetched username from DB: ${username || 'NOT FOUND'}`);
      }

      if (!username && req.body.userId) {
        const userId = parseInt(req.body.userId);
        if (!isNaN(userId)) {
          console.log(`[STRAPI] Trying to fetch user by body userId: ${userId}`);
          const user = await storage.getUser(userId);
          username = user?.username;
          console.log(`[STRAPI] Fetched username from body userId: ${username || 'NOT FOUND'}`);
        }
      }

      if (username) {
        console.log(`[STRAPI] About to call strapiService.incrementSongRequests('${username}')`);
        console.log(`[STRAPI] User authenticated: ${req.isAuthenticated()}, User ID: ${req.user?.id}`);

        try {
          const result = await strapiService.incrementSongRequests(username);
          console.log(`[STRAPI] Successfully tracked song search for user: ${username}`, result);
        } catch (strapiError) {
          console.error(`[STRAPI] Failed to track song search in Strapi for user: ${username}:`, strapiError);
          if (strapiError instanceof Error) {
            console.error('[STRAPI] Error details:', strapiError.message);
            console.error('[STRAPI] Error stack:', strapiError.stack);
          }
        }
      } else {
        console.log('[STRAPI] Could not track song search: no username found');
        console.log('[STRAPI] Debug info:', {
          reqUser: req.user ? { id: req.user.id, username: req.user.username } : null,
          bodyUsername: req.body.username,
          bodyUserId: req.body.userId,
        });
      }
    } catch (error) {
      console.error('Error in YouTube search:', error);
      res.status(500).json({
        message: 'Failed to search YouTube',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
