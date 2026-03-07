/**
 * Neon User Hook
 * Fetches complete user data from Neon DB after Strapi authentication
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export interface NeonUser {
  id: number;
  username: string;
  email: string | null;
  venueName: string;
  guestUrl: string;
  theme: { primary: string };
  allowSongRequests: boolean;
  allowGuestPlayOnDevice: boolean;
  allowPlaylistSharing: boolean;
  allowRecentlyPlayedVisibility: boolean;
  isEmailVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export function useNeonUser() {
  const { user: strapiUser, isAuthenticated } = useAuthStore();
  const [neonUser, setNeonUser] = useState<NeonUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!strapiUser || !isAuthenticated) {
      setLoading(false);
      setNeonUser(null);
      return;
    }

    console.log('🔍 Fetching Neon DB user data for:', strapiUser.username);

    fetch(`/api/auth/user-data?username=${strapiUser.username}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to fetch user data');
        }
        return res.json();
      })
      .then((data) => {
        if (data.success && data.user) {
          console.log('✅ Neon DB user data loaded:', data.user.username);
          setNeonUser(data.user);
          setError(null);
        } else {
          throw new Error('User data not found');
        }
      })
      .catch((err) => {
        console.error('❌ Error fetching Neon DB user data:', err);
        setError(err);
        setNeonUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [strapiUser, isAuthenticated]);

  return { user: neonUser, loading, error, isAuthenticated };
}
