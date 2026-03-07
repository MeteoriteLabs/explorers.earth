import axios from 'axios';
import useAuthStore from '../store/store';

const API_BASE_URL = import.meta.env.VITE_INSTAGRAM_API_URL || 'http://localhost:5000';

export interface InstagramPostData {
    username: string;
    authorUrl: string;
    thumbnailUrl: string;
    media?: Array<{ type: 'image' | 'video', url: string, width?: number, height?: number }>;
    location?: string;
    caption: string;
    postUrl: string;
    shortcode: string | null;
    embedHtml: string;
}

export interface InstagramProfileData {
    username: string;
    fullName: string;
    bio: string;
    profilePicture: string;
    postsCount: number | string;
    followersCount: number | string;
    followingCount: number | string;
    profileUrl: string;
    isPublic: boolean;
}

export interface MediaItem {
    type: 'image' | 'video';
    url: string;
    width?: number;
    height?: number;
}

export interface AccountPost {
    shortcode: string;
    type: 'post' | 'reel';
    isCarousel: boolean;
    thumbnailUrl: string;
    altText: string;
    postUrl: string;
    caption: string;
    location: string;
    media: MediaItem[];
    mediaCount: number;
}

export interface AccountPostsData {
    username: string;
    fullName: string;
    profilePicture: string;
    postsCount: number | string;
    followersCount: number | string;
    followingCount: number | string;
    posts: AccountPost[];
    totalScraped: number;
    totalMedia: number;
    scrapedAt: string;
}

export interface ExtractResponse {
    success: boolean;
    data: InstagramPostData;
}

export interface ProfileResponse {
    success: boolean;
    data: InstagramProfileData;
}

export interface AccountPostsResponse {
    success: boolean;
    data: AccountPostsData;
}

class InstagramService {
    private getAuthHeaders() {
        const { token } = useAuthStore.getState();
        return {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Extract Instagram post data from a public URL
     * @param postUrl - Instagram post URL (e.g., https://instagram.com/p/ABC123...)
     */
    async extractPost(postUrl: string): Promise<InstagramPostData> {
        const response = await axios.post<ExtractResponse>(
            `${API_BASE_URL}/api/instagram/extract`,
            { postUrl },
            { headers: this.getAuthHeaders() }
        );
        return response.data.data;
    }

    /**
     * Extract Instagram profile data from username or profile URL
     * @param input - Username (e.g., "username") or profile URL (e.g., https://instagram.com/username/)
     */
    async extractProfile(input: string): Promise<InstagramProfileData> {
        // Check if input is a URL or just username
        const isUrl = input.includes('instagram.com');

        const response = await axios.post<ProfileResponse>(
            `${API_BASE_URL}/api/instagram/profile`,
            isUrl ? { profileUrl: input } : { username: input },
            { headers: this.getAuthHeaders() }
        );
        return response.data.data;
    }

    /**
     * Scrape all posts and reels from a public Instagram account
     * @param input - Username (e.g., "username") or profile URL (e.g., https://instagram.com/username/)
     * @param maxScrolls - Max scroll iterations (each loads ~12 posts). Default 20.
     */
    async extractAccountPosts(input: string, maxScrolls: number = 20): Promise<AccountPostsData> {
        const isUrl = input.includes('instagram.com');

        const response = await axios.post<AccountPostsResponse>(
            `${API_BASE_URL}/api/instagram/account-posts`,
            {
                ...(isUrl ? { profileUrl: input } : { username: input }),
                maxScrolls
            },
            { headers: this.getAuthHeaders(), timeout: 300000 } // 5 min timeout — scrapes each post individually
        );
        return response.data.data;
    }
}

export const instagramService = new InstagramService();
