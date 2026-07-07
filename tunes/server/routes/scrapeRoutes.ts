import { Router } from "express";
import axios from "axios";
import { scrapeUrl, scrapeProfile } from "../utils/scrapeUtils";

const router = Router();

// POST /api/apps/scrape-url
router.post("/apps/scrape-url", async (req, res) => {
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
router.post("/products/scrape-link", async (req, res) => {
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
router.post("/people/scrape-profile", async (req, res) => {
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
router.get("/proxy-image", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url query parameter" });
  }

  try {
    const decodedUrl = decodeURIComponent(url);

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
    });

    // Forward content type
    const contentType = response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    // Remove headers that might cause issues
    res.removeHeader("x-powered-by");

    response.data.pipe(res);
  } catch (err: any) {
    console.error("Image proxy failed:", err?.message || err);
    res.status(502).json({ error: "Failed to proxy image" });
  }
});

export default router;

