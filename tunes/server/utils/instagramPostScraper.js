import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/**
 * Extract Instagram post data using Puppeteer.
 * 
 * Strategy priority:
 *   1. Regular post page → parse xdt_api__v1__media__shortcode__web_info (new Instagram format 2025+)
 *   2. Regular post page → parse shortcode_media / xdt_shortcode_media (legacy format)
 *   3. Regular post page → regex extraction from scripts
 *   4. Meta tags (og:title, og:description, og:image) as fallback for caption/username
 *   5. Embed page as last resort for media
 * 
 * No Instagram login required!
 * 
 * @param {string} shortcode - Instagram post shortcode
 * @returns {Promise<Object>} Post data
 */
export async function scrapeInstagramPost(shortcode) {
    let browser;

    try {
        console.log('🚀 Launching stealth browser for post:', shortcode);

        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1280,800',
                '--no-first-run',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled'
            ]
        });

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

        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // ============================================
        // Navigate to the REGULAR post page first
        // (Contains all structured data in the new format)
        // ============================================
        const postUrl = `https://www.instagram.com/p/${shortcode}/`;
        console.log('📍 Navigating to post page:', postUrl);

        await page.goto(postUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('⏳ Waiting for page to load...');
        await new Promise(resolve => setTimeout(resolve, 4000));

        // ============================================
        // Extract data from all strategies
        // ============================================
        console.log('🔍 Extracting data from post page...');

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

            // ============================================
            // Strategy 1: Parse NEW format (2025+)
            // Key: xdt_api__v1__media__shortcode__web_info
            // ============================================
            console.log('🔍 Strategy 1: Parsing new Instagram format (xdt_api__v1__media)...');

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
                            console.log('   ✅ Found xdt_api__v1__media__shortcode__web_info');

                            // Username
                            if (item.user?.username) {
                                data.username = item.user.username;
                                console.log('   ✅ Username:', data.username);
                            }

                            // Caption
                            if (item.caption?.text) {
                                data.caption = item.caption.text;
                                console.log('   ✅ Caption:', data.caption.substring(0, 50) + '...');
                            }

                            // Location
                            if (item.location?.name) {
                                data.location = item.location.name;
                                console.log('   ✅ Location:', data.location);
                            }

                            // Thumbnail from main image
                            if (item.image_versions2?.candidates?.[0]?.url) {
                                data.thumbnailUrl = item.image_versions2.candidates[0].url;
                            }

                            // Carousel media
                            if (item.carousel_media && item.carousel_media.length > 0) {
                                console.log(`   📸 Carousel: ${item.carousel_media.length} items`);
                                item.carousel_media.forEach((carouselItem, i) => {
                                    const isVideo = carouselItem.media_type === 2 ||
                                        (carouselItem.video_versions && carouselItem.video_versions.length > 0);

                                    if (isVideo && carouselItem.video_versions?.[0]?.url) {
                                        addMedia(carouselItem.video_versions[0].url, 'video',
                                            carouselItem.original_width || 0,
                                            carouselItem.original_height || 0);
                                        console.log(`   Media ${i + 1}: VIDEO ✅`);
                                    } else if (carouselItem.image_versions2?.candidates?.[0]?.url) {
                                        addMedia(carouselItem.image_versions2.candidates[0].url, 'image',
                                            carouselItem.original_width || 0,
                                            carouselItem.original_height || 0);
                                        console.log(`   Media ${i + 1}: IMAGE ✅`);
                                    }
                                });
                            }
                            // Single media (not carousel)
                            else {
                                const isVideo = item.media_type === 2 ||
                                    (item.video_versions && item.video_versions.length > 0);

                                if (isVideo && item.video_versions?.[0]?.url) {
                                    addMedia(item.video_versions[0].url, 'video',
                                        item.original_width || 0, item.original_height || 0);
                                    console.log('   Media: VIDEO ✅');
                                } else if (item.image_versions2?.candidates?.[0]?.url) {
                                    addMedia(item.image_versions2.candidates[0].url, 'image',
                                        item.original_width || 0, item.original_height || 0);
                                    console.log('   Media: IMAGE ✅');
                                }
                            }

                            if (data.media.length > 0) {
                                console.log(`   ✅ Strategy 1 SUCCESS: ${data.media.length} media items`);
                                break;
                            }
                        }
                    } catch (e) {
                        console.error('   ❌ Error parsing script:', e.message);
                    }
                }
            } catch (e) {
                console.error('❌ Strategy 1 error:', e.message);
            }

            // ============================================
            // Strategy 2: Parse LEGACY format
            // Keys: shortcode_media, xdt_shortcode_media, graphql
            // ============================================
            if (data.media.length === 0) {
                console.log('🔍 Strategy 2: Parsing legacy format (shortcode_media)...');

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
                                console.log('   📜 Found legacy media object');

                                // Username
                                if (mediaObj.owner?.username && !data.username) {
                                    data.username = mediaObj.owner.username;
                                }

                                // Location
                                if (mediaObj.location?.name && !data.location) {
                                    data.location = mediaObj.location.name;
                                }

                                // Caption
                                if (!data.caption) {
                                    if (mediaObj.edge_media_to_caption?.edges?.[0]?.node?.text) {
                                        data.caption = mediaObj.edge_media_to_caption.edges[0].node.text;
                                    } else if (mediaObj.caption?.text) {
                                        data.caption = mediaObj.caption.text;
                                    }
                                }

                                // Thumbnail
                                if (mediaObj.display_url && !data.thumbnailUrl) {
                                    data.thumbnailUrl = mediaObj.display_url;
                                }

                                // Carousel (sidecar)
                                if (mediaObj.edge_sidecar_to_children?.edges) {
                                    mediaObj.edge_sidecar_to_children.edges.forEach((edge, i) => {
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

                                if (data.media.length > 0) {
                                    console.log(`   ✅ Strategy 2 SUCCESS: ${data.media.length} media items`);
                                    break;
                                }
                            }
                        } catch (e) {
                            // Not valid JSON, skip
                        }
                    }
                } catch (e) {
                    console.error('❌ Strategy 2 error:', e.message);
                }
            }

            // ============================================
            // Strategy 3: Regex extraction from scripts
            // ============================================
            if (data.media.length === 0) {
                console.log('🔍 Strategy 3: Regex extraction...');

                try {
                    const allScripts = document.querySelectorAll('script');
                    for (const script of allScripts) {
                        const text = script.textContent || '';
                        if (text.length < 100) continue;

                        // video_url
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

                        // display_url
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

                        // username
                        if (!data.username && text.includes('"username"')) {
                            const m = text.match(/"username"\s*:\s*"([^"]+)"/);
                            if (m) data.username = m[1];
                        }

                        // location
                        if (!data.location && text.includes('"location"')) {
                            const lm = text.match(/"location"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/);
                            if (lm) data.location = lm[1];
                        }

                        if (data.media.length > 0) break;
                    }
                } catch (e) {
                    console.error('❌ Strategy 3 error:', e.message);
                }
            }

            // ============================================
            // Strategy 4: Meta tags fallback
            // (Always runs for missing fields)
            // ============================================
            console.log('🔍 Strategy 4: Meta tag fallbacks...');

            try {
                // Caption from og:title (contains the actual caption text)
                if (!data.caption) {
                    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
                    if (ogTitle) {
                        // Format: "Username on Instagram: \"caption text\""
                        const captionMatch = ogTitle.match(/on Instagram:\s*"(.+)"$/);
                        if (captionMatch) {
                            data.caption = captionMatch[1];
                        }
                    }
                    // Fallback to og:description
                    if (!data.caption) {
                        const ogDesc = document.querySelector('meta[property="og:description"]')?.content;
                        if (ogDesc) {
                            // Format: "123 likes, 4 comments - username on May 1, 2025: "caption""
                            const descMatch = ogDesc.match(/:\s*"(.+?)"\.\s*$/);
                            if (descMatch) {
                                data.caption = descMatch[1];
                            } else {
                                data.caption = ogDesc;
                            }
                        }
                    }
                }

                // Username from og:description
                if (!data.username) {
                    const ogDesc = document.querySelector('meta[property="og:description"]')?.content;
                    if (ogDesc) {
                        const match = ogDesc.match(/comments?\s*-\s*(\w[\w.]+)\s+on/i) ||
                            ogDesc.match(/@(\w[\w.]+)/);
                        if (match) data.username = match[1];
                    }
                }

                // Thumbnail from og:image
                if (!data.thumbnailUrl) {
                    const ogImage = document.querySelector('meta[property="og:image"]')?.content;
                    if (ogImage) {
                        data.thumbnailUrl = ogImage;
                        if (data.media.length === 0) addMedia(ogImage, 'image');
                    }
                }

                // Video from og:video
                if (data.media.length === 0) {
                    const ogVideo = document.querySelector('meta[property="og:video"]')?.content ||
                        document.querySelector('meta[property="og:video:secure_url"]')?.content;
                    if (ogVideo) addMedia(ogVideo, 'video');
                }
            } catch (e) {
                console.error('❌ Strategy 4 error:', e.message);
            }

            // Set thumbnail from first image if still missing
            if (!data.thumbnailUrl && data.media.length > 0) {
                const img = data.media.find(m => m.type === 'image');
                if (img) data.thumbnailUrl = img.url;
            }

            return data;
        }, shortcode);

        // ============================================
        // Strategy 5: If still no media, try embed page
        // ============================================
        if (postData.media.length === 0) {
            console.log('⚠️ No media from post page. Trying embed page as last resort...');

            const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;
            await page.goto(embedUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 3000));

            const embedData = await page.evaluate(() => {
                const result = { media: [], thumbnailUrl: '' };

                const addMedia = (url, type = 'image', w = 0, h = 0) => {
                    if (!url || url.startsWith('blob:')) return;
                    const base = url.split('?')[0];
                    if (result.media.some(m => m.url.split('?')[0] === base)) return;
                    result.media.push({ type, url, width: w, height: h });
                };

                // Images in the embed
                const imgs = document.querySelectorAll('img.EmbeddedMediaImage, img[class*="Media"], img[style*="object-fit"]');
                imgs.forEach(img => {
                    if (img.src && !img.src.includes('profile_pic') && img.naturalWidth > 100) {
                        addMedia(img.src, 'image', img.naturalWidth, img.naturalHeight);
                        if (!result.thumbnailUrl) result.thumbnailUrl = img.src;
                    }
                });

                // All large images
                if (result.media.length === 0) {
                    document.querySelectorAll('img').forEach(img => {
                        if (img.src && img.naturalWidth > 200 && !img.src.includes('profile') &&
                            !img.src.includes('sprite') && !img.src.includes('logo')) {
                            addMedia(img.src, 'image', img.naturalWidth, img.naturalHeight);
                            if (!result.thumbnailUrl) result.thumbnailUrl = img.src;
                        }
                    });
                }

                // Videos
                document.querySelectorAll('video').forEach(video => {
                    if (video.src && !video.src.startsWith('blob:')) {
                        addMedia(video.src, 'video');
                    }
                    video.querySelectorAll('source').forEach(source => {
                        if (source.src && !source.src.startsWith('blob:')) {
                            addMedia(source.src, 'video');
                        }
                    });
                    if (video.poster && !result.thumbnailUrl) {
                        result.thumbnailUrl = video.poster;
                    }
                });

                return result;
            });

            if (embedData.media.length > 0) {
                postData.media = embedData.media;
                console.log(`   ✅ Embed page got ${embedData.media.length} media items`);
            }
            if (!postData.thumbnailUrl && embedData.thumbnailUrl) {
                postData.thumbnailUrl = embedData.thumbnailUrl;
            }
        }

        // Final output
        console.log('');
        console.log('✅ ===== EXTRACTION COMPLETE =====');
        console.log('   Username:', postData.username || 'UNKNOWN');
        console.log('   Caption:', postData.caption ? postData.caption.substring(0, 60) + '...' : 'NONE');
        console.log('   Location:', postData.location || 'NONE');
        console.log('   Media items:', postData.media.length);
        postData.media.forEach((m, i) => {
            console.log(`   Media ${i + 1}: [${m.type}] ${m.url.substring(0, 80)}...`);
        });
        console.log('==================================');

        return postData;

    } catch (error) {
        console.error('❌ Puppeteer error:', error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log('🔒 Browser closed');
        }
    }
}
