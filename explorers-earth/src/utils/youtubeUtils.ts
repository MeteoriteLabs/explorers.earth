/**
 * Helper function to validate YouTube URLs
 * Supports various YouTube URL formats including bare video IDs
 */
export function isYouTubeUrl(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();

  const youtubePatterns = [
    /^https?:\/\/(?:www\.)?(?:youtu\.be|youtube\.com|m\.youtube\.com)/,
    /^youtu\.be\//,
    /^youtube\.com\//,
    /^m\.youtube\.com\//,
  ];

  for (const pattern of youtubePatterns) {
    if (pattern.test(trimmed)) return true;
  }

  // Check for bare YouTube video ID (11 characters, alphanumeric with - and _)
  const bareIdPattern = /^[a-zA-Z0-9_-]{11}$/;
  if (bareIdPattern.test(trimmed)) return true;

  return false;
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();

  // Check if it's already a bare video ID
  const bareIdPattern = /^[a-zA-Z0-9_-]{11}$/;
  if (bareIdPattern.test(trimmed)) return trimmed;

  // Extract from youtu.be URLs
  const youtuBeMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/);
  if (youtuBeMatch) return youtuBeMatch[1];

  // Extract from youtube.com URLs
  const youtubeMatch = trimmed.match(/youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/);
  if (youtubeMatch) return youtubeMatch[1];

  return null;
}

/**
 * Check if URL is a YouTube Music playlist
 */
export function isYouTubeMusicPlaylist(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /music\.youtube\.com\/playlist/.test(url.trim()) || /youtube\.com\/playlist/.test(url.trim());
}

/**
 * Check if URL is a Spotify playlist
 */
export function isSpotifyPlaylist(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /open\.spotify\.com\/playlist/.test(url.trim()) || /spotify\.com\/playlist/.test(url.trim());
}

