/**
 * Google OAuth Callback Page
 * Handles Google OAuth callback and token exchange
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

const VITE_REST_API_URL = import.meta.env.VITE_REST_API_URL || 'https://api.explorers.earth';

export default function GoogleCallbackPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get access_token from URL query params
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access_token');

        if (!accessToken) {
          throw new Error('No access token found in URL');
        }

        console.log('Exchanging Google access token for JWT...');

        // Exchange access token for JWT
        const response = await fetch(
          `${VITE_REST_API_URL}/auth/google/callback?access_token=${accessToken}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to exchange token');
        }

        const data = await response.json();

        if (!data.jwt || !data.user) {
          throw new Error('Invalid response from server');
        }

        // Store credentials if needed (optional)
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(
            'explorers_user_credentials',
            JSON.stringify({
              username: data.user.username,
              email: data.user.email,
              password: 'google_auth_user',
              timestamp: Date.now(),
              expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
            })
          );
        }

        // Login with the received JWT
        login({
          token: data.jwt,
          id: data.user.id,
          documentId: data.user.documentId,
          username: data.user.username,
          email: data.user.email,
          blocked: data.user.blocked || false,
        });

        console.log('Google login successful:', data.user.username);

        // Redirect to dashboard
        setLocation('/dashboard');
      } catch (err) {
        console.error('Google OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');

        // Redirect to login page after 3 seconds
        setTimeout(() => {
          setLocation('/auth');
        }, 3000);
      }
    };

    handleCallback();
  }, [login, setLocation]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-red-500 text-lg font-semibold">Authentication Failed</div>
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Completing Google sign-in...</p>
      </div>
    </div>
  );
}
