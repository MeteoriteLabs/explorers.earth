import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import axios from "axios";
import scrapeRoutes from "../scrapeRoutes";
import { isPrivateIP } from "../../utils/scrapeUtils";

// Mock the scrape utils so we don't hit external websites or launch Puppeteer during route testing
vi.mock("../../utils/scrapeUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/scrapeUtils")>();
  return {
    ...actual,
    scrapeUrl: vi.fn().mockResolvedValue({
      title: "Test App Title",
      description: "Test description",
      logo_url: "https://example.com/logo.png",
      developer: "example.com",
      brand: "Test Brand",
      price: 0,
      currency: "USD",
      images: ["https://example.com/img.png"],
      buy_url: "https://example.com",
    }),
    scrapeProfile: vi.fn().mockResolvedValue({
      full_name: "John Doe",
      handle: "johndoe",
      bio: "Software Engineer",
      platform: "github",
    }),
  };
});

// Mock axios specifically for proxy-image test cases
vi.mock("axios", async (importOriginal) => {
  const actual = await importOriginal<typeof import("axios")>();
  return {
    default: {
      ...actual.default,
      get: vi.fn(),
    },
  };
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.set("trust proxy", true);
  app.use("/api", scrapeRoutes);
  return app;
}

describe("isPrivateIP (SSRF Protection Unit Tests)", () => {
  it("rejects loopback addresses", () => {
    expect(isPrivateIP("127.0.0.1")).toBe(true);
    expect(isPrivateIP("127.255.0.1")).toBe(true);
    expect(isPrivateIP("::1")).toBe(true);
  });

  it("rejects RFC 1918 private IPv4 addresses", () => {
    expect(isPrivateIP("10.0.0.1")).toBe(true);
    expect(isPrivateIP("172.16.0.100")).toBe(true);
    expect(isPrivateIP("172.31.255.255")).toBe(true);
    expect(isPrivateIP("192.168.1.1")).toBe(true);
  });

  it("rejects link-local addresses", () => {
    expect(isPrivateIP("169.254.1.1")).toBe(true);
    expect(isPrivateIP("fe80::1")).toBe(true);
  });

  it("rejects unique local IPv6 addresses", () => {
    expect(isPrivateIP("fc00::1")).toBe(true);
    expect(isPrivateIP("fdff::99")).toBe(true);
  });

  it("rejects unspecified and multicast addresses", () => {
    expect(isPrivateIP("0.0.0.0")).toBe(true);
    expect(isPrivateIP("224.0.0.1")).toBe(true);
    expect(isPrivateIP("ff02::1")).toBe(true);
  });

  it("allows public IP addresses", () => {
    expect(isPrivateIP("8.8.8.8")).toBe(false);
    expect(isPrivateIP("1.1.1.1")).toBe(false);
    expect(isPrivateIP("2606:4700:4700::1111")).toBe(false);
  });

  it("treats invalid IPs as private/unsafe", () => {
    expect(isPrivateIP("invalid-ip")).toBe(true);
    expect(isPrivateIP("999.999.999.999")).toBe(true);
  });
});

describe("POST /api/apps/scrape-url", () => {
  it("returns 400 when URL is missing", async () => {
    const res = await request(buildApp()).post("/api/apps/scrape-url").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Missing URL");
  });

  it("returns scraped app metadata for a valid request", async () => {
    const res = await request(buildApp())
      .post("/api/apps/scrape-url")
      .send({ url: "https://apple.com/app" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Test App Title");
    expect(res.body.developer).toBe("example.com");
  });
});

describe("POST /api/products/scrape-link", () => {
  it("returns 400 when URL is missing", async () => {
    const res = await request(buildApp()).post("/api/products/scrape-link").send({});
    expect(res.status).toBe(400);
  });

  it("returns scraped product metadata for a valid request", async () => {
    const res = await request(buildApp())
      .post("/api/products/scrape-link")
      .send({ url: "https://amazon.com/product" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Test App Title");
    expect(res.body.images).toBeInstanceOf(Array);
  });
});

describe("POST /api/people/scrape-profile", () => {
  it("returns 400 when URL is missing", async () => {
    const res = await request(buildApp()).post("/api/people/scrape-profile").send({});
    expect(res.status).toBe(400);
  });

  it("returns scraped profile metadata for a valid request", async () => {
    const res = await request(buildApp())
      .post("/api/people/scrape-profile")
      .send({ url: "https://github.com/johndoe" });
    expect(res.status).toBe(200);
    expect(res.body.full_name).toBe("John Doe");
    expect(res.body.platform).toBe("github");
  });
});

describe("GET /api/proxy-image safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests missing the url parameter", async () => {
    const res = await request(buildApp()).get("/api/proxy-image");
    expect(res.status).toBe(400);
  });

  it("rejects non-http/https protocols (SSRF block)", async () => {
    const res = await request(buildApp()).get("/api/proxy-image?url=ftp%3A%2F%2Flocalhost%2Fimage.png");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Only http and https protocols");
  });

  it("rejects invalid URL strings", async () => {
    const res = await request(buildApp()).get("/api/proxy-image?url=invalid-url-string");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Invalid URL format");
  });

  it("rejects response sizes that exceed the limit via content-length", async () => {
    const mockDestroy = vi.fn();
    vi.mocked(axios.get).mockResolvedValue({
      headers: {
        "content-type": "image/png",
        "content-length": String(10 * 1024 * 1024), // 10MB
      },
      data: {
        destroy: mockDestroy,
        pipe: vi.fn(),
      },
    } as any);

    const res = await request(buildApp()).get("/api/proxy-image?url=https%3A%2F%2Fexample.com%2Fbig.png");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("size exceeds limit");
    expect(mockDestroy).toHaveBeenCalled();
  });

  it("rejects non-image content-types", async () => {
    const mockDestroy = vi.fn();
    vi.mocked(axios.get).mockResolvedValue({
      headers: {
        "content-type": "text/html",
      },
      data: {
        destroy: mockDestroy,
        pipe: vi.fn(),
      },
    } as any);

    const res = await request(buildApp()).get("/api/proxy-image?url=https%3A%2F%2Fexample.com%2Fpage.html");
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("does not point to an image");
    expect(mockDestroy).toHaveBeenCalled();
  });
});
