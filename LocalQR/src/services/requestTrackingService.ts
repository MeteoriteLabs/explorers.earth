/**
 * Request Tracking Service
 * Tracks song requests and AI guide requests by incrementing counts in Strapi's Song_limit collection
 */

import { getSongLimits, updateSongLimit, createSongLimit } from './subscriptionService';

/**
 * Increment song request count for a user
 * @param username - The username to track requests for
 */
export const trackSongRequest = async (username: string): Promise<void> => {
    try {
        console.log('[Tracking] Incrementing song request for user:', username);

        // Get existing song limits for user
        const songLimits = await getSongLimits(username);

        if (songLimits && songLimits.length > 0) {
            // User record exists - increment song_requests
            const existingLimit = songLimits[0];
            await updateSongLimit(existingLimit.documentId, {
                song_requests: existingLimit.song_requests + 1,
            });
            console.log('[Tracking] Song request incremented:', existingLimit.song_requests + 1);
        } else {
            // User record doesn't exist - create new record
            await createSongLimit({
                username,
                song_requests: 1,
                ai_guide_requests: 0,
            });
            console.log('[Tracking] New song limit record created for user:', username);
        }
    } catch (error) {
        // Don't throw error - tracking failures shouldn't break the main functionality
        console.error('[Tracking] Failed to track song request:', error);
    }
};

/**
 * Increment AI guide request count for a user
 * @param username - The username to track requests for
 */
export const trackAIGuideRequest = async (username: string): Promise<void> => {
    try {
        console.log('[Tracking] Incrementing AI guide request for user:', username);

        // Get existing song limits for user
        const songLimits = await getSongLimits(username);

        if (songLimits && songLimits.length > 0) {
            // User record exists - increment ai_guide_requests
            const existingLimit = songLimits[0];
            await updateSongLimit(existingLimit.documentId, {
                ai_guide_requests: existingLimit.ai_guide_requests + 1,
            });
            console.log('[Tracking] AI guide request incremented:', existingLimit.ai_guide_requests + 1);
        } else {
            // User record doesn't exist - create new record
            await createSongLimit({
                username,
                song_requests: 0,
                ai_guide_requests: 1,
            });
            console.log('[Tracking] New song limit record created for user:', username);
        }
    } catch (error) {
        // Don't throw error - tracking failures shouldn't break the main functionality
        console.error('[Tracking] Failed to track AI guide request:', error);
    }
};
