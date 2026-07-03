import axios from "axios";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteerExtra.use(StealthPlugin());

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
  const browser = await puppeteerExtra.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--window-size=1366,768",
    ],
  });

  try {
    const page = await browser.newPage();

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
    await browser.close();
  }
}

/** Non-Amazon fallback: plain Puppeteer (no stealth needed for most sites) */
async function scrapeWithPuppeteer(url: string): Promise<string> {
  const browser = await puppeteerExtra.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    return await page.content();
  } finally {
    await browser.close();
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
