import { Router } from "express";
import { scrapeUrl } from "../utils/scrapeUtils";

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

export default router;
