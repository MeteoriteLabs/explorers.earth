import type { GEOData } from '../types/geoTypes';

/**
 * GEO data generator for the tunes landing page
 */
export function createLandingGEOData(): GEOData {
  return {
    pageContext: {
      type: 'landing',
      primaryEntity: 'Local Tunes',
      intent: 'Learn about collaborative music platform for venues',
      summary: 'Local Tunes is an interactive music platform that lets venues create collaborative playlists where guests can contribute song requests in real-time.',
    },
    aiDescription: {
      conversational:
        'Local Tunes is a collaborative music platform designed for venues like bars, restaurants, cafes, and events. It allows venue owners to create playlists that guests can interact with in real-time, request songs, and participate in music experiences like karaoke and silent parties.',
      qaFormat: [
        { question: 'What is Local Tunes?', answer: 'Local Tunes is an interactive music platform for venues that lets guests contribute to playlists in real-time.' },
        { question: 'Who is Local Tunes for?', answer: 'Local Tunes is designed for bars, restaurants, cafes, event spaces, and any venue that wants to create engaging music experiences for their guests.' },
        { question: 'How does Local Tunes work?', answer: 'Venue owners create playlists, generate a shareable QR code or link, and guests scan it to request songs, vote on tracks, and interact with the music in real-time.' },
        { question: 'Is Local Tunes free?', answer: 'Local Tunes offers a free tier for getting started, with premium plans for venues that need advanced features.' },
        { question: 'What features does Local Tunes offer?', answer: 'Features include collaborative playlists, song requests, karaoke mode, silent party support, real-time queue management, and guest interaction analytics.' },
      ],
      keyPoints: [
        'Real-time collaborative playlists for venues',
        'QR code sharing for instant guest access',
        'Karaoke and silent party modes',
        'Works with YouTube music library',
        'Guest interaction analytics',
      ],
    },
    contextualData: {
      relationships: {
        categories: ['Music', 'Entertainment', 'Hospitality', 'Venue Technology'],
        targetAudience: ['Bar owners', 'Restaurant managers', 'Event planners', 'DJ alternatives', 'Hospitality industry'],
      },
    },
    naturalLanguage: {
      commonQueries: [
        'collaborative playlist app for bars',
        'guest music request system',
        'karaoke system for venues',
        'silent party music platform',
        'interactive music for restaurants',
        'QR code jukebox for bars',
      ],
      conversationalKeywords: [
        'collaborative playlist', 'guest music requests', 'venue music', 'interactive music',
        'karaoke system', 'silent party', 'real-time playlist', 'QR code music',
      ],
      entities: ['Local Tunes', 'collaborative playlist', 'venue music platform', 'guest experience'],
      sentimentContext: 'positive',
    },
    enrichedContent: {
      fullDescription:
        'Local Tunes transforms how venues engage their guests through music. Instead of a static playlist or expensive DJ, venues can create interactive music experiences where guests contribute to the playlist in real-time via their phones.',
      benefits: [
        'Increase guest engagement and dwell time',
        'No DJ required — guests curate the music',
        'Easy setup with QR codes',
        'Works with any device — no app download needed',
        'Analytics on guest preferences and interactions',
      ],
      uniqueAspects: [
        'Real-time collaborative playlists',
        'Built-in karaoke and silent party modes',
        'Integrated with YouTube music library',
        'QR code access — zero friction for guests',
      ],
      userExperience: 'Guests scan a QR code, browse the music library, and request songs that play through the venue\'s speakers. The venue owner manages the queue and can moderate requests.',
    },
  };
}

/**
 * GEO data generator for guest playlist pages (venue-specific)
 */
export function createVenueGEOData(params: {
  venueName: string;
  guestUrl: string;
  displayName?: string;
}): GEOData {
  const { venueName, guestUrl, displayName } = params;
  const venueDisplay = venueName || displayName || 'Venue';

  return {
    pageContext: {
      type: 'venue',
      primaryEntity: venueDisplay,
      intent: `Listen to music and request songs at ${venueDisplay}`,
      summary: `Interactive music playlist at ${venueDisplay}. Guests can request songs and contribute to the playlist in real-time.`,
    },
    aiDescription: {
      conversational: `This is the guest music page for ${venueDisplay}. Visitors can browse the music queue, request songs, and interact with the playlist in real-time.`,
      qaFormat: [
        { question: `What music is playing at ${venueDisplay}?`, answer: `Visit the ${venueDisplay} playlist page to see what's currently playing and request your favorite songs.` },
        { question: `How do I request a song at ${venueDisplay}?`, answer: `Scan the QR code or visit the playlist link to browse available songs and submit your request.` },
      ],
      keyPoints: [
        `Live music queue at ${venueDisplay}`,
        'Request songs in real-time',
        'No app download needed',
      ],
    },
    contextualData: {
      relationships: {
        categories: ['Music', 'Entertainment', 'Live Venue'],
        targetAudience: ['Venue guests', 'Music lovers'],
      },
    },
    naturalLanguage: {
      commonQueries: [
        `music at ${venueDisplay}`,
        `${venueDisplay} playlist`,
        `request songs at ${venueDisplay}`,
      ],
      conversationalKeywords: [
        venueDisplay, 'live music', 'song request', 'playlist', 'venue music',
      ],
      entities: [venueDisplay, 'Local Tunes', 'collaborative playlist'],
      sentimentContext: 'positive',
    },
    enrichedContent: {
      fullDescription: `${venueDisplay} uses Local Tunes to create an interactive music experience for guests. Browse the current playlist, request your favorite songs, and enjoy collaborative music.`,
      benefits: [
        'Request your favorite songs',
        'See what\'s playing in real-time',
        'No app download required',
      ],
      uniqueAspects: [
        'Real-time song queue',
        'Guest-driven music experience',
      ],
      userExperience: `Open the playlist page for ${venueDisplay}, browse available songs, and tap to request. Your request joins the queue and plays through the venue's speakers.`,
    },
  };
}

/**
 * GEO data generator for static/legal pages
 */
export function createWebPageGEOData(params: {
  pageName: string;
  pageDescription: string;
}): GEOData {
  return {
    pageContext: {
      type: 'webpage',
      primaryEntity: params.pageName,
      intent: `Read the ${params.pageName} for Local Tunes`,
      summary: params.pageDescription,
    },
    naturalLanguage: {
      entities: ['Local Tunes', params.pageName],
      sentimentContext: 'informative',
    },
  };
}
