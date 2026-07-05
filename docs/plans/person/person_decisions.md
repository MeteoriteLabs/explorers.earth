---
Feature: person
Doc type: decisions
Status: draft
Created: 2026-07-05
Last updated: 2026-07-05
Updated by: agent
---

# People — Architectural Decisions

This document lists the architectural decisions made during the design of the People recommendation feature, detailing the alternatives considered, decisions made, and their consequences.

---

## ADR 1: Self-Hosting Profile Avatars on S3 vs. Direct CDN Hotlinking

### Context & Problem
Instagram and LinkedIn return highly dynamic, time-limited, and CORS-restricted profile picture URLs. Furthermore, both platforms actively block direct hotlinking from external domains, resulting in `403 Forbidden` broken images when trying to render avatars inside `<img>` tags on explorers.earth.

### Alternatives Considered
1. **Direct Hotlinking**: Storing the URL directly from the scraped profile.
2. **Proxying Images**: Setting up a backend proxy server to stream the avatars on requests.
3. **S3 Downloading & Hosting**: Downloading the profile picture from the source and uploading it to our S3 bucket at creation/edit time.

### Decision
**Option 3: S3 Downloading & Hosting**. When a creator adds or updates a person profile, the backend downloads the avatar image, processes it, and uploads it to explorers.earth S3 storage.

### Consequences
- **Pros**:
  - Guaranteed image loading on public profiles (no `403 Forbidden` or CORS issues).
  - Consistent image availability even if the recommended person changes their profile picture or deletes their account.
  - Control over image compression and caching optimization.
- **Cons**:
  - Small storage overhead on S3.
  - Slightly higher write latency at save time due to downloading and uploading operations.

---

## ADR 2: Profile Scraping Strategy and Manual Fallback

### Context & Problem
LinkedIn and Instagram have aggressive anti-bot protection (Cloudflare, CAPTCHAs, login walls). Normal server-side HTTP requests to these platforms frequently fail or return login redirects. We need a reliable way to add users without forcing complex third-party API integrations (e.g., official Graph API/LinkedIn Partner portals which require company approval and user auth).

### Alternatives Considered
1. **Official APIs**: Force creators to connect their profiles, or require official tokens. (High friction, complex).
2. **Paid Scraping Proxies**: Integrate paid proxies (e.g., ScrapingBee) to bypass bot protection. (Costs money).
3. **Basic Crawler + Fast Manual Fallback**: Attempt server-side HTML scraping for public Open Graph headers. If it fails, fail instantly and gracefully, prompting the user to fill fields manually.

### Decision
**Option 3: Basic Crawler + Fast Manual Fallback**. Write a backend scraper targeting public page headers (e.g. `og:image`, `og:title`). If blocked, the backend returns `success: false` with a warning, and the frontend automatically opens up the form fields allowing the user to copy-paste names, handles, and upload an avatar file manually.

### Consequences
- **Pros**:
  - Zero financial cost for proxies.
  - Highly robust: even if Instagram completely blocks scraping, the feature remains fully functional through the manual flow.
  - Very clean UX: the user is informed clearly and can continue instantly without blocker.
- **Cons**:
  - Auto-enrichment might fail ~50% of the time on restricted profiles, requiring manual copy-pasting.

---

## ADR 3: Grouping via "Sectors/Industries" (Person_Category) vs. Text Tags

### Context & Problem
We need to allow visitors to browse recommended individuals by sector (e.g., "Designers", "Founders"). We want to know if we should store this as simple text tags or as a separate relational database collection.

### Alternatives Considered
1. **JSON Text Tags**: Store all tags (e.g., `["Design", "Founder"]`) inside a JSON column.
2. **Dedicated Person_Category Collection**: Create a relational table linking `RecommendedPerson` to `Person_Category` in Strapi.

### Decision
**Combination approach**: Use a relational `Person_Category` table for the primary high-level sector (e.g. "Designers") to build navigation links and grids. Use a JSON `skills_tags` array for granular, custom text tags (e.g. "React", "Figma", "Growth") which don't require global pages but provide context.

### Consequences
- **Pros**:
  - Clean global navigation (e.g. `/:username/people/sector/designers` loads all designers across lists).
  - Keeps database queries highly performant for sector filters.
  - Retains tagging flexibility for individual skill highlights.
- **Cons**:
  - Requires maintaining a third collection (`Person_Category`) in Strapi.

---

## ADR 4: UI/UX Distinctions from Places and Products

### Context & Problem
Since explorers.earth originally supported only Places (locations on a map), categories like Movies, Books, and People need distinct layouts to stand out visually and align with mental models.

### Decision
- **Avatars**: Use round, bordered frames instead of rectangular grids.
- **Social Indicators**: Place small, colored brand badges (Instagram, LinkedIn) on the corner of avatars.
- **Quick Links**: Instead of direct checkout/buy links (like products) or directions maps (like places), the primary action on a card goes directly to the person's LinkedIn or Instagram page, with a secondary click opening our internal recommendation modal.
