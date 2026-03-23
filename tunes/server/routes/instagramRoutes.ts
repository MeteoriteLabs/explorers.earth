import { Express, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
// @ts-ignore - JS utility files without type declarations
import { scrapeInstagramProfile } from '../utils/instagramScraper.js';
// @ts-ignore - JS utility files without type declarations
import { scrapeInstagramPost } from '../utils/instagramPostScraper.js';

/**
 * Simple JWT auth middleware for Instagram routes.
 * Accepts token via Authorization header OR ?token= query param
 * (needed for <img> and <video> tags that can't set headers).
 */
function authenticateToken(req: Request, res: Response, next: NextFunction) {
    // Allow token from query param for img/video tags
    if (!req.headers['authorization'] && req.query.token) {
        req.headers['authorization'] = `Bearer ${req.query.token}`;
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.STRAPI_JWT_SECRET || 'your-strapi-jwt-secret');
        if (!decoded) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        (req as any).user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
}

/**
 * Setup Instagram scraping routes
 * Registers 4 endpoints under /api/instagram prefix:
 *   POST /api/instagram/extract       - Scrape a single Instagram post by URL
 *   POST /api/instagram/profile       - Scrape an Instagram profile by username/URL
 *   POST /api/instagram/account-posts - Scrape ALL posts from a public account
 *   GET  /api/instagram/media-proxy   - Proxy Instagram CDN media (bypasses CORS)
 * 
 * @param app Express application instance
 */
export function setupInstagramRoutes(app: Express) {

    // ============================================
    // POST /api/instagram/extract
    // Extract a single Instagram post by URL
    // ============================================
    app.post('/api/instagram/extract', authenticateToken, async (req: Request, res: Response) => {
        const { postUrl } = req.body;

        if (!postUrl) {
            return res.status(400).json({
                error: 'Missing post URL',
                message: 'Please provide an Instagram post URL'
            });
        }

        const cleanPostUrl = postUrl.trim();
        console.log('🔗 Extracting from:', cleanPostUrl);

        // Extract shortcode from various URL formats (posts, reels, IGTV)
        const shortcodeMatch = cleanPostUrl.match(
            /(?:(?:http|https):\/\/)?(?:www\.)?(?:instagram\.com|instagr\.am)\/(?:p|reel|tv|reels)\/([A-Za-z0-9_-]+)/i
        );

        if (!shortcodeMatch) {
            console.error('❌ Failed to extract shortcode from URL:', postUrl);
            return res.status(400).json({
                error: 'Invalid Instagram URL',
                message: 'Could not extract post ID from URL',
                hint: "Make sure it's a valid Instagram post or reel URL (e.g., instagram.com/p/... or instagram.com/reel/...)"
            });
        }

        const shortcode = shortcodeMatch[1];

        try {
            console.log('\n=== Instagram Post Extraction (Puppeteer) ===');
            console.log('Shortcode:', shortcode);

            const postData = await scrapeInstagramPost(shortcode);

            console.log('\n📊 Post extracted successfully');
            console.log('============================\n');

            const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;

            res.json({
                success: true,
                data: {
                    username: postData.username || 'Unknown',
                    authorUrl: `https://www.instagram.com/${postData.username || ''}/`,
                    thumbnailUrl: postData.thumbnailUrl || '',
                    media: postData.media || [],
                    caption: postData.caption || 'No caption available',
                    postUrl: postData.postUrl,
                    location: postData.location || '',
                    shortcode: shortcode,
                    embedUrl: embedUrl,
                    embedHtml: `<iframe src="${embedUrl}" width="400" height="480" frameborder="0" scrolling="no" allowtransparency="true"></iframe>`
                }
            });

        } catch (error: any) {
            console.error('❌ Extraction error:', error.message);

            if (error.response?.status === 404) {
                return res.status(404).json({
                    error: 'Post not found',
                    message: 'This post may be private, deleted, or the URL is incorrect',
                    hint: 'Make sure the post is public and the URL is correct'
                });
            }

            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return res.status(408).json({
                    error: 'Request timeout',
                    message: 'Instagram took too long to respond',
                    hint: 'Try again in a moment'
                });
            }

            res.status(500).json({
                error: 'Extraction failed',
                message: 'Could not extract post data',
                hint: 'The post might be private or Instagram changed their format',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });

    // ============================================
    // POST /api/instagram/profile
    // Extract Instagram profile by username or URL
    // ============================================
    app.post('/api/instagram/profile', authenticateToken, async (req: Request, res: Response) => {
        let { username, profileUrl } = req.body;

        // Extract username from URL if provided
        if (profileUrl) {
            const usernameMatch = profileUrl.match(/instagram\.com\/([^/?]+)/);
            if (usernameMatch) {
                username = usernameMatch[1];
            }
        }

        if (!username) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Please provide a username or profile URL'
            });
        }

        // Clean username (remove @ if present)
        username = username.replace(/^@/, '').trim();

        try {
            console.log('\n=== Instagram Profile Extraction (Puppeteer) ===');
            console.log('Username:', username);

            const profileData = await scrapeInstagramProfile(username);

            console.log('\n📊 Profile extracted:');
            console.log('  Username:', profileData.username);
            console.log('  Full Name:', profileData.fullName);
            console.log('  Bio length:', profileData.bio.length);
            console.log('  Posts:', profileData.postsCount);
            console.log('  Followers:', profileData.followersCount);
            console.log('  Has profile pic:', !!profileData.profilePicture);
            console.log('============================\n');

            res.json({
                success: true,
                data: {
                    username: profileData.username,
                    fullName: profileData.fullName || username,
                    bio: profileData.bio || '',
                    profilePicture: profileData.profilePicture || '',
                    postsCount: profileData.postsCount,
                    followersCount: profileData.followersCount,
                    followingCount: profileData.followingCount,
                    profileUrl: `https://www.instagram.com/${username}/`,
                    isPublic: !profileData.isPrivate,
                    isVerified: profileData.isVerified,
                    externalUrl: profileData.externalUrl
                }
            });

        } catch (error: any) {
            console.error('❌ Profile extraction error:', error.message);

            if (error.message.includes('timeout') || error.message.includes('waiting for selector')) {
                return res.status(404).json({
                    error: 'Profile not found or private',
                    message: 'Could not load profile data. The account may be private or does not exist.',
                    hint: 'Make sure the username is correct and the account is public'
                });
            }

            res.status(500).json({
                error: 'Extraction failed',
                message: 'Unable to extract profile data',
                hint: 'The profile might be private or Instagram changed their format',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });

    // ============================================
    // POST /api/instagram/account-posts
    // Scrape ALL posts from a public account
    // ============================================
    app.post('/api/instagram/account-posts', authenticateToken, async (req: Request, res: Response) => {
        let { username, profileUrl, maxScrolls } = req.body;

        // Extract username from URL if provided
        if (profileUrl) {
            const usernameMatch = profileUrl.match(/instagram\.com\/([^/?]+)/);
            if (usernameMatch) {
                username = usernameMatch[1];
            }
        }

        if (!username) {
            return res.status(400).json({
                error: 'Invalid input',
                message: 'Please provide a username or profile URL'
            });
        }

        // Clean username (remove @ if present)
        username = username.replace(/^@/, '').trim();

        // Validate maxScrolls
        const scrollCount = Math.min(Math.max(parseInt(maxScrolls) || 20, 1), 100);

        try {
            console.log('\n=== Instagram Account Scrape (Puppeteer) ===');
            console.log('Username:', username);
            console.log('Max scrolls:', scrollCount);

            // Dynamic import for the heavy account scraper
            // @ts-ignore - JS utility file without type declarations
            const { scrapeInstagramAccountPosts } = await import('../utils/instagramAccountScraper.js');
            const accountData = await scrapeInstagramAccountPosts(username, { maxScrolls: scrollCount });

            console.log('\n📊 Account scraped:');
            console.log('  Username:', accountData.username);
            console.log('  Posts found:', accountData.posts.length);
            console.log('============================\n');

            res.json({
                success: true,
                data: {
                    username: accountData.username,
                    fullName: accountData.fullName,
                    profilePicture: accountData.profilePicture,
                    postsCount: accountData.postsCount,
                    followersCount: accountData.followersCount,
                    followingCount: accountData.followingCount,
                    posts: accountData.posts,
                    totalScraped: accountData.posts.length,
                    totalMedia: accountData.totalMedia || 0,
                    scrapedAt: accountData.scrapedAt
                }
            });

        } catch (error: any) {
            console.error('❌ Account scrape error:', error.message);

            if (error.message.includes('private')) {
                return res.status(403).json({
                    error: 'Private account',
                    message: error.message,
                    hint: 'Only public accounts can be scraped'
                });
            }

            if (error.message.includes('does not exist') || error.message.includes('not found')) {
                return res.status(404).json({
                    error: 'Account not found',
                    message: error.message,
                    hint: 'Make sure the username is correct'
                });
            }

            if (error.message.includes('timeout') || error.message.includes('waiting for selector')) {
                return res.status(408).json({
                    error: 'Request timeout',
                    message: 'Instagram took too long to respond. Try again.',
                    hint: 'The profile might have too many posts or Instagram is rate limiting'
                });
            }

            res.status(500).json({
                error: 'Scrape failed',
                message: 'Unable to scrape account posts',
                hint: 'The profile might be private or Instagram changed their format',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });

    // ============================================
    // GET /api/instagram/media-proxy
    // Proxy Instagram CDN media to bypass CORS
    // Accepts auth via Authorization header OR ?token= query param
    // ============================================
    app.get('/api/instagram/media-proxy', authenticateToken, async (req: Request, res: Response) => {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                error: 'Missing URL',
                message: 'Please provide a media URL to proxy'
            });
        }

        // Only allow proxying Instagram CDN URLs for security
        const decodedUrl = decodeURIComponent(url as string);
        const allowedDomains = [
            'cdninstagram.com',
            'fbcdn.net',
            'instagram.com',
            'scontent.cdninstagram.com'
        ];

        const isAllowed = allowedDomains.some(domain => decodedUrl.includes(domain));
        if (!isAllowed) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Only Instagram CDN URLs are allowed'
            });
        }

        try {
            const response = await axios.get(decodedUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.instagram.com/',
                }
            });

            // Forward the content type from Instagram's response
            const contentType = response.headers['content-type'] || 'application/octet-stream';
            res.set('Content-Type', contentType);
            res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
            res.send(Buffer.from(response.data));

        } catch (error: any) {
            console.error('❌ Media proxy error:', error.message);
            res.status(502).json({
                error: 'Proxy failed',
                message: 'Could not download the media file',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    });

    console.log('✅ Instagram scraping routes registered');
}
