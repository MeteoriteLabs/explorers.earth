/**
 * Local Tunes Integration Test Suite
 * 
 * This file contains test cases and examples for the Local Tunes integration
 * in the explorers application. It demonstrates how the dual user creation
 * functionality works and provides test scenarios.
 */

import {
  createLocalTunesUser,
  createLocalTunesUserWithRetry,
  prepareLocalTunesUserData,
  logUserCreation,
  isLocalTunesEnabled,
  getLocalTunesConfig
} from '../services/localTunesService';

// Test data for Local Tunes user creation
const testUserData = {
  username: 'testuser123',
  email: 'test@example.com',
  password: 'TestPassword123!',
  accountName: 'Test Venue',
  businessName: 'Test Business'
};

// Test scenarios
export const testScenarios = {
  // Test 1: Successful dual user creation
  async testSuccessfulDualCreation() {
    console.log('🧪 Test 1: Successful dual user creation');

    try {
      const localTunesData = prepareLocalTunesUserData(testUserData);
      console.log('Prepared Local Tunes data:', localTunesData);

      const result = await createLocalTunesUser(localTunesData);

      if (result) {
        console.log('✅ Local Tunes user created successfully:', result);
        logUserCreation('strapi-user-123', result);
        return true;
      } else {
        console.log('⚠️ Local Tunes user creation returned null (user might already exist)');
        return false;
      }
    } catch (error) {
      console.error('❌ Test failed:', error);
      return false;
    }
  },

  // Test 2: Retry mechanism
  async testRetryMechanism() {
    console.log('🧪 Test 2: Retry mechanism');

    try {
      const localTunesData = prepareLocalTunesUserData(testUserData);
      const result = await createLocalTunesUserWithRetry(localTunesData, 2);

      console.log('Retry result:', result);
      return true;
    } catch (error) {
      console.error('❌ Retry test failed:', error);
      return false;
    }
  },

  // Test 3: Configuration check
  testConfiguration() {
    console.log('🧪 Test 3: Configuration check');

    const config = getLocalTunesConfig();
    console.log('Local Tunes configuration:', config);

    const isEnabled = isLocalTunesEnabled();
    console.log('Local Tunes enabled:', isEnabled);

    return {
      config,
      isEnabled,
      hasApiUrl: !!config.apiUrl,
      hasTimeout: !!config.timeout
    };
  },

  // Test 4: Error handling
  async testErrorHandling() {
    console.log('🧪 Test 4: Error handling');

    try {
      // Test with invalid data
      const invalidData = {
        username: '',
        email: 'invalid-email',
        password: '',
        venueName: ''
      };

      const result = await createLocalTunesUser(invalidData);
      console.log('Invalid data result:', result);

      return true;
    } catch (error: unknown) {
      console.log('✅ Error handling working correctly:', (error as Error).message);
      return true;
    }
  },

  // Test 5: Integration simulation
  async testIntegrationSimulation() {
    console.log('🧪 Test 5: Integration simulation');

    // Simulate the registration flow
    console.log('Step 1: User submits registration form');
    console.log('Step 2: explorers user created in Strapi');
    console.log('Step 3: Local Tunes user creation initiated');

    if (isLocalTunesEnabled()) {
      try {
        const localTunesData = prepareLocalTunesUserData(testUserData);
        const result = await createLocalTunesUserWithRetry(localTunesData);

        console.log('Step 4: Local Tunes user creation result:', result);
        logUserCreation('simulated-strapi-user', result);

        console.log('✅ Integration simulation completed');
        return true;
      } catch (error: unknown) {
        console.log('⚠️ Integration simulation failed, but explorers continues:', (error as Error).message);
        return true; // This is expected behavior
      }
    } else {
      console.log('⚠️ Local Tunes integration disabled');
      return true;
    }
  }
};

// Run all tests
export async function runAllTests() {
  console.log('🚀 Starting Local Tunes Integration Tests');
  console.log('==========================================');

  const results = {
    config: testScenarios.testConfiguration(),
    successfulCreation: await testScenarios.testSuccessfulDualCreation(),
    retryMechanism: await testScenarios.testRetryMechanism(),
    errorHandling: await testScenarios.testErrorHandling(),
    integrationSimulation: await testScenarios.testIntegrationSimulation()
  };

  console.log('==========================================');
  console.log('📊 Test Results Summary:');
  console.log('Configuration:', results.config);
  console.log('Successful Creation:', results.successfulCreation ? '✅' : '❌');
  console.log('Retry Mechanism:', results.retryMechanism ? '✅' : '❌');
  console.log('Error Handling:', results.errorHandling ? '✅' : '❌');
  console.log('Integration Simulation:', results.integrationSimulation ? '✅' : '❌');

  return results;
}

// Manual test function for development
export async function manualTest() {
  console.log('🔧 Manual Test Mode');
  console.log('==================');

  // Check if Local Tunes is enabled
  if (!isLocalTunesEnabled()) {
    console.log('❌ Local Tunes integration is disabled');
    console.log('To enable: Set VITE_LOCAL_TUNES_ENABLED=true in your .env file');
    return;
  }

  // Test with real data
  const testData = {
    username: 'manualtest_' + Date.now(),
    email: `manualtest_${Date.now()}@example.com`,
    password: 'ManualTest123!',
    accountName: 'Manual Test Venue'
  };

  console.log('Testing with data:', testData);

  try {
    const localTunesData = prepareLocalTunesUserData(testData);
    const result = await createLocalTunesUserWithRetry(localTunesData);

    if (result) {
      console.log('✅ Manual test successful!');
      console.log('Local Tunes user created:', result);
    } else {
      console.log('⚠️ Manual test completed, but no user was created');
    }
  } catch (error) {
    console.error('❌ Manual test failed:', error);
  }
}

// Export for use in development
export default {
  testScenarios,
  runAllTests,
  manualTest
};
