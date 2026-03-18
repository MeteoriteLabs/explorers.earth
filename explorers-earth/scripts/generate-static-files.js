#!/usr/bin/env node

/**
 * Generate static files with dynamic domain
 * This script should be run during build process to generate sitemap.xml and robots.txt
 * with the correct domain based on environment variables
 */

import fs from 'fs';
import path from 'path';

// Get the base URL from environment variables
const BASE_URL = process.env.VITE_BASE_URL || process.env.DEPLOY_URL || 'https://explorers.earth';

/**
 * Generate sitemap.xml with dynamic domain
 */
function generateSitemap() {
  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
                           http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">

  <!-- STATIC PUBLIC PAGES - Highest Priority -->
  
  <!-- Landing Page - Main entry point -->
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Legal & Information Pages -->
  <url>
    <loc>${BASE_URL}/contact</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>

  <url>
    <loc>${BASE_URL}/privacy</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>

  <url>
    <loc>${BASE_URL}/terms</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>

  <url>
    <loc>${BASE_URL}/cookies</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>

  <!-- AUTHENTICATION ROUTES - Lower Priority (included for completeness) -->
  
  <url>
    <loc>${BASE_URL}/login</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <url>
    <loc>${BASE_URL}/register</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <url>
    <loc>${BASE_URL}/forgot-password</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.4</priority>
  </url>

  <!-- Dynamic user profile URLs are served by the tunes backend at /api/explorers-sitemap.xml -->
  <!-- Nginx proxies /sitemap.xml to that endpoint in production -->

</urlset>`;

  return sitemapContent;
}

/**
 * Generate robots.txt with dynamic domain
 */
function generateRobotsTxt() {
  const robotsContent = `# explorers Robots.txt
# Optimized for SEO while protecting user privacy

User-agent: *

# PUBLIC ROUTES - Allow crawling for SEO and discoverability
Allow: /
Allow: /contact
Allow: /privacy
Allow: /cookies
Allow: /terms

# AUTHENTICATION PAGES - Allow crawling for user access
Allow: /login
Allow: /register
Allow: /forgot-password

# PUBLIC USER PROFILES - Accessible via QR scans
# Pattern: /{username}
Allow: /*/

# PUBLIC RECOMMENDATION PAGES - Shareable content
# Pattern: /{username}/places
# Pattern: /{username}/places/{placeSlug}
Allow: /*/places/
Allow: /*/places/*/

# PUBLIC MAP VIEWS - Location-based content
# Pattern: /{username}/places/map
# Pattern: /{username}/places/{placeSlug}/map
Allow: /*/places/map
Allow: /*/places/*/map

# PUBLIC COMMUNITY PAGES
# Pattern: /{username}/community
Allow: /*/community

# PRIVATE ROUTES - Disallow crawling to protect user privacy

# Authentication & Account Management (Private Routes Only)
Disallow: /reset-password
Disallow: /reset-link-sent
Disallow: /email-verification
Disallow: /email-confirmed
Disallow: /onboarding

# User Dashboard & Management (Protected Routes)
Disallow: /home
Disallow: /profile
Disallow: /recommendations
Disallow: /analytics
Disallow: /settings

# Dynamic Management Routes
Disallow: /*/new
Disallow: /*/edit

# API & Authentication Callbacks
Disallow: /api/
Disallow: /api/connect/google/callback

# System Routes
Disallow: /404

# Place-specific management routes that are private
# Pattern: /{username}/places/{place}/placesmap (internal management)
Disallow: /*/places/*/placesmap

# Dashboard routes (if using /dashboard/ prefix)
Disallow: /dashboard/

# Crawl Delay - Be respectful to server resources
Crawl-delay: 1

# Sitemap Location
Sitemap: ${BASE_URL}/sitemap.xml

# Additional Directives for Better SEO
# Allow common assets and resources
Allow: /assets/
Allow: /images/
Allow: /icons/
Allow: /public/
Allow: /*.css$
Allow: /*.js$
Allow: /*.svg$
Allow: /*.png$
Allow: /*.jpg$
Allow: /*.jpeg$
Allow: /*.gif$
Allow: /*.webp$
Allow: /*.avif$

# Block common unwanted paths
Disallow: /admin/
Disallow: /private/
Disallow: /internal/
Disallow: /_/
Disallow: /tmp/
Disallow: /temp/
Disallow: /*.json$
Disallow: /*?*utm_*
Disallow: /*?*session*
Disallow: /*?*token*
Disallow: /*?*auth*`;

  return robotsContent;
}

/**
 * Main function to generate all static files
 */
function main() {
  console.log(`Generating static files with base URL: ${BASE_URL}`);

  // Ensure public directory exists
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Generate sitemap.xml
  const sitemapPath = path.join(publicDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, generateSitemap(), { encoding: 'utf8' });
  console.log(`✅ Generated sitemap.xml at ${sitemapPath}`);

  // Generate robots.txt
  const robotsPath = path.join(publicDir, 'robots.txt');
  fs.writeFileSync(robotsPath, generateRobotsTxt(), { encoding: 'utf8' });
  console.log(`✅ Generated robots.txt at ${robotsPath}`);

  console.log('🎉 All static files generated successfully!');
}

// Run the script
main();
