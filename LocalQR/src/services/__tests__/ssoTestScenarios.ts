/**
 * SSO Test Script for LocalTunes Integration
 * 
 * This script tests the Single Sign-On functionality between explorers and LocalTunes.
 * Run this script in the browser console to test different scenarios.
 */

import { performLocalTunesSSO, clearLocalTunesSSO, checkLocalTunesSSOStatus } from '../services/ssoService';
import { debugCookies } from '../utils/cookieUtils';
import { debugSessionStorage } from '../utils/sessionCredentials';

// Mock Apollo client for testing
const mockApolloClient = {
  query: async ({ query, variables }: any) => {
    console.log('Mock GraphQL query:', { query, variables });

    // Mock response for getUserAccountQuery
    if (query.definitions?.[0]?.name?.value === 'UsersPermissionsUser') {
      return {
        data: {
          usersPermissionsUser: {
            username: 'testuser',
            accounts: [{
              username: 'testuser',
              documentId: variables.documentId,
              localtunes_integrated: 'Yes', // Change to 'No' to test disabled integration
            }]
          }
        }
      };
    }

    return { data: null };
  }
};

// Test scenarios
export const ssoTestScenarios = {
  // Test 1: User with LocalTunes integration enabled
  async testEnabledIntegration() {
    console.log('🧪 Test 1: User with LocalTunes integration enabled');

    // Mock session credentials
    sessionStorage.setItem('explorers_user_credentials', JSON.stringify({
      username: 'testuser',
      email: 'test@example.com',
      password: 'testpassword',
      timestamp: Date.now()
    }));

    const result = await performLocalTunesSSO(mockApolloClient, 'test-document-id');
    console.log('SSO Result:', result);

    return result;
  },

  // Test 2: User with LocalTunes integration disabled
  async testDisabledIntegration() {
    console.log('🧪 Test 2: User with LocalTunes integration disabled');

    // Mock Apollo client to return disabled integration
    const disabledApolloClient = {
      query: async ({ query: _query, variables }: any) => {
        return {
          data: {
            usersPermissionsUser: {
              username: 'testuser',
              accounts: [{
                username: 'testuser',
                documentId: variables.documentId,
                localtunes_integrated: 'No', // Disabled integration
              }]
            }
          }
        };
      }
    };

    const result = await performLocalTunesSSO(disabledApolloClient, 'test-document-id');
    console.log('SSO Result:', result);

    return result;
  },

  // Test 3: User without credentials
  async testNoCredentials() {
    console.log('🧪 Test 3: User without credentials');

    // Clear session storage
    sessionStorage.removeItem('explorers_user_credentials');

    const result = await performLocalTunesSSO(mockApolloClient, 'test-document-id');
    console.log('SSO Result:', result);

    return result;
  },

  // Test 4: Check SSO status
  async testSSOStatus() {
    console.log('🧪 Test 4: Check SSO status');

    const result = await checkLocalTunesSSOStatus();
    console.log('SSO Status:', result);

    return result;
  },

  // Test 5: Clear SSO session
  async testClearSSO() {
    console.log('🧪 Test 5: Clear SSO session');

    const result = await clearLocalTunesSSO();
    console.log('Clear SSO Result:', result);

    return result;
  },

  // Test 6: Debug all SSO components
  async testDebugAll() {
    console.log('🧪 Test 6: Debug all SSO components');

    console.log('=== Session Storage Debug ===');
    debugSessionStorage();

    console.log('=== Cookie Debug ===');
    debugCookies();

    console.log('=== SSO Status ===');
    await this.testSSOStatus();
  },

  // Run all tests
  async runAllTests() {
    console.log('🚀 Running all SSO tests...');

    try {
      await this.testEnabledIntegration();
      await this.testDisabledIntegration();
      await this.testNoCredentials();
      await this.testSSOStatus();
      await this.testClearSSO();
      await this.testDebugAll();

      console.log('✅ All tests completed');
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }
};

// Export for browser console usage
if (typeof window !== 'undefined') {
  (window as any).ssoTestScenarios = ssoTestScenarios;
  console.log('🔧 SSO test scenarios loaded. Use ssoTestScenarios.runAllTests() to run all tests.');
}

export default ssoTestScenarios;
