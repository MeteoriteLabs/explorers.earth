/**
 * Cross-Domain SSO Test Script
 * 
 * This script tests the cross-domain SSO functionality between explorers and LocalTunes.
 * Run this in the browser console to test the implementation.
 */

// Test cross-domain SSO functionality
export const crossDomainSSOTest = {

  // Test 1: Check if cross-domain auth data is stored
  testCrossDomainStorage() {
    console.log('🧪 Test 1: Checking cross-domain storage...');

    const authData = localStorage.getItem('localtunes_cross_domain_auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      console.log('✅ Cross-domain auth data found:', {
        auth_token: parsed.auth_token?.substring(0, 20) + '...',
        auth_user: parsed.auth_user,
        timestamp: new Date(parsed.timestamp).toISOString(),
        expiresAt: new Date(parsed.expiresAt).toISOString(),
        domain: parsed.domain
      });
      return true;
    } else {
      console.log('❌ No cross-domain auth data found');
      return false;
    }
  },

  // Test 2: Simulate LocalTunes SSO callback
  testSSOCallback() {
    console.log('🧪 Test 2: Testing SSO callback simulation...');

    // Create a mock iframe to test the callback
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://localtunes.earth/sso-callback';

    // Listen for messages
    const messageHandler = (event: MessageEvent) => {
      console.log('📨 Received message:', event.data);

      if (event.data.type === 'LOCALTUNES_SSO_READY') {
        console.log('✅ SSO callback ready');

        // Send test auth data
        iframe.contentWindow?.postMessage({
          type: 'LOCALTUNES_SSO_AUTH',
          authData: {
            auth_token: 'test_token_123',
            auth_user: 'testuser'
          },
          timestamp: Date.now()
        }, 'https://localtunes.earth');
      }

      if (event.data.type === 'LOCALTUNES_SSO_COMPLETE') {
        console.log('✅ SSO callback complete:', event.data.success);

        // Cleanup
        window.removeEventListener('message', messageHandler);
        document.body.removeChild(iframe);
      }
    };

    window.addEventListener('message', messageHandler);
    document.body.appendChild(iframe);

    // Cleanup after 10 seconds
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 10000);
  },

  // Test 3: Check LocalTunes localStorage (if accessible)
  testLocalTunesStorage() {
    console.log('🧪 Test 3: Checking LocalTunes localStorage...');

    // This will only work if we're on the same origin
    try {
      const authToken = localStorage.getItem('auth_token');
      const authUser = localStorage.getItem('auth_user');
      const ssoTimestamp = localStorage.getItem('sso_timestamp');

      if (authToken && authUser) {
        console.log('✅ LocalTunes auth data found:', {
          auth_token: authToken.substring(0, 20) + '...',
          auth_user: authUser,
          sso_timestamp: ssoTimestamp ? new Date(parseInt(ssoTimestamp)).toISOString() : 'Not set'
        });
        return true;
      } else {
        console.log('❌ No LocalTunes auth data found');
        return false;
      }
    } catch (error: unknown) {
      console.log('⚠️ Cannot access LocalTunes localStorage (cross-origin):', (error as Error).message);
      return false;
    }
  },

  // Test 4: Simulate SSO authentication flow
  async testSSOFlow() {
    console.log('🧪 Test 4: Simulating complete SSO flow...');

    // Step 1: Store cross-domain auth data
    const testAuthData = {
      auth_token: 'test_sso_token_' + Date.now(),
      auth_user: 'testuser',
      timestamp: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      domain: 'https://localtunes.earth'
    };

    localStorage.setItem('localtunes_cross_domain_auth', JSON.stringify(testAuthData));
    sessionStorage.setItem('localtunes_cross_domain_auth', JSON.stringify(testAuthData));

    console.log('✅ Step 1: Cross-domain auth data stored');

    // Step 2: Test iframe communication
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://localtunes.earth/sso-callback';

    return new Promise((resolve) => {
      const messageHandler = (event: MessageEvent) => {
        if (event.data.type === 'LOCALTUNES_SSO_READY') {
          console.log('✅ Step 2: SSO callback ready');

          // Send auth data
          iframe.contentWindow?.postMessage({
            type: 'LOCALTUNES_SSO_AUTH',
            authData: {
              auth_token: testAuthData.auth_token,
              auth_user: testAuthData.auth_user
            },
            timestamp: testAuthData.timestamp
          }, 'https://localtunes.earth');
        }

        if (event.data.type === 'LOCALTUNES_SSO_COMPLETE') {
          console.log('✅ Step 3: SSO flow complete:', event.data.success);

          // Cleanup
          window.removeEventListener('message', messageHandler);
          document.body.removeChild(iframe);

          resolve(event.data.success);
        }
      };

      window.addEventListener('message', messageHandler);
      document.body.appendChild(iframe);

      // Timeout after 15 seconds
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        resolve(false);
      }, 15000);
    });
  },

  // Test 5: Clear all SSO data
  clearSSOData() {
    console.log('🧪 Test 5: Clearing all SSO data...');

    // Clear explorers SSO data
    localStorage.removeItem('localtunes_cross_domain_auth');
    sessionStorage.removeItem('localtunes_cross_domain_auth');

    // Clear LocalTunes SSO data (if accessible)
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('sso_timestamp');
    } catch (error) {
      console.log('⚠️ Cannot clear LocalTunes data (cross-origin)');
    }

    console.log('✅ All SSO data cleared');
  },

  // Run all tests
  async runAllTests() {
    console.log('🚀 Running all cross-domain SSO tests...');

    try {
      const test1 = this.testCrossDomainStorage();
      this.testSSOCallback();
      const test3 = this.testLocalTunesStorage();
      const test4 = await this.testSSOFlow();

      console.log('📊 Test Results:');
      console.log('- Cross-domain storage:', test1 ? '✅ PASS' : '❌ FAIL');
      console.log('- SSO callback:', '✅ TESTED');
      console.log('- LocalTunes storage:', test3 ? '✅ PASS' : '❌ FAIL');
      console.log('- Complete SSO flow:', test4 ? '✅ PASS' : '❌ FAIL');

      console.log('✅ All tests completed');
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }
};

// Export for browser console usage
if (typeof window !== 'undefined') {
  (window as any).crossDomainSSOTest = crossDomainSSOTest;
  console.log('🔧 Cross-domain SSO test loaded. Use crossDomainSSOTest.runAllTests() to run all tests.');
}

export default crossDomainSSOTest;
