
/**
 * Shared utility for calculating set up completion status
 */

export interface ProfileData {
    Account_Name?: string;
    Bio?: string;
    profile_picture?: { url?: string };
    bg_picture?: { url?: string };
    social_media?: any;
}

export interface RecommendationList {
    Visibility?: boolean;
    publishedAt?: string | null;
    recommended_places?: any[];
}

/**
 * Calculates if the profile set up is complete based on requirements:
 * 1. Account Name
 * 2. Bio
 * 3. Profile Picture
 * 4. Background Picture
 * 5. At least 2 Social Media Links
 */
export const calculateIsProfileComplete = (account: ProfileData | null | undefined): boolean => {
    if (!account) return false;

    const hasAccountName = account.Account_Name && account.Account_Name.trim() !== "";
    const hasBio = account.Bio && account.Bio.trim() !== "";
    const hasProfilePicture = account.profile_picture?.url && account.profile_picture.url.trim() !== "";
    const hasBackgroundPicture = account.bg_picture?.url && account.bg_picture.url.trim() !== "";

    const socialMedia = account.social_media || {};
    const socialLinksCount = Object.values(socialMedia).filter((platform: any) =>
        platform?.link && typeof platform.link === 'string' && platform.link.trim() !== ""
    ).length;
    const hasAtLeastTwoSocialLinks = socialLinksCount >= 2;

    return Boolean(hasAccountName && hasBio && hasProfilePicture && hasBackgroundPicture && hasAtLeastTwoSocialLinks);
};

/**
 * Calculates if the recommendations setup is complete:
 * 1. At least one published list with at least one place
 */
export const calculateIsRecommendationsComplete = (lists: RecommendationList[] | null | undefined): boolean => {
    if (!lists || lists.length === 0) return false;

    return lists.some((list) => {
        // Visibility === true means published in Favorites.tsx
        // publishedAt !== null means published in Home.tsx (dashboardStatusData)
        const isPublished = list.Visibility === true || (list.publishedAt !== null && list.publishedAt !== undefined);
        const hasPlaces = Array.isArray(list.recommended_places) && list.recommended_places.length > 0;
        return isPublished && hasPlaces;
    });
};
