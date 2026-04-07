import { Helmet } from 'react-helmet-async';
import type { GEOData } from '../types/geoTypes';

const BASE_URL = 'https://localtunes.earth';

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
  enableGEO?: boolean;
  geoData?: GEOData;
  breadcrumbs?: Array<{ name: string; url: string }>;
}

const defaults = {
  title: 'Local Tunes - Create and Share Live Playlists with Your Guests',
  description:
    'Transform your venue with interactive music experiences. Let guests contribute to playlists in real-time, perfect for bars, restaurants, cafes, and events.',
  keywords: [
    'collaborative playlist',
    'interactive music',
    'venue music',
    'live playlist',
    'guest music',
    'DJ alternative',
    'karaoke system',
    'silent party',
  ],
  image: `${BASE_URL}/logo-social.png`,
  siteName: 'Local Tunes',
  twitterHandle: '@localtunes',
};

function getSchemaType(pageType: string): string {
  switch (pageType) {
    case 'venue':
      return 'MusicVenue';
    case 'playlist':
      return 'MusicPlaylist';
    case 'landing':
      return 'SoftwareApplication';
    default:
      return 'WebPage';
  }
}

function generateAIMetaTags(geoData: GEOData): Record<string, string> {
  const tags: Record<string, string> = {};

  if (geoData.pageContext) {
    tags['ai:page-type'] = geoData.pageContext.type;
    if (geoData.pageContext.primaryEntity) tags['ai:primary-entity'] = geoData.pageContext.primaryEntity;
    if (geoData.pageContext.summary) tags['ai:content-summary'] = geoData.pageContext.summary;
    if (geoData.pageContext.intent) tags['ai:user-intent'] = geoData.pageContext.intent;
  }

  if (geoData.naturalLanguage?.commonQueries) {
    tags['ai:common-queries'] = geoData.naturalLanguage.commonQueries.join(' | ');
  }
  if (geoData.naturalLanguage?.conversationalKeywords) {
    tags['ai:conversational-keywords'] = geoData.naturalLanguage.conversationalKeywords.join(', ');
  }
  if (geoData.naturalLanguage?.entities) {
    tags['ai:entities'] = geoData.naturalLanguage.entities.join(', ');
  }

  return tags;
}

function generateStructuredData(seo: Record<string, any>, geoData?: GEOData) {
  if (!geoData?.pageContext) return null;

  const data: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': getSchemaType(geoData.pageContext.type),
    name: seo.title,
    description: geoData.enrichedContent?.fullDescription || seo.description,
    url: seo.url,
  };

  if (geoData.contextualData?.location) {
    const loc = geoData.contextualData.location;
    data.location = { '@type': 'Place', name: loc.name };
    if (loc.coordinates) {
      data.location.geo = {
        '@type': 'GeoCoordinates',
        latitude: loc.coordinates.lat,
        longitude: loc.coordinates.lng,
      };
    }
  }

  if (geoData.contextualData?.relationships?.categories) {
    data.category = geoData.contextualData.relationships.categories;
  }

  return data;
}

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords = [],
  canonical,
  image,
  url,
  type = 'website',
  noIndex = false,
  enableGEO = false,
  geoData,
  breadcrumbs,
}) => {
  const seo = {
    title: title || defaults.title,
    description: description || defaults.description,
    keywords: keywords.length > 0 ? keywords : defaults.keywords,
    canonical: canonical ? `${BASE_URL}${canonical}` : BASE_URL,
    image: image || defaults.image,
    url: url ? `${BASE_URL}${url}` : BASE_URL,
    type,
  };

  const aiTags = enableGEO && geoData ? generateAIMetaTags(geoData) : {};
  const structuredData = enableGEO && geoData ? generateStructuredData(seo, geoData) : null;

  const enhancedKeywords =
    enableGEO && geoData
      ? [
          ...seo.keywords,
          ...(geoData.naturalLanguage?.conversationalKeywords || []),
          ...(geoData.naturalLanguage?.entities || []),
        ].filter((k, i, a) => a.indexOf(k) === i)
      : seo.keywords;

  const enhancedDescription =
    enableGEO && geoData?.aiDescription?.conversational
      ? geoData.aiDescription.conversational
      : seo.description;

  return (
    <Helmet>
      {/* Basic */}
      <title>{seo.title}</title>
      <meta name="description" content={enhancedDescription} />
      <meta name="keywords" content={enhancedKeywords.join(', ')} />
      <meta name="robots" content={noIndex ? 'noindex, nofollow' : 'index, follow'} />
      <link rel="canonical" href={seo.canonical} />

      {/* AI Meta Tags */}
      {enableGEO &&
        Object.entries(aiTags).map(([key, value]) => (
          <meta key={key} name={key} content={value} />
        ))}

      {/* Open Graph */}
      <meta property="og:type" content={seo.type} />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={enhancedDescription} />
      <meta property="og:image" content={seo.image} />
      <meta property="og:url" content={seo.url} />
      <meta property="og:site_name" content={defaults.siteName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={enhancedDescription} />
      <meta name="twitter:image" content={seo.image} />

      {/* Organization Schema */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: defaults.siteName,
          url: BASE_URL,
          logo: `${BASE_URL}/logo.svg`,
          sameAs: [
            'https://twitter.com/localtunes',
            'https://instagram.com/localtunes',
          ],
        })}
      </script>

      {/* WebSite Schema */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: defaults.siteName,
          url: BASE_URL,
        })}
      </script>

      {/* GEO Enhanced Structured Data */}
      {enableGEO && structuredData && (
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      )}

      {/* FAQ Schema */}
      {enableGEO && geoData?.aiDescription?.qaFormat && geoData.aiDescription.qaFormat.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: geoData.aiDescription.qaFormat.map((qa) => ({
              '@type': 'Question',
              name: qa.question,
              acceptedAnswer: { '@type': 'Answer', text: qa.answer },
            })),
          })}
        </script>
      )}

      {/* Breadcrumb Schema */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbs.map((crumb, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: crumb.name,
              item: `${BASE_URL}${crumb.url}`,
            })),
          })}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
