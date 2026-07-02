---
Feature: apps-and-tools
Doc type: testing
Status: draft
Created: 2026-07-02
Last updated: 2026-07-02
Updated by: agent
Depends on: apps_and_tools_prd.md, apps_and_tools_api_contract.md
---

# Apps & Tools — Testing Plan

Comprehensive test cases, manual verification checklists, and automated testing guidelines for the Apps & Tools feature.

---

## 1. Automated Tests

### Scraper API Unit Tests (Backend)
Test that the `/api/apps/scrape-url` endpoint properly extracts metadata.
- **Test cases:**
  - Standard HTML page with Open Graph tags (e.g., Notion, Figma) -> Verify title, description, and high-resolution icons are extracted.
  - Page with only standard HTML title/meta tags -> Verify correct fallback extraction.
  - Invalid URL or missing parameter -> Verify API returns `400 Bad Request`.
  - Non-responsive or timeout target server -> Verify API returns appropriate error JSON.
  - Proxy verification: Ensure User-Agent is sent correctly to avoid Cloudflare bot-blocking.

### Graphql Mutations & Queries (Integration)
Verify Apollo request/response operations against mock resolvers.
- **Test cases:**
  - Create list -> Verify defaults (visibility = false, display_order = 0).
  - Add app -> Verify logo URL string is validated as an S3 URL.
  - Pin app -> Verify pin_order incrementing logic.
  - Unpin app -> Verify pin_order recalculates and closes gap.

### End-to-End Tests (Cypress / Playwright)
Automated flow tests in a headful browser.
- **Creator Dashboard Flow:**
  - Login -> Navigate to Apps -> Create list named "Work Tools" -> Open list -> Paste URL `https://figma.com` -> Verify form fills with "Figma" -> Add note and select "Freemium" and "macOS" -> Click Save -> Verify figma card appears in list.
  - Reorder apps: Drag first row below second -> Reload page -> Verify ordering matches.
- **Public Profile Page Flow:**
  - Open `/:username/apps` -> Click "Figma" card -> Detail modal slides up -> Verify direct link opens in new tab -> Swipe down to close.

---

## 2. Manual Verification Checklist

### Creator Dashboard
- [ ] Sidebar and mobile category landing menus show the "Apps & Tools" links.
- [ ] Empty state renders if no list exists.
- [ ] "Create List" modal creates a valid list and auto-redirects to detail page.
- [ ] Pasting an invalid URL shows a validation error message.
- [ ] Pasting a valid URL auto-fills Title, Description, and Icon inside 3 seconds.
- [ ] Creator can toggle Platform checkboxes and select Price Model from dropdown.
- [ ] Logo upload and Screenshots upload successfully load files into S3 with correct path structure.
- [ ] Visibility Switch toggles list state between Published and Draft immediately.
- [ ] Deleting an app shows a confirmation dialog and updates list count.

### Public Profile Page
- [ ] Pinned Top Apps appear in the hero slider on desktop, and card stack on mobile.
- [ ] App card displays app name, logo, platforms icons list, price badge, and rating badge.
- [ ] Clicking the card slides up the detail modal without page jump.
- [ ] Detail modal displays all screenshots as a slider carousel.
- [ ] Download CTA button redirects to target site (with affiliate parameters).
- [ ] Verify translation keys work across all languages when switching locale.
