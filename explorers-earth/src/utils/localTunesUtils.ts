// Utility functions for Local Tunes integration

/**
 * Extracts the guestUrl from a Local Tunes playlist link
 * @param localTunesLink - The Local Tunes link from social media data
 * @returns The guestUrl (playlist ID) or null if not found
 */
export function extractGuestUrlFromLocalTunesLink(localTunesLink: string): string | null {
  try {
    console.log('extractGuestUrlFromLocalTunesLink called with:', localTunesLink);
    
    // Extract the playlist ID from URLs like:
    // https://localtunes.earth/playlist/a6e4231634a63210d87b7e593803d4ce
    // https://localtunes.com/playlist/a6e4231634a63210d87b7e593803d4ce
    
    const url = new URL(localTunesLink);
    console.log('Parsed URL:', url);
    
    const pathParts = url.pathname.split('/');
    console.log('Path parts:', pathParts);
    
    // Find the 'playlist' segment and get the next part
    const playlistIndex = pathParts.indexOf('playlist');
    console.log('Playlist index:', playlistIndex);
    
    if (playlistIndex !== -1 && playlistIndex + 1 < pathParts.length) {
      const guestUrl = pathParts[playlistIndex + 1];
      console.log('Found guestUrl:', guestUrl);
      return guestUrl;
    }
    
    console.log('No playlist segment found in URL');
    return null;
  } catch (error) {
    console.error('Error extracting guestUrl from Local Tunes link:', error);
    return null;
  }
}

/**
 * Extracts guestUrl from account social media data
 * @param socialMedia - The social media object from account data
 * @returns The guestUrl or null if not found
 */
export function getGuestUrlFromAccount(socialMedia: any): string | null {
  console.log('getGuestUrlFromAccount called with:', socialMedia);
  
  // Check for different possible structures
  if (socialMedia?.localTunes?.link) {
    console.log('Found localTunes.link:', socialMedia.localTunes.link);
    const guestUrl = extractGuestUrlFromLocalTunesLink(socialMedia.localTunes.link);
    console.log('Extracted guestUrl:', guestUrl);
    return guestUrl;
  }
  
  // Check for alternative structure (case sensitivity, different property names)
  if (socialMedia?.LocalTunes?.link) {
    console.log('Found LocalTunes.link:', socialMedia.LocalTunes.link);
    const guestUrl = extractGuestUrlFromLocalTunesLink(socialMedia.LocalTunes.link);
    console.log('Extracted guestUrl:', guestUrl);
    return guestUrl;
  }
  
  if (socialMedia?.localtunes?.link) {
    console.log('Found localtunes.link:', socialMedia.localtunes.link);
    const guestUrl = extractGuestUrlFromLocalTunesLink(socialMedia.localtunes.link);
    console.log('Extracted guestUrl:', guestUrl);
    return guestUrl;
  }
  
  console.log('No localTunes.link found in social media data');
  console.log('Available properties:', Object.keys(socialMedia || {}));
  return null;
}

/**
 * Validates if a guestUrl is a valid Local Tunes playlist ID
 * @param guestUrl - The guestUrl to validate
 * @returns true if valid, false otherwise
 */
export function isValidLocalTunesGuestUrl(guestUrl: string): boolean {
  // Local Tunes playlist IDs are typically 32-character hex strings
  return /^[a-f0-9]{32}$/i.test(guestUrl);
}

/**
 * Constructs a Local Tunes playlist URL from a guestUrl
 * @param guestUrl - The playlist ID
 * @param baseUrl - Optional base URL (defaults to environment variable)
 * @returns The complete Local Tunes playlist URL
 */
export function buildLocalTunesPlaylistUrl(guestUrl: string, baseUrl?: string): string {
  const base = baseUrl || import.meta.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth';
  return `${base}/playlist/${guestUrl}`;
}
