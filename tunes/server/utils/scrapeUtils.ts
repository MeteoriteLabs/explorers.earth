import axios from "axios";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import dns from "dns";
import http from "http";
import https from "https";
import net from "net";

puppeteerExtra.use(StealthPlugin());

// Semaphore for limiting Puppeteer concurrency
class SimpleSemaphore {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.active--;
    }
  }
}

const puppeteerSemaphore = new SimpleSemaphore(3); // Limit to 3 concurrent browser instances

export function isPrivateIP(ip: string): boolean {
  if (!net.isIP(ip)) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [o1, o2, o3, o4] = parts;
    if (o1 === 127) return true; // loopback
    if (o1 === 10) return true; // RFC 1918
    if (o1 === 172 && (o2 >= 16 && o2 <= 31)) return true; // RFC 1918
    if (o1 === 192 && o2 === 168) return true; // RFC 1918
    if (o1 === 169 && o2 === 254) return true; // link-local
    if (o1 === 0) return true; // unspecified
    if (o1 >= 224) return true; // multicast & reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1" || normalized.endsWith("::1")) return true;
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0" || normalized === "::0") return true;
    return false;
  }
  return true;
}

export const secureLookup: dns.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) {
      return callback(err, address, family);
    }
    if (Array.isArray(address)) {
      for (const item of address) {
        if (isPrivateIP(item.address)) {
          return callback(new Error("Access to private IP is blocked"), address, family);
        }
      }
    } else {
      if (isPrivateIP(address)) {
        return callback(new Error("Access to private IP is blocked"), address, family);
      }
    }
    callback(null, address, family);
  });
};

export const secureHttpAgent = new http.Agent({ lookup: secureLookup });
export const secureHttpsAgent = new https.Agent({ lookup: secureLookup });

async function setupPuppeteerRequestInterception(page: any): Promise<void> {
  await page.setRequestInterception(true);
  page.on("request", async (request: any) => {
    try {
      const urlStr = request.url();
      const url = new URL(urlStr);
      if (url.protocol === "data:") {
        request.continue();
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        request.abort();
        return;
      }
      const hostname = url.hostname;
      if (net.isIP(hostname)) {
        if (isPrivateIP(hostname)) {
          request.abort();
          return;
        }
      } else {
        const ip = await new Promise<string>((resolve, reject) => {
          dns.lookup(hostname, (err, address) => {
            if (err) reject(err);
            else resolve(address);
          });
        }).catch(() => null);
        if (!ip || isPrivateIP(ip)) {
          request.abort();
          return;
        }
      }
      request.continue();
    } catch {
      request.abort();
    }
  });
}

export interface ScrapedData {
  title?: string;
  description?: string;
  logo_url?: string;
  developer?: string;
  brand?: string;
  price?: number;
  currency?: string;
  images?: string[];
  buy_url?: string;
}

interface AmazonPageData {
  title?: string;
  brand?: string;
  price?: number;
  currency?: string;
  images?: string[];
  description?: string;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractMeta(html: string, nameOrProperty: string): string | null {
  const regex = new RegExp(
    `<meta\\s+[^>]*?(?:name|property)="` + nameOrProperty + `"\\s+[^>]*?content="([^"]*?)"`,
    "i"
  );
  const match = html.match(regex);
  if (match) return decodeHtmlEntities(match[1]);

  const regex2 = new RegExp(
    `<meta\\s+[^>]*?content="([^"]*?)"\\s+[^>]*?(?:name|property)="` + nameOrProperty + `"`,
    "i"
  );
  const match2 = html.match(regex2);
  if (match2) return decodeHtmlEntities(match2[1]);

  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (match) return decodeHtmlEntities(match[1].trim());
  return null;
}

function extractTouchIcon(html: string, baseUrl: string): string | null {
  const rels = ["apple-touch-icon", "shortcut icon", "icon"];
  for (const rel of rels) {
    const regex = new RegExp(`<link\\s+[^>]*?rel="` + rel + `"\\s+[^>]*?href="([^"]*?)"`, "i");
    const match = html.match(regex);
    if (match) {
      try {
        return new URL(match[1], baseUrl).toString();
      } catch {
        return match[1];
      }
    }
    const regex2 = new RegExp(`<link\\s+[^>]*?href="([^"]*?)"\\s+[^>]*?rel="` + rel + `"`, "i");
    const match2 = html.match(regex2);
    if (match2) {
      try {
        return new URL(match2[1], baseUrl).toString();
      } catch {
        return match2[1];
      }
    }
  }
  return null;
}

function extractJsonLd(html: string): any[] {
  const results: any[] = [];
  const regex = /<script\s+[^>]*?type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      if (Array.isArray(data)) {
        results.push(...data);
      } else {
        results.push(data);
      }
    } catch {
      // ignore parsing errors
    }
  }
  return results;
}

function parseProductJsonLd(jsonLdList: any[]): Partial<ScrapedData> {
  const product = jsonLdList.find((item) => item["@type"] === "Product" || item["@type"]?.includes("Product"));
  if (!product) return {};

  const details: Partial<ScrapedData> = {};

  if (product.name) details.title = product.name;
  if (product.description) details.description = product.description;
  if (product.brand) {
    if (typeof product.brand === "string") {
      details.brand = product.brand;
    } else if (product.brand.name) {
      details.brand = product.brand.name;
    }
  }

  const offers = product.offers;
  if (offers) {
    if (Array.isArray(offers)) {
      const firstOffer = offers[0];
      if (firstOffer.price) details.price = parseFloat(firstOffer.price);
      if (firstOffer.priceCurrency) details.currency = firstOffer.priceCurrency;
    } else {
      if (offers.price) details.price = parseFloat(offers.price);
      if (offers.priceCurrency) details.currency = offers.priceCurrency;
    }
  }

  if (product.image) {
    if (Array.isArray(product.image)) {
      details.images = product.image;
    } else {
      details.images = [product.image];
    }
  }

  return details;
}

function isAmazonUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes("amazon.");
  } catch {
    return false;
  }
}

/** Launches a stealth Puppeteer browser, renders the page, and returns both the
 *  raw HTML and Amazon-specific data extracted directly from the live DOM. */
async function scrapeWithStealthPuppeteer(url: string): Promise<{ html: string; amazonData: AmazonPageData }> {
  await puppeteerSemaphore.acquire();
  let browser;
  try {
    browser = await puppeteerExtra.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--window-size=1366,768",
      ],
    });

    const page = await browser.newPage();
    await setupPuppeteerRequestInterception(page);

    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Allow JS to hydrate dynamic content
    await new Promise((r) => setTimeout(r, 3000));

    const html = await page.content();

    // Extract Amazon-specific data directly from the rendered DOM
    const amazonData: AmazonPageData = await page.evaluate(() => {
      const result: Record<string, any> = {};

      // ── Title ──────────────────────────────────────────────────────────────
      const titleEl =
        document.querySelector("#productTitle") ||
        document.querySelector("h1.a-size-large") ||
        document.querySelector("h1#title");
      if (titleEl) result.title = titleEl.textContent?.trim();

      // ── Brand ──────────────────────────────────────────────────────────────
      // 1. Product details table (most reliable for Amazon)
      const tableRows = document.querySelectorAll(
        "#productDetails_techSpec_section_1 tr, #productDetails_feature_div tr, .po-brand, .a-keyvalue tr"
      );
      tableRows.forEach((row) => {
        const th = row.querySelector("th, .a-span3 span, td:first-child");
        const td = row.querySelector("td, .a-span9 span, td:nth-child(2)");
        if (th && td) {
          const label = th.textContent?.trim().toLowerCase() || "";
          if (label.includes("brand")) {
            result.brand = td.textContent?.trim();
          }
        }
      });

      // 2. Byline (fallback)
      if (!result.brand) {
        const bylineEl =
          document.querySelector("#bylineInfo") ||
          document.querySelector("a#bylineInfo");
        if (bylineEl) {
          const raw = bylineEl.textContent?.trim() || "";
          const brandMatch = raw.match(/(?:Brand[:\s]+|Visit the\s+)(.+?)(?:\s+Store)?$/i);
          result.brand = brandMatch ? brandMatch[1].trim() : raw;
        }
      }

      // ── Price ──────────────────────────────────────────────────────────────
      const priceSelectors = [
        ".a-price .a-offscreen",
        "#priceblock_ourprice",
        "#priceblock_dealprice",
        ".apexPriceToPay .a-offscreen",
        "#corePrice_feature_div .a-offscreen",
        ".a-price-whole",
      ];
      for (const sel of priceSelectors) {
        const priceEl = document.querySelector(sel);
        if (priceEl && priceEl.textContent) {
          const raw = priceEl.textContent.trim().replace(/[^\d.,]/g, "").replace(",", "");
          const parsed = parseFloat(raw);
          if (!isNaN(parsed) && parsed > 0) {
            result.price = parsed;
            break;
          }
        }
      }

      // ── Currency ───────────────────────────────────────────────────────────
      const currencyEl = document.querySelector(".a-price-symbol");
      if (currencyEl) {
        const sym = currencyEl.textContent?.trim();
        if (sym === "₹") result.currency = "INR";
        else if (sym === "$") result.currency = "USD";
        else if (sym === "€") result.currency = "EUR";
        else if (sym === "£") result.currency = "GBP";
        else result.currency = sym;
      }

      // ── Images ─────────────────────────────────────────────────────────────
      const images: string[] = [];

      // Main image hi-res data
      const mainImg = document.querySelector("#landingImage, #imgTagWrapperId img, #main-image") as HTMLImageElement | null;
      if (mainImg) {
        const dynData = mainImg.getAttribute("data-a-dynamic-image");
        if (dynData) {
          try {
            const parsed = JSON.parse(dynData) as Record<string, [number, number]>;
            // Sort by area (largest first) to get hi-res
            Object.entries(parsed)
              .sort(([, [w1, h1]], [, [w2, h2]]) => w2 * h2 - w1 * h1)
              .forEach(([u]) => { if (!images.includes(u)) images.push(u); });
          } catch {}
        }
        const oldHires = mainImg.getAttribute("data-old-hires");
        if (oldHires && !images.includes(oldHires)) images.push(oldHires);
        if (mainImg.src && !mainImg.src.startsWith("data:") && !images.includes(mainImg.src)) {
          images.push(mainImg.src);
        }
      }

      // Thumbnail strip
      document.querySelectorAll("#altImages img, .imageThumbnail img").forEach((img) => {
        const dynData = img.getAttribute("data-a-dynamic-image");
        if (dynData) {
          try {
            const parsed = JSON.parse(dynData) as Record<string, [number, number]>;
            const sorted = Object.entries(parsed).sort(([, [w1, h1]], [, [w2, h2]]) => w2 * h2 - w1 * h1);
            if (sorted[0] && !images.includes(sorted[0][0])) images.push(sorted[0][0]);
          } catch {}
        }
      });

      if (images.length > 0) result.images = images;

      // ── Description ────────────────────────────────────────────────────────
      const featureDiv = document.querySelector("#feature-bullets ul, #productDescription p");
      if (featureDiv) result.description = featureDiv.textContent?.trim().slice(0, 500);

      return result;
    });

    return { html, amazonData };
  } finally {
    if (browser) await browser.close();
    puppeteerSemaphore.release();
  }
}

/** Non-Amazon fallback: plain Puppeteer (no stealth needed for most sites) */
async function scrapeWithPuppeteer(url: string): Promise<string> {
  await puppeteerSemaphore.acquire();
  let browser;
  try {
    browser = await puppeteerExtra.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await setupPuppeteerRequestInterception(page);
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    return await page.content();
  } finally {
    if (browser) await browser.close();
    puppeteerSemaphore.release();
  }
}

export async function scrapeUrl(url: string): Promise<ScrapedData> {
  const hostname = new URL(url).hostname;
  const cleanHostname = hostname.replace("www.", "");

  // ── Amazon: always use stealth Puppeteer + DOM extraction ─────────────────
  if (isAmazonUrl(url)) {
    console.log("🛒 Amazon URL detected — using stealth Puppeteer with DOM extraction");
    const { html, amazonData } = await scrapeWithStealthPuppeteer(url);

    // Supplement with JSON-LD and meta tags for any fields still missing
    const jsonLdData = extractJsonLd(html);
    const jsonLdDetails = parseProductJsonLd(jsonLdData);

    const ogTitle = extractMeta(html, "og:title") || extractMeta(html, "twitter:title");
    const ogDescription =
      extractMeta(html, "og:description") ||
      extractMeta(html, "twitter:description") ||
      extractMeta(html, "description");
    const ogImage = extractMeta(html, "og:image") || extractMeta(html, "twitter:image");

    const title = amazonData.title || jsonLdDetails.title || ogTitle || extractTitle(html) || cleanHostname;
    const brand = amazonData.brand || jsonLdDetails.brand || cleanHostname;
    const price = amazonData.price ?? jsonLdDetails.price;
    const currency = amazonData.currency || jsonLdDetails.currency || "INR"; // Amazon.in defaults to INR
    const images =
      amazonData.images && amazonData.images.length > 0
        ? amazonData.images
        : jsonLdDetails.images || (ogImage ? [ogImage] : []);
    const description = amazonData.description || jsonLdDetails.description || ogDescription || "";

    console.log("✅ Amazon scrape result:", { title, brand, price, currency, imageCount: images.length });

    return {
      title,
      description,
      logo_url: ogImage || "",
      developer: cleanHostname,
      brand,
      price,
      currency,
      images,
      buy_url: url,
    };
  }

  // ── Non-Amazon: try Axios first, then Puppeteer ────────────────────────────
  let html = "";
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 10000,
      httpAgent: secureHttpAgent,
      httpsAgent: secureHttpsAgent,
    });
    html = response.data;
  } catch (err) {
    console.warn("Axios scrape failed, falling back to Puppeteer:", err instanceof Error ? err.message : err);
    try {
      html = await scrapeWithPuppeteer(url);
    } catch (pupErr) {
      console.error("Puppeteer scrape fallback failed:", pupErr);
      throw new Error("Unable to scrape URL");
    }
  }

  const ogTitle = extractMeta(html, "og:title") || extractMeta(html, "twitter:title");
  const title = ogTitle || extractTitle(html) || cleanHostname;

  const ogDescription =
    extractMeta(html, "og:description") ||
    extractMeta(html, "twitter:description") ||
    extractMeta(html, "description");
  const description = ogDescription || "";

  const ogImage = extractMeta(html, "og:image") || extractMeta(html, "twitter:image") || extractTouchIcon(html, url);
  const logo_url = ogImage || "";

  const jsonLdData = extractJsonLd(html);
  const productDetails = parseProductJsonLd(jsonLdData);

  const images = productDetails.images || (ogImage ? [ogImage] : []);

  return {
    title: productDetails.title || title,
    description: productDetails.description || description,
    logo_url: productDetails.logo_url || logo_url,
    developer: cleanHostname,
    brand: productDetails.brand || cleanHostname,
    price: productDetails.price,
    currency: productDetails.currency || "USD",
    images,
    buy_url: url,
  };
}
export interface ProfileScrapedData {
  full_name?: string;
  handle?: string;
  headline?: string;
  bio?: string;
  avatar_url?: string;
  platform?: "instagram" | "linkedin" | "x" | "github" | "youtube" | "website" | "other";
  follower_count?: string;
  location?: string;
  screenshots?: string[];
}

export function detectProfilePlatform(url: string): ProfileScrapedData["platform"] {
  const lower = url.toLowerCase();
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("linkedin.com")) return "linkedin";
  if (lower.includes("x.com") || lower.includes("twitter.com")) return "x";
  if (lower.includes("github.com")) return "github";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  return "website";
}

function extractHandleFromUrl(url: string, platform: ProfileScrapedData["platform"]): string | undefined {
  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    if (platform === "instagram" || platform === "github" || platform === "x") {
      return pathParts[0];
    }
    if (platform === "linkedin") {
      // e.g. /in/username
      if (pathParts[0] === "in" && pathParts[1]) return pathParts[1];
      return pathParts[0];
    }
    if (platform === "youtube") {
      // e.g. /@channel or /user/channel or /c/channel
      if (pathParts[0]?.startsWith("@")) return pathParts[0].substring(1);
      if ((pathParts[0] === "user" || pathParts[0] === "c" || pathParts[0] === "channel") && pathParts[1]) {
        return pathParts[1];
      }
      return pathParts[0];
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function scrapeLinkedInViaDuckDuckGo(handle: string): Promise<Partial<ProfileScrapedData>> {
  try {
    const query = `site:linkedin.com/in/${handle}`;
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    console.log(`🦆 Fetching LinkedIn info via DuckDuckGo fallback: ${ddgUrl}`);
    
    const response = await axios.get(ddgUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 10000,
      httpAgent: secureHttpAgent,
      httpsAgent: secureHttpsAgent,
    });
    
    const html = response.data;
    const data: Partial<ProfileScrapedData> = {};
    
    // DuckDuckGo static page has results inside class="result" or class="web-result"
    // Let's find result__a and result__snippet using regex
    const titleMatch = html.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch = html.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
                         html.match(/<span[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    
    if (titleMatch) {
      const cleanTitle = titleMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      // e.g. "Shivanshu Singh - Software Engineer - Company | LinkedIn" or similar
      const parts = cleanTitle.split("-").map((p: string) => p.trim());
      if (parts[0]) {
        data.full_name = parts[0].replace(/\|.*/g, "").trim();
      }
      if (parts.length > 1) {
        data.headline = parts.slice(1).join(" - ").replace(/\|.*/g, "").trim();
      }
    }
    
    if (snippetMatch) {
      const cleanSnippet = snippetMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      data.bio = cleanSnippet;
    }
    
    return data;
  } catch (err) {
    console.error("Failed to fallback search LinkedIn on DuckDuckGo:", err);
    return {};
  }
}

export async function scrapeProfile(url: string): Promise<ProfileScrapedData> {
  const platform = detectProfilePlatform(url);
  const handle = extractHandleFromUrl(url, platform);
  const result: ProfileScrapedData = { platform, handle };

  console.log(`👤 Scraping profile for platform: ${platform}, handle: ${handle}, URL: ${url}`);

  // Use Puppeteer for platforms likely to block or run heavy client-side JS
  const usePuppeteer = ["instagram", "linkedin", "x", "youtube"].includes(platform || "");

  let html = "";
  if (usePuppeteer) {
    await puppeteerSemaphore.acquire();
    let browser;
    try {
      browser = await puppeteerExtra.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--disable-infobars",
          "--window-size=1280,800",
        ],
      });
      const page = await browser.newPage();
      await setupPuppeteerRequestInterception(page);
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      });
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      
      // Let JS execute / hydrate
      await new Promise((r) => setTimeout(r, 4000));
      html = await page.content();

      // Scrape screenshots/feed images inside the page context if needed
      try {
        const screenshots = await page.evaluate((plat: any) => {
          const urls: string[] = [];
          if (plat === "instagram") {
            const links = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
            links.forEach((link: any) => {
              const img = link.querySelector('img');
              if (img && img.src && !img.src.startsWith('blob:')) {
                urls.push(img.src);
              }
            });
            if (urls.length === 0) {
              const imgs = document.querySelectorAll('img');
              imgs.forEach((img: any) => {
                if (img.src && !img.src.startsWith('blob:') && img.width > 150 && img.height > 150) {
                  urls.push(img.src);
                }
              });
            }
          } else if (plat === "youtube") {
            const imgs = document.querySelectorAll('img');
            imgs.forEach((img: any) => {
              if (img.src && (img.src.includes('vi/') || img.src.includes('ytimg.com'))) {
                urls.push(img.src);
              }
            });
            const ytdThumbnails = document.querySelectorAll('ytd-thumbnail img');
            ytdThumbnails.forEach((img: any) => {
              if (img.src) urls.push(img.src);
            });
          } else if (plat === "x") {
            const imgs = document.querySelectorAll('img');
            imgs.forEach((img: any) => {
              if (img.src && (img.src.includes('/media/') || img.src.includes('profile_banners'))) {
                urls.push(img.src);
              }
            });
          } else if (plat === "linkedin") {
            const imgs = document.querySelectorAll('img');
            imgs.forEach((img: any) => {
              if (img.src && !img.src.startsWith('blob:') && img.width > 100 && img.height > 100) {
                if (!img.src.includes('favicon') && !img.src.includes('logo') && !img.src.includes('sign-up')) {
                  urls.push(img.src);
                }
              }
            });
          }
          return Array.from(new Set(urls)).slice(0, 10);
        }, platform || "") as string[];
        
        if (screenshots && screenshots.length > 0) {
          // Extract session cookies from the Puppeteer browser (Instagram session tokens)
          // and use them in server-side axios requests to download the images.
          // This avoids Instagram's CSP which blocks fetch() within the page context,
          // and ensures the session tokens are still valid.
          let cookieHeader = "";
          try {
            const cookies = await page.cookies();
            cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
            console.log(`🍪 Extracted ${cookies.length} cookies from Puppeteer session`);
          } catch (e) {
            console.warn("Failed to extract cookies from Puppeteer page:", e);
          }

          const downloadImageAsBase64 = async (imgUrl: string): Promise<string | null> => {
            const baseHeaders: Record<string, string> = {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Referer": "https://www.instagram.com/",
              "Origin": "https://www.instagram.com",
              "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "sec-fetch-dest": "image",
              "sec-fetch-mode": "no-cors",
              "sec-fetch-site": "cross-site",
            };

            // Try 1: with session cookies
            try {
              const response = await axios.get(imgUrl, {
                responseType: "arraybuffer",
                timeout: 10000,
                headers: { ...baseHeaders, ...(cookieHeader ? { "Cookie": cookieHeader } : {}) },
                httpAgent: secureHttpAgent,
                httpsAgent: secureHttpsAgent,
              });
              const mimeType = (response.headers["content-type"] as string) || "image/jpeg";
              const base64 = Buffer.from(response.data).toString("base64");
              return `data:${mimeType};base64,${base64}`;
            } catch (err1: any) {
              console.warn(`⚠️ Cookie-auth download failed (${err1?.response?.status || "network"}): ${imgUrl.slice(0, 80)}...`);
              // Try 2: without cookies (some CDN nodes don't require session)
              try {
                const response2 = await axios.get(imgUrl, {
                  responseType: "arraybuffer",
                  timeout: 10000,
                  headers: baseHeaders,
                  httpAgent: secureHttpAgent,
                  httpsAgent: secureHttpsAgent,
                });
                const mimeType = (response2.headers["content-type"] as string) || "image/jpeg";
                const base64 = Buffer.from(response2.data).toString("base64");
                return `data:${mimeType};base64,${base64}`;
              } catch (err2: any) {
                console.warn(`❌ No-cookie download also failed (${err2?.response?.status || "network"}): ${imgUrl.slice(0, 80)}...`);
                return null;
              }
            }
          };

          const base64Screenshots: string[] = [];
          for (const imgUrl of screenshots) {
            const b64 = await downloadImageAsBase64(imgUrl);
            if (b64) base64Screenshots.push(b64);
          }
          console.log(`📸 Downloaded ${base64Screenshots.length}/${screenshots.length} screenshots as base64`);
          result.screenshots = base64Screenshots.length > 0 ? base64Screenshots : screenshots;

          // Also fetch the avatar (og:image) as base64 using the same session cookies
          try {
            const ogImageUrl = await page.evaluate(() => {
              const el = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
              return el ? el.content : null;
            });
            if (ogImageUrl) {
              const avatarB64 = await downloadImageAsBase64(ogImageUrl);
              if (avatarB64) result.avatar_url = avatarB64;
            }
          } catch (err) {
            console.warn("Failed to download avatar as base64:", err);
          }
        } else {
          // No screenshots found, but still try to get avatar as base64
          try {
            const ogImageUrl = await page.evaluate(() => {
              const el = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null;
              return el ? el.content : null;
            });
            if (ogImageUrl) {
              let cookieHeader = "";
              try {
                const cookies = await page.cookies();
                cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
              } catch {}
              const response = await axios.get(ogImageUrl, {
                responseType: "arraybuffer",
                timeout: 10000,
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                  "Referer": "https://www.instagram.com/",
                  "Accept": "image/*,*/*;q=0.8",
                  ...(cookieHeader ? { "Cookie": cookieHeader } : {}),
                },
                httpAgent: secureHttpAgent,
                httpsAgent: secureHttpsAgent,
              });
              const mimeType = (response.headers["content-type"] as string) || "image/jpeg";
              result.avatar_url = `data:${mimeType};base64,${Buffer.from(response.data).toString("base64")}`;
            }
          } catch (err) {
            console.warn("Failed to download avatar as base64:", err);
          }
        }
      } catch (err) {
        console.warn("Failed to extract screenshots inside page evaluation:", err);
      }
    } catch (err) {
      console.warn("Puppeteer profile scrape failed:", err instanceof Error ? err.message : err);
    } finally {
      if (browser) await browser.close();
      puppeteerSemaphore.release();
    }
  } else {
    // Standard HTTP fetch for open pages like GitHub or general websites
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 10000,
        httpAgent: secureHttpAgent,
        httpsAgent: secureHttpsAgent,
      });
      html = response.data;
    } catch (err) {
      console.warn("Axios profile scrape failed, attempting Puppeteer fallback:", err instanceof Error ? err.message : err);
      await puppeteerSemaphore.acquire();
      let browser;
      try {
        browser = await puppeteerExtra.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();
        await setupPuppeteerRequestInterception(page);
        await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 });
        html = await page.content();
      } catch (pupErr) {
        console.error("Puppeteer fallback failed for profile scrape:", pupErr);
      } finally {
        if (browser) await browser.close();
        puppeteerSemaphore.release();
      }
    }
  }

  if (!html) {
    console.warn("Could not retrieve HTML content for profile scrape. Returning handle/platform only.");
    return result;
  }

  // Parse fields based on platform
  const ogTitle = extractMeta(html, "og:title") || extractMeta(html, "twitter:title");
  const ogDescription =
    extractMeta(html, "og:description") ||
    extractMeta(html, "twitter:description") ||
    extractMeta(html, "description");
  const ogImage = extractMeta(html, "og:image") || extractMeta(html, "twitter:image") || extractTouchIcon(html, url);

  // Only set avatar_url from the raw og:image if we haven't already stored a base64
  // version (downloaded during the Puppeteer session while tokens were still valid).
  if (!result.avatar_url?.startsWith("data:")) {
    result.avatar_url = ogImage || undefined;
  }

  if (platform === "github") {
    // GitHub specific extraction
    const titleMatch = ogTitle?.match(/^([^\(]+)/); // e.g. "username (Full Name)" -> "username" or "Full Name"
    if (titleMatch) {
      const parsedTitle = titleMatch[1].trim();
      result.full_name = parsedTitle === handle ? parsedTitle : parsedTitle;
    }
    // Let's refine full name from HTML if available
    const fullNameMatch = html.match(/<span[^>]*class="[^"]*p-name[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (fullNameMatch) {
      result.full_name = decodeHtmlEntities(fullNameMatch[1].trim());
    } else {
      result.full_name = result.full_name || ogTitle || handle;
    }

    const bioMatch = html.match(/<div[^>]*class="[^"]*js-user-profile-bio[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (bioMatch) {
      result.bio = decodeHtmlEntities(bioMatch[1].trim().replace(/<[^>]+>/g, ""));
    } else {
      result.bio = ogDescription || undefined;
    }

    const locMatch = html.match(/<span[^>]*class="[^"]*p-label[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (locMatch) {
      result.location = decodeHtmlEntities(locMatch[1].trim());
    }

    const followersMatch = html.match(/href="[^"]*followers[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (followersMatch) {
      const numMatch = followersMatch[1].match(/(\d+[\d,.]*[KMB]?)/i);
      if (numMatch) result.follower_count = numMatch[1].trim();
    }

    // GitHub screenshots and cards
    if (handle) {
      const screenshots: string[] = [];
      screenshots.push(`https://ghchart.rshah.org/409efe/${handle}`);
      
      const repoRegex = new RegExp(`href="\\/${handle}\\/([A-Za-z0-9_.-]+)"`, "g");
      let match;
      const foundRepos = new Set<string>();
      while ((match = repoRegex.exec(html)) !== null) {
        const repoName = match[1];
        if (!["followers", "following", "repositories", "projects", "packages", "stars", "sponsoring", "gists", "tab"].includes(repoName)) {
          foundRepos.add(repoName);
        }
      }
      Array.from(foundRepos).slice(0, 5).forEach((repo) => {
        screenshots.push(`https://opengraph.githubassets.com/1/${handle}/${repo}`);
      });
      result.screenshots = screenshots;
    }
  } else if (platform === "instagram") {
    // Instagram specific extraction
    // ogTitle looks like: "Full Name (@handle) • Instagram photos and videos"
    if (ogTitle) {
      const match = ogTitle.match(/^(.+?)\s*\(@/);
      if (match) result.full_name = match[1].trim();
    }
    result.full_name = result.full_name || ogTitle || handle;
    result.bio = ogDescription || undefined;

    // Follower count from description or text: e.g. "1.2M Followers, 500 Following..."
    if (ogDescription) {
      const followersMatch = ogDescription.match(/([\d,.]+[KMB]?)\s*Followers/i);
      if (followersMatch) result.follower_count = followersMatch[1];
    }
  } else if (platform === "linkedin") {
    // LinkedIn specific extraction
    // ogTitle: "Name - Headline - Company | LinkedIn" or "Name | LinkedIn"
    if (ogTitle) {
      const parts = ogTitle.split("-").map((p) => p.trim());
      if (parts[0]) {
        result.full_name = parts[0].replace(/\|.*/g, "").trim();
      }
      if (parts[1]) {
        result.headline = parts[1].replace(/\|.*/g, "").trim();
      }
    }
    result.full_name = result.full_name || handle;
    result.bio = ogDescription || undefined;

    const isLinkedInLoginWall =
      html.includes("linkedin.com/signup") ||
      html.includes("linkedin.com/checkpoint/lg/login") ||
      (result.full_name && result.full_name.toLowerCase().includes("sign up")) ||
      (result.bio && result.bio.toLowerCase().includes("750 million+ members"));

    if (isLinkedInLoginWall && handle) {
      console.log(`⚠️ Detected LinkedIn login wall. Triggering DuckDuckGo fallback scraping...`);
      const ddgData = await scrapeLinkedInViaDuckDuckGo(handle);
      if (ddgData.full_name) {
        result.full_name = ddgData.full_name;
        result.headline = ddgData.headline || result.headline;
        result.bio = ddgData.bio || result.bio;
        result.avatar_url = undefined; // Clear login wall favicon
      }
    }
  } else if (platform === "x") {
    // X specific extraction
    // ogTitle is usually "Name (@handle) on X"
    if (ogTitle) {
      const match = ogTitle.match(/^(.+?)\s*\(@/);
      if (match) result.full_name = match[1].trim();
    }
    result.full_name = result.full_name || ogTitle || handle;
    result.bio = ogDescription || undefined;
  } else {
    // General website
    result.full_name = ogTitle || extractTitle(html) || handle;
    result.bio = ogDescription || undefined;
  }

  // Clean empty values
  if (result.full_name) {
    result.full_name = result.full_name.replace(/\|.*/g, "").replace(/•.*/g, "").trim();
  }

  console.log("✅ Scrape profile complete. Result:", result);
  return result;
}

