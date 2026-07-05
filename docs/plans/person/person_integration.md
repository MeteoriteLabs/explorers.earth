---
Feature: person
Doc type: integration
Status: draft
Created: 2026-07-05
Last updated: 2026-07-05
Updated by: agent
Depends on: person_architecture.md, person_api_contract.md
---

# People — Integration Guide

A step-by-step implementation guide for developers setting up the People (Person Recommendations) feature.

---

## Phase 1: Strapi Schema & Backend Setup

### 1. Create Strapi Collections
Using the Strapi Content-Type Builder, create the three collections described in `person_schema.md`:
- `PersonList` (singular ID: `person-list`, plural: `person-lists`)
- `RecommendedPerson` (singular ID: `recommended-person`, plural: `recommended-people`)
- `Person_Category` (singular ID: `person-category`, plural: `person-categories`)

### 2. Implement the Profile Link Scraper Endpoint
In your Strapi backend project, create a profile scraper endpoint.

**Dependencies:** `npm install cheerio node-fetch`

Create the controller file `src/api/recommended-person/controllers/scraper.js`:

```javascript
const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = {
  async scrape(ctx) {
    const { url } = ctx.query;
    if (!url) return ctx.badRequest('URL query parameter is required');

    try {
      const response = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        timeout: 8000
      });
      
      if (!response.ok) {
        return ctx.send({ success: false, error: `Platform returned status ${response.status}` });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      let name = '';
      let username = '';
      let headline = '';
      let avatarUrl = '';
      let platform = 'website';

      // Detect Platform
      if (url.includes('instagram.com')) {
        platform = 'instagram';
        
        // Instagram og:title contains: "Name (@username) • Instagram photos and videos"
        const ogTitle = $('meta[property="og:title"]').attr('content') || '';
        const match = ogTitle.match(/^([^(]+)\s+\(([^)]+)\)/);
        if (match) {
          name = match[1].trim();
          username = match[2].trim();
        } else {
          name = ogTitle.replace('• Instagram photos and videos', '').trim();
          username = name;
        }

        headline = $('meta[property="og:description"]').attr('content') || '';
        avatarUrl = $('meta[property="og:image"]').attr('content') || '';

      } else if (url.includes('linkedin.com')) {
        platform = 'linkedin';

        // LinkedIn og:title: "Jane Doe - Lead Designer - Company | LinkedIn"
        const ogTitle = $('meta[property="og:title"]').attr('content') || '';
        const titleParts = ogTitle.split('-');
        name = titleParts[0]?.trim() || '';
        
        // Reconstruct headline from parts
        if (titleParts.length > 1) {
          headline = titleParts.slice(1).join('-').replace('| LinkedIn', '').trim();
        }

        const ogDesc = $('meta[property="og:description"]').attr('content') || '';
        if (!headline) headline = ogDesc;

        avatarUrl = $('meta[property="og:image"]').attr('content') || '';
        username = url.split('/in/')?.[1]?.replace(/\//g, '') || '';

      } else {
        // Fallback for general website / other profiles
        name = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
        headline = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
        avatarUrl = $('meta[property="og:image"]').attr('content') || '';
        if (url.includes('twitter.com') || url.includes('x.com')) platform = 'twitter';
        else if (url.includes('github.com')) platform = 'github';
        else if (url.includes('youtube.com')) platform = 'youtube';
      }

      ctx.body = {
        success: true,
        data: {
          name: name.trim(),
          username: username.trim(),
          headline: headline.trim(),
          avatarUrl,
          platform
        }
      };
    } catch (err) {
      ctx.send({ success: false, error: err.message });
    }
  }
};
```

Bind this controller to `GET /api/people/scrape-profile` route in your Strapi router configuration.

### 3. Self-Hosted Avatar Downloader (Strapi Lifecycle Hook)
To prevent image hotlinking errors, implement a lifecycle hook that downloads external avatar images and pushes them to S3.
Create/update `src/api/recommended-person/content-types/recommended-person/lifecycles.js`:

```javascript
const axios = require('axios');

module.exports = {
  async beforeCreate(event) {
    await downloadAndStoreAvatar(event.params.data);
  },
  async beforeUpdate(event) {
    await downloadAndStoreAvatar(event.params.data);
  }
};

async function downloadAndStoreAvatar(data) {
  // If we have an external URL in avatarUrl (and it's not already on S3/local storage)
  if (data.avatarUrl && data.avatarUrl.startsWith('http') && !data.avatarUrl.includes('amazonaws.com')) {
    try {
      const response = await axios.get(data.avatarUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      
      // Upload buffer to S3 using Strapi file upload provider
      const uploadService = strapi.plugins['upload'].services.upload;
      const fileInfo = {
        name: `avatar_${data.username_handle || 'profile'}.jpg`,
        mime: 'image/jpeg',
        path: `${data.account}/people/avatar/`
      };
      
      const [uploadedFile] = await uploadService.upload({
        data: { fileInfo },
        files: {
          path: buffer,
          name: fileInfo.name,
          type: fileInfo.mime,
          size: buffer.length
        }
      });
      
      // Replace external URL with self-hosted S3 URL
      data.avatar_path = uploadedFile.url;
    } catch (err) {
      strapi.log.error('Failed to self-host external avatar, keeping fallback URL', err);
    }
  }
}
```

---

## Phase 2: Frontend Hooks & API Setup

Create `src/features/People/hooks/usePersonLinkScraper.ts`:

```typescript
import { useState } from 'react';
import axios from 'axios';
import { ScrapedProfileMetadata } from '../types';

export function usePersonLinkScraper() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrape = async (url: string): Promise<ScrapedProfileMetadata | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/people/scrape-profile?url=${encodeURIComponent(url)}`);
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to extract profile details');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to extract profile info');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { scrape, loading, error };
}
```

---

## Phase 3: Dashboard & Public UI Integration

1. **Sidebar Navigation**:
   Update `src/components/DashboardSidebar.tsx` to include "People" and map it to `src/features/People/components/dashboard/PeopleHome.tsx`.
2. **Avatar Loading with Fallback**:
   Implement a helper function inside `src/features/People/utils/personHelpers.ts`:
   ```typescript
   export function getAvatarUrl(avatarPath?: string, fallbackPlatform?: string): string {
     if (avatarPath) return avatarPath;
     // Return local placeholder icon based on platform
     return `/placeholders/avatar-${fallbackPlatform || 'generic'}.png`;
   }
   ```
3. **Platform Brand Resolver**:
   Map primary platform and external links to custom SVG icons (Instagram purple/pink, LinkedIn blue, X/Twitter black, GitHub dark grey, YouTube red, etc.).
