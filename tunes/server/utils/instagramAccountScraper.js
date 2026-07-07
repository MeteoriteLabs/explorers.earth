import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/**
 * The page.evaluate extraction logic for a single post page.
 * Reused from instagramPostScraper.js but designed to run inside
 * the same browser session for batch processing.
 */
async function scrapePostPage(page, shortcode) {
    const postUrl = `https://www.instagram.com/p/${shortcode}/`;

    try {
        await page.goto(postUrl, {
            waitUntil: 'networkidle2',
            timeout: 25000
        });

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        const postData = await page.evaluate((sc) => {
            const data = {
                shortcode: sc,
                username: '',
                caption: '',
                thumbnailUrl: '',
                postUrl: `https://www.instagram.com/p/${sc}/`,
                location: '',
                media: []
            };

            const addMedia = (url, type = 'image', width = 0, height = 0) => {
                if (!url || url.startsWith('blob:')) return false;
                const base = url.split('?')[0];
                if (data.media.some(m => m.url.split('?')[0] === base)) return false;
                data.media.push({ type, url, width, height });
                return true;
            };

            function cleanUrl(url) {
                return url
                    .replace(/\\u0026/g, '&')
                    .replace(/\\\//g, '/')
                    .replace(/\\n/g, '')
                    .replace(/\\"/g, '"')
                    .replace(/\\&/g, '&');
            }

            function findDeep(obj, key, depth = 0) {
                if (!obj || typeof obj !== 'object' || depth > 15) return null;
                if (obj[key]) return obj[key];
                for (const k in obj) {
                    const result = findDeep(obj[k], key, depth + 1);
                    if (result) return result;
                }
                return null;
            }

            // Strategy 1: Parse NEW format (2025+)
            try {
                const scripts = document.querySelectorAll('script[type="application/json"]');
                for (const script of scripts) {
                    const text = script.textContent || '';
                    if (!text.includes('xdt_api__v1__media__shortcode__web_info')) continue;

                    try {
                        const json = JSON.parse(text);
                        const webInfo = findDeep(json, 'xdt_api__v1__media__shortcode__web_info');

                        if (webInfo && webInfo.items && webInfo.items.length > 0) {
                            const item = webInfo.items[0];

                            if (item.user?.username) data.username = item.user.username;
                            if (item.caption?.text) data.caption = item.caption.text;
                            if (item.location?.name) data.location = item.location.name;
                            if (item.image_versions2?.candidates?.[0]?.url) {
                                data.thumbnailUrl = item.image_versions2.candidates[0].url;
                            }

                            // Carousel media
                            if (item.carousel_media && item.carousel_media.length > 0) {
                                item.carousel_media.forEach((carouselItem) => {
                                    const isVideo = carouselItem.media_type === 2 ||
                                        (carouselItem.video_versions && carouselItem.video_versions.length > 0);

                                    if (isVideo && carouselItem.video_versions?.[0]?.url) {
                                        addMedia(carouselItem.video_versions[0].url, 'video',
                                            carouselItem.original_width || 0, carouselItem.original_height || 0);
                                    } else if (carouselItem.image_versions2?.candidates?.[0]?.url) {
                                        addMedia(carouselItem.image_versions2.candidates[0].url, 'image',
                                            carouselItem.original_width || 0, carouselItem.original_height || 0);
                                    }
                                });
                            }
                            // Single media
                            else {
                                const isVideo = item.media_type === 2 ||
                                    (item.video_versions && item.video_versions.length > 0);

                                if (isVideo && item.video_versions?.[0]?.url) {
                                    addMedia(item.video_versions[0].url, 'video',
                                        item.original_width || 0, item.original_height || 0);
                                } else if (item.image_versions2?.candidates?.[0]?.url) {
                                    addMedia(item.image_versions2.candidates[0].url, 'image',
                                        item.original_width || 0, item.original_height || 0);
                                }
                            }

                            if (data.media.length > 0) break;
                        }
                    } catch (e) { /* skip */ }
                }
            } catch (e) { /* skip */ }

            // Strategy 2: Legacy format
            if (data.media.length === 0) {
                try {
                    const scripts = document.querySelectorAll('script, script[type="application/json"]');
                    for (const script of scripts) {
                        const text = script.textContent || '';
                        if (text.length < 50) continue;
                        if (!text.includes('shortcode_media') && !text.includes('xdt_shortcode_media')) continue;

                        try {
                            const json = JSON.parse(text);
                            const mediaObj = findDeep(json, 'shortcode_media') ||
                                findDeep(json, 'xdt_shortcode_media');

                            if (mediaObj) {
                                if (mediaObj.owner?.username && !data.username) data.username = mediaObj.owner.username;
                                if (mediaObj.location?.name && !data.location) data.location = mediaObj.location.name;
                                if (!data.caption) {
                                    if (mediaObj.edge_media_to_caption?.edges?.[0]?.node?.text) {
                                        data.caption = mediaObj.edge_media_to_caption.edges[0].node.text;
                                    } else if (mediaObj.caption?.text) {
                                        data.caption = mediaObj.caption.text;
                                    }
                                }
                                if (mediaObj.display_url && !data.thumbnailUrl) data.thumbnailUrl = mediaObj.display_url;

                                if (mediaObj.edge_sidecar_to_children?.edges) {
                                    mediaObj.edge_sidecar_to_children.edges.forEach(edge => {
                                        const node = edge.node;
                                        if (node.is_video && node.video_url) {
                                            addMedia(node.video_url, 'video', node.dimensions?.width, node.dimensions?.height);
                                        } else if (node.display_url) {
                                            addMedia(node.display_url, 'image', node.dimensions?.width, node.dimensions?.height);
                                        }
                                    });
                                } else if (mediaObj.is_video && mediaObj.video_url) {
                                    addMedia(mediaObj.video_url, 'video', mediaObj.dimensions?.width, mediaObj.dimensions?.height);
                                } else if (mediaObj.display_url) {
                                    addMedia(mediaObj.display_url, 'image', mediaObj.dimensions?.width, mediaObj.dimensions?.height);
                                }

                                if (data.media.length > 0) break;
                            }
                        } catch (e) { /* skip */ }
                    }
                } catch (e) { /* skip */ }
            }

            // Strategy 3: Regex extraction
            if (data.media.length === 0) {
                try {
                    const allScripts = document.querySelectorAll('script');
                    for (const script of allScripts) {
                        const text = script.textContent || '';
                        if (text.length < 100) continue;

                        if (text.includes('video_url')) {
                            const regex = /"video_url"\s*:\s*"([^"]+)"/g;
                            let m;
                            while ((m = regex.exec(text)) !== null) {
                                const url = cleanUrl(m[1]);
                                if (url.includes('cdninstagram.com') || url.includes('.mp4')) {
                                    addMedia(url, 'video');
                                }
                            }
                        }

                        if (text.includes('display_url')) {
                            const regex = /"display_url"\s*:\s*"([^"]+)"/g;
                            let m;
                            while ((m = regex.exec(text)) !== null) {
                                const url = cleanUrl(m[1]);
                                if (url.includes('cdninstagram.com') || url.includes('scontent')) {
                                    addMedia(url, 'image');
                                    if (!data.thumbnailUrl) data.thumbnailUrl = url;
                                }
                            }
                        }

                        if (!data.username && text.includes('"username"')) {
                            const m = text.match(/"username"\s*:\s*"([^"]+)"/);
                            if (m) data.username = m[1];
                        }
                        if (!data.location && text.includes('"location"')) {
                            const lm = text.match(/"location"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/);
                            if (lm) data.location = lm[1];
                        }

                        if (data.media.length > 0) break;
                    }
                } catch (e) { /* skip */ }
            }

            // Strategy 4: Meta tags fallback
            try {
                if (!data.caption) {
                    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
                    if (ogTitle) {
                        const captionMatch = ogTitle.match(/on Instagram:\s*"(.+)"$/);
                        if (captionMatch) data.caption = captionMatch[1];
                    }
                    if (!data.caption) {
                        const ogDesc = document.querySelector('meta[property="og:description"]')?.content;
                        if (ogDesc) {
                            const descMatch = ogDesc.match(/:\s*"(.+?)"\.\s*$/);
                            if (descMatch) data.caption = descMatch[1];
                            else data.caption = ogDesc;
                        }
                    }
                }

                if (!data.username) {
                    const ogDesc = document.querySelector('meta[property="og:description"]')?.content;
                    if (ogDesc) {
                        const match = ogDesc.match(/comments?\s*-\s*(\w[\w.]+)\s+on/i) || ogDesc.match(/@(\w[\w.]+)/);
                        if (match) data.username = match[1];
                    }
                }

                if (!data.thumbnailUrl) {
                    const ogImage = document.querySelector('meta[property="og:image"]')?.content;
                    if (ogImage) {
                        data.thumbnailUrl = ogImage;
                        if (data.media.length === 0) addMedia(ogImage, 'image');
                    }
                }

                if (data.media.length === 0) {
                    const ogVideo = document.querySelector('meta[property="og:video"]')?.content ||
                        document.querySelector('meta[property="og:video:secure_url"]')?.content;
                    if (ogVideo) addMedia(ogVideo, 'video');
                }
            } catch (e) { /* skip */ }

            // Set thumbnail from first image if still missing
            if (!data.thumbnailUrl && data.media.length > 0) {
                const img = data.media.find(m => m.type === 'image');
                if (img) data.thumbnailUrl = img.url;
            }

            return data;
        }, shortcode);

        return postData;
    } catch (error) {
        console.error(`   ❌ Error scraping post ${shortcode}:`, error.message);
        return null;
    }
}


/**
 * Scrape all visible posts and reels from a public Instagram profile,
 * then visit each post to extract ALL media (including carousel items).
 *
 * @param {string} username - Instagram username (no @ prefix)
 * @param {object} options
 * @param {number} options.maxScrolls - Max scroll iterations (default 20, ~240 posts)
 * @param {number} options.scrollDelay - Delay between scrolls in ms (default 2000)
 * @returns {Promise<object>} Account data with fully-scraped posts
 */
export async function scrapeInstagramAccountPosts(username, options = {}) {
    const { maxScrolls = 20, scrollDelay = 2000 } = options;
    let browser;

    try {
        console.log('🚀 Launching stealth browser for account scrape:', username);

        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1280,900',
                '--no-first-run',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        // Catch browser crashes so they throw a proper Error instead of crashing Node
        browser.on('disconnected', () => {
            console.error('❌ Puppeteer browser disconnected unexpectedly (Chrome crashed)');
        });

        const page = await browser.newPage();

        // Filter browser console noise
        page.on('console', msg => {
            const text = msg.text();
            if (!text.includes('beforeinstallprompt') &&
                !text.includes('font-family') &&
                !text.includes('%c') &&
                text.length < 300) {
                console.log('🌐 Browser:', text);
            }
        });

        await page.setViewport({ width: 1280, height: 900 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const profileUrl = `https://www.instagram.com/${username}/`;
        console.log('📍 Navigating to:', profileUrl);

        await page.goto(profileUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for initial page content
        await new Promise(resolve => setTimeout(resolve, 3000));

        const pageTitle = await page.title();
        console.log('📄 Page Title:', pageTitle);
        if (pageTitle.toLowerCase().includes('login') || pageTitle.toLowerCase().includes('sign in') || pageTitle.toLowerCase().includes('log in')) {
            throw new Error('Instagram requires login to view this profile. The scraper hit a login wall — Instagram is blocking unauthenticated access for this account.');
        }

        // ============================================
        // Check if account is private or does not exist
        // ============================================
        const pageStatus = await page.evaluate(() => {
            const bodyText = document.body.innerText || '';
            if (bodyText.includes("Sorry, this page isn't available")) {
                return 'not_found';
            }
            if (bodyText.includes('This account is private') || bodyText.includes('This Account is Private')) {
                return 'private';
            }
            return 'ok';
        });

        if (pageStatus === 'not_found') {
            throw new Error(`Profile @${username} does not exist or has been removed.`);
        }
        if (pageStatus === 'private') {
            throw new Error(`Profile @${username} is private. Only public accounts can be scraped.`);
        }

        // ============================================
        // Extract profile info
        // ============================================
        console.log('🔍 Extracting profile info...');

        const profileInfo = await page.evaluate(() => {
            const info = { fullName: '', bio: '', profilePicture: '', postsCount: 0, followersCount: 0, followingCount: 0 };

            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle) {
                const match = ogTitle.content.match(/^(.+?)\s*\(@/);
                if (match) info.fullName = match[1].trim();
            }

            const ogImage = document.querySelector('meta[property="og:image"]');
            if (ogImage) info.profilePicture = ogImage.content;

            const pageText = document.body.innerText;
            const followersMatch = pageText.match(/([\d,.]+[KMB]?)\s+followers/i);
            if (followersMatch) info.followersCount = followersMatch[1].replace(/,/g, '');
            const followingMatch = pageText.match(/([\d,.]+[KMB]?)\s+following/i);
            if (followingMatch) info.followingCount = followingMatch[1].replace(/,/g, '');
            const postsMatch = pageText.match(/([\d,.]+[KMB]?)\s+posts/i);
            if (postsMatch) info.postsCount = postsMatch[1].replace(/,/g, '');

            return info;
        });

        console.log(`📊 Profile: ${profileInfo.fullName || username} — ${profileInfo.postsCount} posts, ${profileInfo.followersCount} followers`);

        // ============================================
        // Collect post shortcodes by scrolling through the grid
        // ============================================
        console.log('📜 Scrolling through post grid...');

        let previousCount = 0;
        let noNewPostsCount = 0;

        for (let i = 0; i < maxScrolls; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await new Promise(resolve => setTimeout(resolve, scrollDelay));

            const currentCount = await page.evaluate(() => {
                const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
                return links.length;
            });

            console.log(`   Scroll ${i + 1}/${maxScrolls}: found ${currentCount} posts`);

            if (currentCount === previousCount) {
                noNewPostsCount++;
                if (noNewPostsCount >= 3) {
                    console.log('   ✅ No more posts to load, stopping scroll.');
                    break;
                }
            } else {
                noNewPostsCount = 0;
            }

            previousCount = currentCount;
        }

        // ============================================
        // Extract all post shortcodes from the grid
        // ============================================
        console.log('🔍 Extracting post shortcodes from grid...');

        const gridPosts = await page.evaluate(() => {
            const seen = new Set();
            const results = [];

            const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');

            links.forEach(link => {
                const href = link.getAttribute('href');
                if (!href) return;

                const postMatch = href.match(/\/p\/([A-Za-z0-9_-]+)/);
                const reelMatch = href.match(/\/reel\/([A-Za-z0-9_-]+)/);
                const shortcode = postMatch?.[1] || reelMatch?.[1];

                if (!shortcode || seen.has(shortcode)) return;
                seen.add(shortcode);

                const type = reelMatch ? 'reel' : 'post';
                let thumbnailUrl = '';
                const img = link.querySelector('img');
                if (img && img.src) thumbnailUrl = img.src;

                let altText = '';
                if (img && img.alt) altText = img.alt;

                const hasVideoIcon = link.querySelector('svg[aria-label="Reel"], svg[aria-label="Video"], span[aria-label="Reel"], span[aria-label="Video"]') !== null;
                const hasCarouselIcon = link.querySelector('svg[aria-label="Carousel"], span[aria-label="Carousel"]') !== null;

                let postType = type;
                if (hasVideoIcon) postType = 'reel';

                results.push({
                    shortcode,
                    type: postType,
                    isCarousel: hasCarouselIcon,
                    gridThumbnailUrl: thumbnailUrl,
                    altText,
                    postUrl: `https://www.instagram.com${href.startsWith('/') ? href : '/' + href}`
                });
            });

            return results;
        });

        console.log(`📋 Found ${gridPosts.length} posts in grid. Now scraping each post for full media...`);

        // ============================================
        // Visit each post and extract full media
        // (reuses the same browser session for speed)
        // ============================================
        const fullPosts = [];

        for (let i = 0; i < gridPosts.length; i++) {
            const gridPost = gridPosts[i];
            console.log(`\n📸 Scraping post ${i + 1}/${gridPosts.length}: ${gridPost.shortcode} [${gridPost.type}]`);

            const postData = await scrapePostPage(page, gridPost.shortcode);

            if (postData && postData.media.length > 0) {
                fullPosts.push({
                    shortcode: gridPost.shortcode,
                    type: gridPost.type,
                    isCarousel: gridPost.isCarousel,
                    thumbnailUrl: postData.thumbnailUrl || gridPost.gridThumbnailUrl,
                    altText: gridPost.altText,
                    postUrl: gridPost.postUrl,
                    caption: postData.caption || '',
                    location: postData.location || '',
                    media: postData.media,
                    mediaCount: postData.media.length
                });
                console.log(`   ✅ Got ${postData.media.length} media items`);
            } else {
                // Fallback to grid thumbnail if scrape failed
                fullPosts.push({
                    shortcode: gridPost.shortcode,
                    type: gridPost.type,
                    isCarousel: gridPost.isCarousel,
                    thumbnailUrl: gridPost.gridThumbnailUrl,
                    altText: gridPost.altText,
                    postUrl: gridPost.postUrl,
                    caption: '',
                    location: '',
                    media: gridPost.gridThumbnailUrl ? [{ type: 'image', url: gridPost.gridThumbnailUrl, width: 0, height: 0 }] : [],
                    mediaCount: gridPost.gridThumbnailUrl ? 1 : 0
                });
                console.log(`   ⚠️ Fallback to grid thumbnail`);
            }

            // Small delay between posts to avoid rate limiting
            if (i < gridPosts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Count total media
        const totalMedia = fullPosts.reduce((sum, p) => sum + p.media.length, 0);

        console.log(`\n✅ ===== ACCOUNT SCRAPE COMPLETE =====`);
        console.log(`   Username: ${username}`);
        console.log(`   Posts scraped: ${fullPosts.length}`);
        console.log(`   Total media items: ${totalMedia}`);
        console.log(`=====================================\n`);

        return {
            username,
            fullName: profileInfo.fullName || username,
            profilePicture: profileInfo.profilePicture,
            postsCount: profileInfo.postsCount,
            followersCount: profileInfo.followersCount,
            followingCount: profileInfo.followingCount,
            posts: fullPosts,
            totalMedia,
            scrapedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Account scrape error:', error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 Browser closed');
        }
    }
}
