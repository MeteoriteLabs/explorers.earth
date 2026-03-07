import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

/**
 * Extract Instagram profile data using Puppeteer
 * Extracts from meta tags which are reliable across Instagram updates
 * 
 * @param {string} username - Instagram username
 * @returns {Promise<Object>} Profile data
 */
export async function scrapeInstagramProfile(username) {
    let browser;

    try {
        console.log('🚀 Launching stealth browser for:', username);

        // Launch headless browser
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

        const page = await browser.newPage();

        // Set viewport and user agent
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        const profileUrl = `https://www.instagram.com/${username}/`;
        console.log('📍 Navigating to:', profileUrl);

        // Navigate with timeout
        await page.goto(profileUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('⏳ Waiting for meta tags...');

        // Wait a bit for page to fully load
        await new Promise(resolve => setTimeout(resolve, 2000));

        const pageTitle = await page.title();
        console.log('📄 Page Title:', pageTitle);

        console.log('🔍 Extracting from meta tags...');

        // Capture browser console logs
        page.on('console', msg => console.log('🌐 Browser:', msg.text()));

        // Extract from meta tags
        const profileData = await page.evaluate((user) => {
            const data = {
                username: user,
                fullName: '',
                bio: '',
                profilePicture: '',
                postsCount: 0,
                followersCount: 0,
                followingCount: 0,
                isVerified: false,
                isPrivate: false,
                externalUrl: '',
                _debug: {
                    ogDescription: '',
                    metaDescription: ''
                }
            };

            try {
                // Get og:title - contains full name
                const ogTitle = document.querySelector('meta[property="og:title"]');
                if (ogTitle) {
                    const title = ogTitle.content;
                    // Format: "Full Name (@username) • Instagram photos and videos"
                    const match = title.match(/^(.+?)\s*\(@/);
                    if (match) {
                        data.fullName = match[1].trim();
                        console.log('✅ Full name:', data.fullName);
                    }
                }

                // Get og:description - contains stats (but may be cached)
                const ogDesc = document.querySelector('meta[property="og:description"]');
                if (ogDesc) {
                    const desc = ogDesc.content;
                    data._debug.ogDescription = desc;
                    console.log('🔍 og:description:', desc);

                    // Extract stats from meta tag as fallback
                    const postsMatch = desc.match(/([0-9,]+)\s+Posts/i);
                    if (postsMatch) {
                        data.postsCount = postsMatch[1];
                    }
                }

                // Extract real-time stats from the actual page content
                // Instagram displays stats in specific list items
                console.log('🔍 Looking for stats in page content...');

                // Get all text content
                const pageText = document.body.innerText;

                // Method 1: Look for pattern "XXX followers" (supports 273M, 1.5K, etc.)
                const followersMatches = pageText.match(/([\d,.]+[KMB]?)\s+followers/i);
                if (followersMatches) {
                    data.followersCount = followersMatches[1].replace(/,/g, '');
                    console.log('✅ Followers from page:', data.followersCount);
                }

                // Method 2: Look for pattern "XXX following"  
                const followingMatches = pageText.match(/([\d,.]+[KMB]?)\s+following/i);
                if (followingMatches) {
                    data.followingCount = followingMatches[1].replace(/,/g, '');
                    console.log('✅ Following from page:', data.followingCount);
                }

                // Method 3: Look for pattern "XXX posts"
                const postsMatches = pageText.match(/([\d,.]+[KMB]?)\s+posts/i);
                if (postsMatches) {
                    data.postsCount = postsMatches[1].replace(/,/g, '');
                    console.log('✅ Posts from page:', data.postsCount);
                }

                // Get meta name="description" - contains bio
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc) {
                    let desc = metaDesc.content;
                    data._debug.metaDescription = desc;
                    console.log('🔍📝 FULL meta[name=description]:', desc);
                    console.log('🔍 Length:', desc.length);

                    // Format: "... on Instagram: ""bio text here""
                    // Note: Instagram uses double quotes at start/end
                    const bioMatch = desc.match(/on Instagram:\s*""(.+?)"$/s);
                    if (bioMatch) {
                        data.bio = bioMatch[1];
                        console.log('✅ Bio found:', data.bio.substring(0, 50));
                    } else {
                        console.log('❌ No bio match, trying alternative pattern...');
                        // Try with single quote
                        const bioMatch2 = desc.match(/on Instagram:\s*"(.+?)"$/s);
                        if (bioMatch2) {
                            data.bio = bioMatch2[1];
                            console.log('✅ Bio found (alt):', data.bio.substring(0, 50));
                        }
                    }
                } else {
                    console.log('❌ No meta[name="description"] tag found');
                }

                // Get og:image - profile picture
                const ogImage = document.querySelector('meta[property="og:image"]');
                if (ogImage) {
                    data.profilePicture = ogImage.content;
                    console.log('✅ Profile picture found');
                }

                // Decode HTML entities
                const decodeHtml = (html) => {
                    const txt = document.createElement('textarea');
                    txt.innerHTML = html;
                    return txt.value;
                };

                if (data.fullName) data.fullName = decodeHtml(data.fullName);
                if (data.bio) data.bio = decodeHtml(data.bio);

            } catch (error) {
                console.error('Error in extraction:', error);
            }

            return data;
        }, username);

        console.log('✅ Profile data extracted');
        console.log('   Full Name:', profileData.fullName);
        console.log('   Bio:', profileData.bio ? profileData.bio.substring(0, 50) + '...' : 'NONE');
        console.log('   Posts:', profileData.postsCount);
        console.log('   Followers:', profileData.followersCount);
        console.log('   Following:', profileData.followingCount);

        // Debug logging
        if (profileData._debug) {
            console.log('\n📋 DEBUG INFO:');
            console.log('   og:description =', profileData._debug.ogDescription);
            console.log('   meta description =', profileData._debug.metaDescription);
        }

        return profileData;

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
