import { Router } from "express";
import axios from "axios";
import rateLimit from "express-rate-limit";
import { scrapeUrl, scrapeProfile, secureHttpAgent, secureHttpsAgent } from "../utils/scrapeUtils";

const router = Router();

const scrapeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per window
  message: { error: "Too many scrape requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

// POST /api/apps/scrape-url
router.post("/apps/scrape-url", scrapeRateLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Missing URL in request body" });
  }

  try {
    console.log("🕸️ Scrape App request for URL:", url);
    const data = await scrapeUrl(url);
    res.json({
      title: data.title,
      description: data.description,
      logo_url: data.logo_url,
      developer: data.developer,
    });
  } catch (error) {
    console.error("Scrape App failed:", error);
    res.status(500).json({ error: "Failed to scrape URL metadata" });
  }
});

// POST /api/products/scrape-link
router.post("/products/scrape-link", scrapeRateLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Missing URL in request body" });
  }

  try {
    console.log("🕸️ Scrape Product request for URL:", url);
    const data = await scrapeUrl(url);
    res.json(data);
  } catch (error) {
    console.error("Scrape Product failed:", error);
    res.status(500).json({ error: "Failed to scrape product metadata" });
  }
});

// POST /api/people/scrape-profile
router.post("/people/scrape-profile", scrapeRateLimiter, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "Missing URL in request body" });
  }

  try {
    console.log("🕸️ Scrape Profile request for URL:", url);
    const data = await scrapeProfile(url);
    res.json(data);
  } catch (error) {
    console.error("Scrape Profile failed:", error);
    res.status(500).json({ error: "Failed to scrape profile metadata" });
  }
});

// GET /api/proxy-image?url=<encoded_url>
// Server-side image proxy to bypass CDN referrer/token restrictions (e.g. Instagram)
router.get("/proxy-image", scrapeRateLimiter, async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url query parameter" });
  }

  try {
    const decodedUrl = decodeURIComponent(url);

    // Validate scheme/protocol
    try {
      const parsedUrl = new URL(decodedUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return res.status(400).json({ error: "Only http and https protocols are allowed for image proxy" });
      }
    } catch {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // Determine appropriate headers based on URL domain
    const isInstagram = decodedUrl.includes("fbcdn.net") || decodedUrl.includes("cdninstagram.com") || decodedUrl.includes("instagram.");
    const isYoutube = decodedUrl.includes("ytimg.com") || decodedUrl.includes("youtube.com");

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };

    if (isInstagram) {
      headers["Referer"] = "https://www.instagram.com/";
      headers["Origin"] = "https://www.instagram.com";
    } else if (isYoutube) {
      headers["Referer"] = "https://www.youtube.com/";
    }

    const response = await axios.get(decodedUrl, {
      responseType: "stream",
      headers,
      timeout: 15000,
      httpAgent: secureHttpAgent,
      httpsAgent: secureHttpsAgent,
    });

    const contentType = response.headers["content-type"] || "image/jpeg";
    if (!contentType.startsWith("image/") && !contentType.startsWith("application/octet-stream")) {
      response.data.destroy();
      return res.status(400).json({ error: "Target URL does not point to an image" });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const contentLengthStr = response.headers["content-length"];
    if (contentLengthStr) {
      const contentLength = parseInt(contentLengthStr, 10);
      if (!isNaN(contentLength) && contentLength > MAX_SIZE) {
        response.data.destroy();
        return res.status(400).json({ error: "Image size exceeds limit" });
      }
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.removeHeader("x-powered-by");

    let bytesReceived = 0;
    response.data.on("data", (chunk: Buffer) => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_SIZE) {
        console.error("Image proxy: size limit exceeded (5MB limit)");
        response.data.destroy();
        if (!res.headersSent) {
          res.status(400).json({ error: "Image size exceeds limit" });
        } else {
          res.destroy();
        }
      }
    });

    response.data.on("error", (err: any) => {
      console.error("Image proxy stream error:", err);
      if (!res.headersSent) {
        res.status(502).json({ error: "Failed to proxy image stream" });
      }
    });

    response.data.pipe(res);
  } catch (err: any) {
    console.error("Image proxy failed:", err?.message || err);
    res.status(502).json({ error: "Failed to proxy image" });
  }
});

export default router;

