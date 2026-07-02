import axios from "axios";
import puppeteer from "puppeteer";

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

async function scrapeWithPuppeteer(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    const content = await page.content();
    return content;
  } finally {
    await browser.close();
  }
}

export async function scrapeUrl(url: string): Promise<ScrapedData> {
  let html = "";
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

  const hostname = new URL(url).hostname;
  const cleanHostname = hostname.replace("www.", "");

  // Metadata parsing
  const ogTitle = extractMeta(html, "og:title") || extractMeta(html, "twitter:title");
  const title = ogTitle || extractTitle(html) || cleanHostname;

  const ogDescription = extractMeta(html, "og:description") || extractMeta(html, "twitter:description") || extractMeta(html, "description");
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
