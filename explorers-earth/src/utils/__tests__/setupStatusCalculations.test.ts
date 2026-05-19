import { describe, it, expect } from 'vitest';
import { calculateIsProfileComplete, calculateIsRecommendationsComplete, ProfileData, RecommendationList } from '../setupStatusCalculations';

describe('setupStatusCalculations', () => {

  // ── calculateIsProfileComplete ─────────────────────────────────────────────
  describe('calculateIsProfileComplete', () => {
    it('returns false for null or undefined', () => {
      expect(calculateIsProfileComplete(null)).toBe(false);
      expect(calculateIsProfileComplete(undefined)).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(calculateIsProfileComplete({})).toBe(false);
    });

    it('returns false when Account_Name is missing or empty', () => {
      const data: ProfileData = {
        Bio: 'Bio',
        profile_picture: { url: 'pic.jpg' },
        bg_picture: { url: 'bg.jpg' },
        social_media: { t: { link: 'x.com' }, f: { link: 'f.com' } }
      };
      expect(calculateIsProfileComplete(data)).toBe(false);

      data.Account_Name = '   ';
      expect(calculateIsProfileComplete(data)).toBe(false);
    });

    it('returns false when Bio is missing or empty', () => {
      const data: ProfileData = {
        Account_Name: 'Name',
        profile_picture: { url: 'pic.jpg' },
        bg_picture: { url: 'bg.jpg' },
        social_media: { t: { link: 'x.com' }, f: { link: 'f.com' } }
      };
      expect(calculateIsProfileComplete(data)).toBe(false);

      data.Bio = '   ';
      expect(calculateIsProfileComplete(data)).toBe(false);
    });

    it('returns false when profile_picture is missing or empty', () => {
      const data: ProfileData = {
        Account_Name: 'Name',
        Bio: 'Bio',
        bg_picture: { url: 'bg.jpg' },
        social_media: { t: { link: 'x.com' }, f: { link: 'f.com' } }
      };
      expect(calculateIsProfileComplete(data)).toBe(false);

      data.profile_picture = { url: '' };
      expect(calculateIsProfileComplete(data)).toBe(false);
    });

    it('returns false when bg_picture is missing or empty', () => {
      const data: ProfileData = {
        Account_Name: 'Name',
        Bio: 'Bio',
        profile_picture: { url: 'pic.jpg' },
        social_media: { t: { link: 'x.com' }, f: { link: 'f.com' } }
      };
      expect(calculateIsProfileComplete(data)).toBe(false);

      data.bg_picture = { url: '  ' };
      expect(calculateIsProfileComplete(data)).toBe(false);
    });

    it('returns false when there are less than 2 social media links', () => {
      const data: ProfileData = {
        Account_Name: 'Name',
        Bio: 'Bio',
        profile_picture: { url: 'pic.jpg' },
        bg_picture: { url: 'bg.jpg' },
        social_media: { t: { link: 'x.com' } }
      };
      expect(calculateIsProfileComplete(data)).toBe(false);
    });

    it('returns false when social links are empty strings', () => {
      const data: ProfileData = {
        Account_Name: 'Name',
        Bio: 'Bio',
        profile_picture: { url: 'pic.jpg' },
        bg_picture: { url: 'bg.jpg' },
        social_media: { t: { link: 'x.com' }, f: { link: '   ' } }
      };
      expect(calculateIsProfileComplete(data)).toBe(false);
    });

    it('returns true when all requirements are met', () => {
      const data: ProfileData = {
        Account_Name: 'Name',
        Bio: 'Bio',
        profile_picture: { url: 'pic.jpg' },
        bg_picture: { url: 'bg.jpg' },
        social_media: { 
          t: { link: 'x.com' },
          f: { link: 'f.com' },
          i: { link: 'i.com' }
        }
      };
      expect(calculateIsProfileComplete(data)).toBe(true);
    });
  });

  // ── calculateIsRecommendationsComplete ──────────────────────────────────────
  describe('calculateIsRecommendationsComplete', () => {
    it('returns false for null, undefined, or empty array', () => {
      expect(calculateIsRecommendationsComplete(null)).toBe(false);
      expect(calculateIsRecommendationsComplete(undefined)).toBe(false);
      expect(calculateIsRecommendationsComplete([])).toBe(false);
    });

    it('returns false if lists are not published', () => {
      const lists: RecommendationList[] = [
        { Visibility: false, recommended_places: [{}] },
        { recommended_places: [{}] } // Missing visibility/publishedAt
      ];
      expect(calculateIsRecommendationsComplete(lists)).toBe(false);
    });

    it('returns false if published list has no places', () => {
      const lists: RecommendationList[] = [
        { Visibility: true, recommended_places: [] },
        { publishedAt: '2023-01-01', recommended_places: undefined }
      ];
      expect(calculateIsRecommendationsComplete(lists)).toBe(false);
    });

    it('returns true if at least one list is published via Visibility and has places', () => {
      const lists: RecommendationList[] = [
        { Visibility: false, recommended_places: [{}] },
        { Visibility: true, recommended_places: [{}] }
      ];
      expect(calculateIsRecommendationsComplete(lists)).toBe(true);
    });

    it('returns true if at least one list is published via publishedAt and has places', () => {
      const lists: RecommendationList[] = [
        { publishedAt: null, recommended_places: [{}] },
        { publishedAt: '2023-01-01T00:00:00Z', recommended_places: [{}] }
      ];
      expect(calculateIsRecommendationsComplete(lists)).toBe(true);
    });
  });

});
