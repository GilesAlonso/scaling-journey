const axios = require('axios').default;

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_TIMEOUT = 5000;

// Test colors for better output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// Test users
const testUsers = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'driver1', password: 'driver123', role: 'driver' },
  { username: 'customer1', password: 'customer123', role: 'customer' },
  { username: 'dispatcher1', password: 'dispatch123', role: 'dispatcher' },
  { username: 'support1', password: 'support123', role: 'support' }
];

/**
 * Test login functionality
 */
async function testLogin(username, password) {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      username,
      password
    }, { timeout: TEST_TIMEOUT });

    return {
      success: true,
      data: response.data,
      token: response.data.token
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
}

/**
 * Test protected endpoint
 */
async function testProtectedEndpoint(token, endpoint, requiredRole = null) {
  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      timeout: TEST_TIMEOUT
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      status: error.response?.status
    };
  }
}

/**
 * Test health endpoint
 */
async function testHealthEndpoint() {
  logInfo('Testing health endpoint...');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: TEST_TIMEOUT });
    
    if (response.status === 200 && response.data.status === 'OK') {
      logSuccess('Health endpoint working');
      return true;
    } else {
      logError('Health endpoint returned unexpected response');
      return false;
    }
  } catch (error) {
    logError(`Health endpoint failed: ${error.message}`);
    return false;
  }
}

/**
 * Test login for all users
 */
async function testAllLogins() {
  log('\n🔐 Testing Logins', 'bold');
  const results = [];

  for (const user of testUsers) {
    logInfo(`Testing login for ${user.username} (${user.role})...`);
    
    const result = await testLogin(user.username, user.password);
    
    if (result.success) {
      logSuccess(`Login successful for ${user.username}`);
      results.push({ ...user, token: result.token, loginSuccess: true });
    } else {
      logError(`Login failed for ${user.username}: ${result.error}`);
      results.push({ ...user, loginSuccess: false, error: result.error });
    }
  }

  return results;
}

/**
 * Test role-based access control
 */
async function testRoleBasedAccess(tokens) {
  log('\n🛡️  Testing Role-Based Access Control', 'bold');
  
  const tests = [
    // Admin tests
    { token: tokens.admin, endpoint: '/api/admin/test-jwt', shouldWork: true, description: 'Admin accessing admin endpoint' },
    { token: tokens.admin, endpoint: '/api/driver/test-jwt', shouldWork: true, description: 'Admin accessing driver endpoint' },
    { token: tokens.admin, endpoint: '/api/users', shouldWork: true, description: 'Admin accessing users list' },
    
    // Driver tests
    { token: tokens.driver1, endpoint: '/api/driver/test-jwt', shouldWork: true, description: 'Driver accessing driver endpoint' },
    { token: tokens.driver1, endpoint: '/api/admin/test-jwt', shouldWork: false, description: 'Driver accessing admin endpoint (should fail)' },
    { token: tokens.driver1, endpoint: '/api/users', shouldWork: false, description: 'Driver accessing users list (should fail)' },
    
    // Customer tests (should only access /api/me)
    { token: tokens.customer1, endpoint: '/api/me', shouldWork: true, description: 'Customer accessing own profile' },
    { token: tokens.customer1, endpoint: '/api/admin/test-jwt', shouldWork: false, description: 'Customer accessing admin endpoint (should fail)' },
  ];

  for (const test of tests) {
    if (!test.token) {
      logWarning(`Skipping ${test.description} - no token available`);
      continue;
    }

    logInfo(`Testing: ${test.description}`);
    
    const result = await testProtectedEndpoint(test.token, test.endpoint);
    
    const worked = result.success;
    const expectedWorked = test.shouldWork;
    
    if (worked === expectedWorked) {
      logSuccess(`${test.description} - Access ${worked ? 'granted' : 'denied'} correctly`);
    } else {
      logError(`${test.description} - Expected ${expectedWorked ? 'success' : 'failure'}, got ${worked ? 'success' : 'failure'}`);
      if (!worked && result.error) {
        logError(`Error: ${result.error}`);
      }
    }
  }
}

/**
 * Test JWT token validation
 */
async function testTokenValidation(tokens) {
  log('\n🔍 Testing JWT Token Validation', 'bold');
  
  // Test invalid token
  logInfo('Testing with invalid token...');
  const invalidResult = await testProtectedEndpoint('invalid-token', '/api/me');
  
  if (!invalidResult.success && invalidResult.status === 403) {
    logSuccess('Invalid token correctly rejected');
  } else {
    logError('Invalid token should have been rejected');
  }

  // Test missing token
  logInfo('Testing with missing token...');
  try {
    await axios.get(`${BASE_URL}/api/me`, { timeout: TEST_TIMEOUT });
    logError('Missing token should have been rejected');
  } catch (error) {
    if (error.response?.status === 401) {
      logSuccess('Missing token correctly rejected');
    } else {
      logError(`Unexpected error for missing token: ${error.response?.status}`);
    }
  }

  // Test with valid token
  if (tokens.admin) {
    logInfo('Testing with valid token...');
    const validResult = await testProtectedEndpoint(tokens.admin, '/api/me');
    
    if (validResult.success) {
      logSuccess('Valid token accepted correctly');
    } else {
      logError('Valid token should have been accepted');
    }
  }
}

/**
 * Test user profile endpoint
 */
async function testUserProfile(tokens) {
  log('\n👤 Testing User Profile Endpoints', 'bold');
  
  for (const [role, token] of Object.entries(tokens)) {
    if (!token) continue;
    
    logInfo(`Testing profile endpoint for ${role}...`);
    
    const result = await testProtectedEndpoint(token, '/api/me');
    
    if (result.success) {
      logSuccess(`Profile retrieved successfully for ${role}`);
      if (result.data.user) {
        logInfo(`User: ${result.data.user.username} (${result.data.user.role})`);
      }
    } else {
      logError(`Profile request failed for ${role}: ${result.error}`);
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  log('🚀 Starting JWT Authentication Tests', 'bold');
  log(`Target: ${BASE_URL}`);
  log(`Timeout: ${TEST_TIMEOUT}ms\n`);

  try {
    // Test health endpoint first
    const healthOk = await testHealthEndpoint();
    if (!healthOk) {
      logError('Health check failed. Make sure the server is running.');
      return;
    }

    // Test logins
    const loginResults = await testAllLogins();
    
    // Collect successful tokens
    const tokens = {};
    loginResults.forEach(result => {
      if (result.loginSuccess && result.token) {
        tokens[result.username] = result.token;
      }
    });

    // Test role-based access
    await testRoleBasedAccess(tokens);
    
    // Test token validation
    await testTokenValidation(tokens);
    
    // Test user profiles
    await testUserProfile(tokens);

    // Summary
    log('\n📊 Test Summary', 'bold');
    const successfulLogins = loginResults.filter(r => r.loginSuccess).length;
    const totalLogins = testUsers.length;
    
    log(`Successful logins: ${successfulLogins}/${totalLogins}`, successfulLogins === totalLogins ? 'green' : 'yellow');
    
    if (successfulLogins === totalLogins) {
      log('\n🎉 All tests completed! JWT authentication is working correctly.', 'green');
    } else {
      log('\n⚠️  Some tests failed. Check the logs above for details.', 'yellow');
    }

  } catch (error) {
    logError(`Test suite failed: ${error.message}`);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testLogin,
  testProtectedEndpoint,
  testHealthEndpoint,
  testAllLogins,
  testRoleBasedAccess,
  testTokenValidation,
  testUserProfile,
  runTests
};
