#!/usr/bin/env node

/**
 * Local Tunes Integration Test Script
 * 
 * This script helps test the Local Tunes integration by simulating
 * the user registration process and verifying the API connection.
 */

import axios from 'axios';

// Configuration
const LOCAL_TUNES_API_URL = process.env.VITE_LOCAL_TUNES_API_URL || 'https://localtunes.earth';
const TEST_USER_DATA = {
  username: `testuser_${Date.now()}`,
  email: `test_${Date.now()}@example.com`,
  password: 'TestPassword123!',
  venueName: 'Test Venue'
};

/**
 * Test Local Tunes API connectivity
 */
async function testApiConnectivity() {
  console.log('🔍 Testing Local Tunes API connectivity...');
  
  try {
    const response = await axios.get(`${LOCAL_TUNES_API_URL}/api/health`, {
      timeout: 5000
    });
    
    console.log('✅ Local Tunes API is accessible');
    console.log('Response:', response.data);
    return true;
  } catch (error) {
    console.log('❌ Local Tunes API is not accessible');
    console.log('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure Local Tunes is running on', LOCAL_TUNES_API_URL);
    }
    
    return false;
  }
}

/**
 * Test user registration endpoint
 */
async function testUserRegistration() {
  console.log('🧪 Testing user registration endpoint...');
  
  try {
    const response = await axios.post(`${LOCAL_TUNES_API_URL}/api/register`, TEST_USER_DATA, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('✅ User registration successful');
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.log('❌ User registration failed');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
      
      if (error.response.status === 400) {
        const errorMessage = error.response.data?.message || '';
        if (errorMessage.includes('already exists')) {
          console.log('⚠️ User already exists (this is expected for duplicate tests)');
          return null;
        }
      }
    } else {
      console.log('Error:', error.message);
    }
    
    return null;
  }
}

/**
 * Test duplicate user handling
 */
async function testDuplicateUserHandling() {
  console.log('🔄 Testing duplicate user handling...');
  
  try {
    // Try to create the same user again
    const response = await axios.post(`${LOCAL_TUNES_API_URL}/api/register`, TEST_USER_DATA, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('⚠️ Unexpected: Duplicate user was created');
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      const errorMessage = error.response.data?.message || '';
      if (errorMessage.includes('already exists')) {
        console.log('✅ Duplicate user handling works correctly');
        return true;
      }
    }
    
    console.log('❌ Unexpected error in duplicate test:', error.message);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🚀 Starting Local Tunes Integration Tests');
  console.log('==========================================');
  console.log('API URL:', LOCAL_TUNES_API_URL);
  console.log('Test User:', TEST_USER_DATA.username);
  console.log('');
  
  const results = {
    connectivity: await testApiConnectivity(),
    registration: null,
    duplicateHandling: false
  };
  
  if (results.connectivity) {
    console.log('');
    results.registration = await testUserRegistration();
    
    if (results.registration) {
      console.log('');
      results.duplicateHandling = await testDuplicateUserHandling();
    }
  }
  
  console.log('');
  console.log('==========================================');
  console.log('📊 Test Results Summary:');
  console.log('API Connectivity:', results.connectivity ? '✅' : '❌');
  console.log('User Registration:', results.registration ? '✅' : '❌');
  console.log('Duplicate Handling:', results.duplicateHandling ? '✅' : '❌');
  
  if (results.connectivity && results.registration) {
    console.log('');
    console.log('🎉 All tests passed! Local Tunes integration is ready.');
    console.log('You can now enable the integration by setting:');
    console.log('VITE_LOCAL_TUNES_ENABLED=true');
  } else {
    console.log('');
    console.log('⚠️ Some tests failed. Please check the Local Tunes setup.');
  }
  
  return results;
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export {
  testApiConnectivity,
  testUserRegistration,
  testDuplicateUserHandling,
  runTests
};
