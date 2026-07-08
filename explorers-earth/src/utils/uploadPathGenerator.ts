/**
 * Utility functions for generating structured upload paths for S3 organization
 * 
 * UNIFIED ARCHITECTURE:
 * All user images are organized under a single username directory:
 * 
 * {username}/
 * ├── profile/           (profile images)
 * ├── background/        (background images)
 * ├── feed/
 * │   ├── images/        (manual image uploads)
 * │   ├── videos/        (manual video uploads)
 * │   └── google-import/ (imported Google images)
 * ├── locations/         (location thumbnails)
 * ├── guides/            (guide-related media)
 * │   ├── {guideId}/     (guide cover images)
 * │   └── sections/
 * │       └── {sectionId}/
 * │           └── activities/
 * │               └── {placeId}/
 * │                   └── [activity photo files]
 * ├── movies/
 * │   └── {movieListId}/
 * │       ├── cover/
 * │       │   └── [list cover image]
 * │       └── {tmdbId}/
 * │           └── [movie recommendation media files]
 * └── {recommendationListId}/
 *     └── {placeId}/
 *         └── [recommendation image files]
 * 
 * This structure provides:
 * - Single namespace per user for better organization
 * - Simplified access control and permissions
 * - Easier backup and migration
 * - Consistent directory hierarchy
 * - Clear separation of feed media by type and source
 * 
 * Example paths:
 * - john-doe/profile/1735689600000-abc123.jpg
 * - john-doe/background/1735689600000-def456.jpg
 * - john-doe/feed/images/1735689600000-ghi789.jpg
 * - john-doe/feed/videos/1735689600000-jkl012.mp4
 * - john-doe/feed/google-import/1735689600000-mno345.jpg
 * - john-doe/locations/1735689600000-pqr678.jpg
 * - john-doe/guides/guide-123/1735689600000-cover.jpg
 * - john-doe/guides/sections/section-456/activities/ChIJK6Ow.../1761647278121-photo.jpg
 * - john-doe/rec_abc123/place_def456/1735689600000-pqr678.jpg
 */

/**
 * Generates a random filename with timestamp to avoid collisions
 * @param originalName - Original filename (optional)
 * @param extension - File extension (optional, will be extracted from originalName if not provided)
 * @returns Random filename with timestamp
 */
export const generateRandomFileName = (originalName?: string, extension?: string): string => {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);

  if (extension) {
    return `${timestamp}-${randomId}.${extension}`;
  }

  if (originalName) {
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'jpg';
    return `${timestamp}-${randomId}.${ext}`;
  }

  return `${timestamp}-${randomId}.jpg`;
};

/**
 * Generates structured path for profile-related uploads
 * Uses unified structure: {username}/{type}/{filename}
 * @param username - User's username
 * @param type - Type of upload (profile, background)
 * @param filename - Generated filename
 * @returns Structured path for profile uploads
 */
export const generateProfileUploadPath = (
  username: string,
  type: 'profile' | 'background',
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  return `${sanitizedUsername}/${type}/${filename}`;
};

/**
 * Generates structured path for feed media uploads
 * Uses unified structure: {username}/feed/{mediaType}/{filename}
 * @param username - User's username
 * @param mediaType - Type of media (images, videos, google-import)
 * @param filename - Generated filename
 * @returns Structured path for feed uploads
 */
export const generateFeedUploadPath = (
  username: string,
  mediaType: 'images' | 'videos' | 'google-import' | 'instagram-import',
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  return `${sanitizedUsername}/feed/${mediaType}/${filename}`;
};

/**
 * Generates structured path for location thumbnail uploads
 * Uses unified structure: {username}/locations/
 * Note: Path should only include directory, not filename, as Strapi will use the filename from the File object
 * @param username - User's username
 * @returns Structured directory path for location thumbnail uploads
 */
export const generateLocationThumbnailPath = (
  username: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  return `${sanitizedUsername}/locations`;
};

/**
 * Generates structured path for recommendation/place image uploads
 * Uses unified structure: {username}/{recommendationListId}/{placeId}/{filename}
 * @param username - User's username
 * @param recommendationListId - Unique ID of the recommendation list
 * @param placeId - Unique ID of the place within the recommendation list
 * @param filename - Generated filename
 * @returns Structured path for recommendation uploads
 */
export const generateRecommendationUploadPath = (
  username: string,
  recommendationListId: string,
  placeId: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedListId = sanitizeIdentifier(recommendationListId);
  const sanitizedPlaceId = sanitizeIdentifier(placeId);

  return `${sanitizedUsername}/${sanitizedListId}/${sanitizedPlaceId}/${filename}`;
};

/**
 * Generates structured path for guide cover image uploads
 * Uses unified structure: {username}/guides/{guideId}/{filename}
 * @param username - User's username
 * @param guideId - Unique ID of the guide (documentId)
 * @param filename - Generated filename
 * @returns Structured path for guide cover uploads
 */
export const generateGuideUploadPath = (
  username: string,
  guideId: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedGuideId = sanitizeIdentifier(guideId);

  return `${sanitizedUsername}/guides/${sanitizedGuideId}/${filename}`;
};

/**
 * Generates structured path for guide section activity photo uploads
 * Uses unified structure: {username}/guides/sections/{sectionId}/activities/{placeId}/{filename}
 * @param username - User's username
 * @param sectionId - Guide section document ID
 * @param placeId - Google Place ID
 * @param filename - Generated filename
 * @returns Structured path for activity photo uploads
 * 
 * @example
 * generateActivityPhotoPath('john-doe', 'section-123', 'ChIJK6Ow...', '1761647278121-53quv6.jpg')
 * // Returns: 'john-doe/guides/sections/section-123/activities/ChIJK6Ow.../1761647278121-53quv6.jpg'
 */
export const generateActivityPhotoPath = (
  username: string,
  sectionId: string,
  placeId: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedSectionId = sanitizeIdentifier(sectionId);
  const sanitizedPlaceId = sanitizeIdentifier(placeId);

  return `${sanitizedUsername}/guides/sections/${sanitizedSectionId}/activities/${sanitizedPlaceId}/${filename}`;
};

/**
 * Generates structured path for movie list/movie image uploads
 * Uses unified structure: {username}/movies/{movieListId}/{tmdbId}/{filename}
 * @param username - User's username
 * @param movieListId - Unique ID of the movie list
 * @param tmdbId - TMDB ID of the movie
 * @param filename - Generated filename
 * @returns Structured path for movie uploads
 */
export const generateMovieUploadPath = (
  username: string,
  movieListId: string,
  tmdbId: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedListId = sanitizeIdentifier(movieListId);
  const sanitizedMovieId = sanitizeIdentifier(tmdbId);

  return `${sanitizedUsername}/movies/${sanitizedListId}/${sanitizedMovieId}/${filename}`;
};

/**
 * Generates structured path for movie list cover image uploads
 * Uses unified structure: {username}/movies/{movieListId}/cover/{filename}
 * @param username - User's username
 * @param movieListId - Unique ID of the movie list
 * @param filename - Generated filename
 * @returns Structured path for movie list cover uploads
 */
export const generateMovieListCoverPath = (
  username: string,
  movieListId: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedListId = sanitizeIdentifier(movieListId);

  return `${sanitizedUsername}/movies/${sanitizedListId}/cover/${filename}`;
};

/**
 * Generates structured path for book list/book image uploads
 * Uses unified structure: {username}/books/{bookListId}/{volumeId}/{filename}
 * @param username - User's username
 * @param bookListId - Unique ID of the book list
 * @param volumeId - Google Books Volume ID
 * @param filename - Generated filename
 * @returns Structured path for book uploads
 */
export const generateBookUploadPath = (
  username: string,
  bookListId: string,
  volumeId: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedListId = sanitizeIdentifier(bookListId);
  const sanitizedVolumeId = sanitizeIdentifier(volumeId);

  return `${sanitizedUsername}/books/${sanitizedListId}/${sanitizedVolumeId}/${filename}`;
};

/**
 * Generates structured path for book list cover image uploads
 * Uses unified structure: {username}/books/{bookListId}/cover/{filename}
 * @param username - User's username
 * @param bookListId - Unique ID of the book list
 * @param filename - Generated filename
 * @returns Structured path for book list cover uploads
 */
export const generateBookListCoverPath = (
  username: string,
  bookListId: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedListId = sanitizeIdentifier(bookListId);

  return `${sanitizedUsername}/books/${sanitizedListId}/cover/${filename}`;
};

/**
 * Generates structured path for game list cover image uploads
 * Uses unified structure: {username}/games/{gameListId}/cover/{filename}
 * @param username - User's username
 * @param gameListId - Unique ID of the game list
 * @param filename - Generated filename
 * @returns Structured path for game list cover uploads
 */
export const generateGameListCoverPath = (
  username: string,
  gameListId: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedListId = sanitizeIdentifier(gameListId);

  return `${sanitizedUsername}/games/${sanitizedListId}/cover/${filename}`;
};

/**
 * Generates structured path for game list/game image uploads
 * Uses unified structure: {username}/games/{gameListId}/{igdbId}/{filename}
 * @param username - User's username
 * @param gameListId - Unique ID of the game list
 * @param igdbId - IGDB ID
 * @param filename - Generated filename
 * @returns Structured path for game uploads
 */
export const generateGameUploadPath = (
  username: string,
  gameListId: string,
  igdbId: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedListId = sanitizeIdentifier(gameListId);
  const sanitizedIgdbId = sanitizeIdentifier(igdbId);

  return `${sanitizedUsername}/games/${sanitizedListId}/${sanitizedIgdbId}/${filename}`;
};

/**
 * Generates structured path for product list/product image uploads
 * Uses unified structure: {username}/products/{productListId}/{productSlug}/{filename}
 * @param username - User's username
 * @param productListId - Unique ID of the product list
 * @param productSlug - Slug/identifier of the product (e.g. from URL)
 * @param filename - Generated filename
 * @returns Structured path for product uploads
 */
export const generateProductUploadPath = (
  username: string,
  productListId: string,
  productSlug: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedListId = sanitizeIdentifier(productListId);
  const sanitizedSlug = sanitizeIdentifier(productSlug);

  return `${sanitizedUsername}/products/${sanitizedListId}/${sanitizedSlug}/${filename}`;
};

/**
 * Generates structured path for app/tool list image uploads
 * Uses unified structure: {username}/apps/{appListId}/{appSlug}/{filename}
 * @param username - User's username
 * @param appListId - Unique ID of the app list
 * @param appSlug - Slug/identifier of the app
 * @param filename - Generated filename
 * @returns Structured path for app uploads
 */
export const generateAppUploadPath = (
  username: string,
  appListId: string,
  appSlug: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedListId = sanitizeIdentifier(appListId);
  const sanitizedSlug = sanitizeIdentifier(appSlug);

  return `${sanitizedUsername}/apps/${sanitizedListId}/${sanitizedSlug}/${filename}`;
};

/**
 * Generates structured path for person list cover image uploads
 * Uses unified structure: {username}/people/{personListId}/cover/{filename}
 * @param username - User's username
 * @param personListId - Unique ID of the person list
 * @param filename - Generated filename
 * @returns Structured path for person list cover uploads
 */
export const generatePersonListCoverPath = (
  username: string,
  personListId: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedListId = sanitizeIdentifier(personListId);

  return `${sanitizedUsername}/people/${sanitizedListId}/cover/${filename}`;
};

/**
 * Generates structured path for recommended person uploads (avatars, portfolio, etc.)
 * Uses unified structure: {username}/people/{personListId}/{personSlug}/{filename}
 * @param username - User's username
 * @param personListId - Unique ID of the person list
 * @param personSlug - Slug of the recommended person
 * @param filename - Generated filename
 * @returns Structured path for recommended person uploads
 */
export const generatePersonUploadPath = (
  username: string,
  personListId: string,
  personSlug: string,
  filename: string
): string => {
  const sanitizedUsername = sanitizeUsername(username);
  const sanitizedListId = sanitizeIdentifier(personListId);
  const sanitizedSlug = sanitizeIdentifier(personSlug);

  return `${sanitizedUsername}/people/${sanitizedListId}/${sanitizedSlug}/${filename}`;
};

/**
 * Sanitizes username for safe path usage
 * @param username - Raw username
 * @returns Sanitized username safe for file paths
 */
export const sanitizeUsername = (username: string): string => {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

/**
 * Sanitizes identifier for safe path usage
 * @param identifier - Raw identifier (place ID, recommendation ID, etc.)
 * @returns Sanitized identifier safe for file paths
 */
export const sanitizeIdentifier = (identifier: string): string => {
  return identifier
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};