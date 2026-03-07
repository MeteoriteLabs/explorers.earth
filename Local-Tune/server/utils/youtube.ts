/**
 * Utility functions for working with YouTube URLs and video IDs
 */

/**
 * Extracts video ID from various YouTube URL formats
 * Supports:
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - Bare video IDs (11 alphanumeric characters)
 * 
 * @param url - YouTube URL or video ID
 * @returns Video ID if found, null otherwise
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();

  // Check if it's already a bare video ID (11 alphanumeric characters)
  // YouTube video IDs are exactly 11 characters and contain alphanumeric characters, hyphens, and underscores
  const bareIdPattern = /^[a-zA-Z0-9_-]{11}$/;
  if (bareIdPattern.test(trimmed)) {
    return trimmed;
  }

  // Patterns for various YouTube URL formats
  const patterns = [
    // youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // youtube.com/watch?v=VIDEO_ID or youtube.com/watch?feature=...&v=VIDEO_ID
    /(?:youtube\.com\/watch\?.*[&?]v=)([a-zA-Z0-9_-]{11})/,
    // youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // youtube.com/v/VIDEO_ID
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Checks if a string is a YouTube URL
 * 
 * @param str - String to check
 * @returns true if the string appears to be a YouTube URL, false otherwise
 */
export function isYouTubeUrl(str: string): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }

  const trimmed = str.trim();
  
  // Check for YouTube domain patterns
  const youtubePatterns = [
    /^https?:\/\/(?:www\.)?(?:youtu\.be|youtube\.com|m\.youtube\.com)/,
    /^youtu\.be\//,
    /^youtube\.com\//,
    /^m\.youtube\.com\//,
  ];

  // Check if it matches any YouTube URL pattern
  for (const pattern of youtubePatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  // Also check if it's a bare video ID (11 alphanumeric characters)
  const bareIdPattern = /^[a-zA-Z0-9_-]{11}$/;
  if (bareIdPattern.test(trimmed)) {
    return true;
  }

  return false;
}

