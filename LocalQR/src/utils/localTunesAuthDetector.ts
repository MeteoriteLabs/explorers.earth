/**
 * LocalTunes Authentication Format Detector
 * 
 * This script helps us understand what format LocalTunes actually uses
 * for storing authentication data in localStorage.
 */

// Function to detect LocalTunes authentication format
export function detectLocalTunesAuthFormat() {
  console.log('🔍 Detecting LocalTunes authentication format...');

  // Check what's currently in localStorage
  const allKeys = Object.keys(localStorage);
  console.log('📦 All localStorage keys:', allKeys);

  // Look for authentication-related keys
  const authKeys = allKeys.filter(key =>
    key.toLowerCase().includes('auth') ||
    key.toLowerCase().includes('token') ||
    key.toLowerCase().includes('user') ||
    key.toLowerCase().includes('session')
  );

  console.log('🔑 Authentication-related keys:', authKeys);

  // Analyze each auth key
  authKeys.forEach(key => {
    const value = localStorage.getItem(key);
    console.log(`📋 ${key}:`, value);

    // Try to parse as JSON
    try {
      const parsed = JSON.parse(value || '');
      console.log(`📦 ${key} (parsed):`, parsed);
    } catch (e) {
      console.log(`⚠️ ${key} is not JSON`);
    }
  });

  // Check cookies too
  const cookies = document.cookie.split(';');
  console.log('🍪 All cookies:', cookies);

  return {
    localStorageKeys: allKeys,
    authKeys: authKeys,
    cookies: cookies
  };
}

// Function to test what happens when we set different formats
export function testLocalTunesAuthFormats() {
  console.log('🧪 Testing different LocalTunes auth formats...');

  // Test format 1: What we think LocalTunes uses
  const format1 = {
    auth_token: { "value": "test-token-123", "expires": Date.now() + 86400000 },
    auth_user: { "id": 16, "username": "testuser", "email": "test@example.com" }
  };

  // Test format 2: What explorers uses for LocalTunes
  const format2 = {
    csrfToken: "csrf-token-123",
    sessionId: "session-id-123",
    timestamp: Date.now(),
    expiresAt: Date.now() + 86400000
  };

  // Test format 3: Simple format
  const format3 = {
    token: "simple-token-123",
    user: { "id": 16, "username": "testuser" }
  };

  console.log('📋 Format 1 (assumed LocalTunes):', format1);
  console.log('📋 Format 2 (explorers LocalTunes):', format2);
  console.log('📋 Format 3 (simple):', format3);

  return { format1, format2, format3 };
}

// Function to manually set test data in LocalTunes localStorage
export function setTestAuthDataInLocalTunes() {
  console.log('🧪 Setting test auth data in LocalTunes localStorage...');

  // Create test data in the format from your screenshots
  const testAuthToken = {
    value: "78df7bd7-cb21-4f78-a32f-c2f894fea8ff",
    expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  };

  const testUserData = {
    id: 16,
    username: "localtunes",
    email: "localtunes@gmail.com",
    otp: null,
    otpExpiry: null,
    accountManagerId: null,
    allowGuestPlayOnDevice: true,
    allowPlaylistSharing: true,
    allowRecentlyPlayedVisibility: true,
    allowSongRequests: true,
    emailVerificationExpiry: "2025-10-25T16:47:27.428Z",
    emailVerificationToken: "ec296b9693ca8720f76cfb58f97841bb5ae442a1913cca592858049810a85af7",
    guestUrl: "a02ea50669d00d3e50cfa7aed99d746a",
    isEmailVerified: false,
    theme: { primary: "#6E56CF" },
    venueName: "localtunes"
  };

  // Try to set this data in LocalTunes localStorage via iframe
  setTestDataInLocalTunes(testAuthToken, testUserData);

  return { testAuthToken, testUserData };
}

// Function to set test data in LocalTunes localStorage via iframe
function setTestDataInLocalTunes(authToken: any, userData: any) {
  try {
    console.log('🧪 Attempting to set test data in LocalTunes localStorage...');

    // Create a hidden iframe to set localStorage for localtunes.earth
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://localtunes.earth/sso-callback';

    // Listen for response from LocalTunes
    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== 'https://localtunes.earth') {
        return;
      }

      if (event.data.type === 'LOCALTUNES_SSO_READY') {
        console.log('✅ LocalTunes SSO callback ready');

        // Send test auth data to LocalTunes
        iframe.contentWindow?.postMessage({
          type: 'LOCALTUNES_SSO_AUTH',
          authData: {
            auth_token: authToken,
            auth_user: userData
          },
          timestamp: Date.now()
        }, 'https://localtunes.earth');

        // Clean up
        window.removeEventListener('message', messageHandler);
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    };

    window.addEventListener('message', messageHandler);
    document.body.appendChild(iframe);

    // Cleanup after timeout
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 10000);

  } catch (error) {
    console.log('⚠️ Could not set test data in LocalTunes localStorage:', error);
  }
}

// Export for browser console usage
if (typeof window !== 'undefined') {
  (window as any).detectLocalTunesAuthFormat = detectLocalTunesAuthFormat;
  (window as any).testLocalTunesAuthFormats = testLocalTunesAuthFormats;
  (window as any).setTestAuthDataInLocalTunes = setTestAuthDataInLocalTunes;

  console.log('🔧 LocalTunes auth format detection functions loaded:');
  console.log('- detectLocalTunesAuthFormat() - Check current localStorage format');
  console.log('- testLocalTunesAuthFormats() - Test different formats');
  console.log('- setTestAuthDataInLocalTunes() - Set test data in LocalTunes');
}

export default {
  detectLocalTunesAuthFormat,
  testLocalTunesAuthFormats,
  setTestAuthDataInLocalTunes
};
