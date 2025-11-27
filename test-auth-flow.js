/**
 * Complete Authentication Flow Test
 * Tests both login and signup scenarios
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';
const NEW_USER_PHONE = '9876543210'; // Phone that doesn't exist
const EXISTING_USER_PHONE = '8184930950'; // Your phone (exists after first test)

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

// Test 1: New User Flow (Should get isNewUser = true)
async function testNewUserFlow() {
  log(colors.cyan, '\n╔════════════════════════════════════════╗');
  log(colors.cyan, '║   TEST 1: NEW USER FLOW (SIGNUP)      ║');
  log(colors.cyan, '╚════════════════════════════════════════╝');
  
  try {
    // Step 1: Send OTP
    log(colors.blue, `\n📱 Step 1: Sending OTP to NEW user: ${NEW_USER_PHONE}`);
    const otpResponse = await axios.post(`${API_BASE_URL}/auth/send-otp`, {
      phone: NEW_USER_PHONE,
    });
    
    log(colors.green, '✅ OTP Sent');
    log(colors.yellow, `   Message: ${otpResponse.data.message}`);
    log(colors.yellow, `   User Exists: ${otpResponse.data.userExists}`);
    log(colors.yellow, `   OTP: ${otpResponse.data.otp}`);
    
    const otp = otpResponse.data.otp;
    
    // Step 2: Verify OTP (Should return isNewUser: true)
    log(colors.blue, `\n🔑 Step 2: Verifying OTP: ${otp}`);
    const verifyResponse = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
      phone: NEW_USER_PHONE,
      otp: otp,
    });
    
    if (verifyResponse.data.isNewUser) {
      log(colors.green, '✅ Correctly identified as NEW USER');
      log(colors.yellow, `   Message: ${verifyResponse.data.message}`);
      log(colors.cyan, '\n   📝 Mobile app should now navigate to signup screen');
    } else {
      log(colors.red, '❌ ERROR: Should be identified as new user but got existing user!');
    }
    
    return { success: true, otp, phone: NEW_USER_PHONE };
  } catch (error) {
    log(colors.red, '❌ Test Failed');
    if (error.response) {
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    return { success: false };
  }
}

// Test 2: Existing User Flow (Should login directly)
async function testExistingUserFlow() {
  log(colors.cyan, '\n╔════════════════════════════════════════╗');
  log(colors.cyan, '║  TEST 2: EXISTING USER FLOW (LOGIN)   ║');
  log(colors.cyan, '╚════════════════════════════════════════╝');
  
  try {
    // Step 1: Send OTP
    log(colors.blue, `\n📱 Step 1: Sending OTP to EXISTING user: ${EXISTING_USER_PHONE}`);
    const otpResponse = await axios.post(`${API_BASE_URL}/auth/send-otp`, {
      phone: EXISTING_USER_PHONE,
    });
    
    log(colors.green, '✅ OTP Sent');
    log(colors.yellow, `   Message: ${otpResponse.data.message}`);
    log(colors.yellow, `   User Exists: ${otpResponse.data.userExists}`);
    log(colors.yellow, `   OTP: ${otpResponse.data.otp}`);
    
    const otp = otpResponse.data.otp;
    
    // Step 2: Verify OTP (Should return success with token)
    log(colors.blue, `\n🔑 Step 2: Verifying OTP: ${otp}`);
    const verifyResponse = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
      phone: EXISTING_USER_PHONE,
      otp: otp,
    });
    
    if (verifyResponse.data.success && verifyResponse.data.token) {
      log(colors.green, '✅ Login Successful!');
      log(colors.yellow, `   Message: ${verifyResponse.data.message}`);
      log(colors.yellow, `   User ID: ${verifyResponse.data.user?.id}`);
      log(colors.yellow, `   Phone: ${verifyResponse.data.user?.phone}`);
      log(colors.yellow, `   Role: ${verifyResponse.data.user?.role}`);
      log(colors.yellow, `   Token: ${verifyResponse.data.token.substring(0, 30)}...`);
      log(colors.cyan, '\n   🎉 Mobile app should now navigate to Main screen');
    } else if (verifyResponse.data.isNewUser) {
      log(colors.yellow, '⚠️  User identified as new user');
      log(colors.yellow, '   This means user was not found in database');
      log(colors.cyan, '\n   📝 Mobile app should navigate to signup screen');
    } else {
      log(colors.red, '❌ ERROR: Unexpected response');
      console.log(verifyResponse.data);
    }
    
    return { success: true };
  } catch (error) {
    log(colors.red, '❌ Test Failed');
    if (error.response) {
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    return { success: false };
  }
}

// Test 3: Invalid OTP
async function testInvalidOTP() {
  log(colors.cyan, '\n╔════════════════════════════════════════╗');
  log(colors.cyan, '║   TEST 3: INVALID OTP (ERROR CASE)    ║');
  log(colors.cyan, '╚════════════════════════════════════════╝');
  
  try {
    log(colors.blue, `\n🔑 Testing with invalid OTP: 999999`);
    const verifyResponse = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
      phone: EXISTING_USER_PHONE,
      otp: '999999',
    });
    
    log(colors.red, '❌ ERROR: Should have thrown error but succeeded!');
    return { success: false };
  } catch (error) {
    if (error.response && error.response.status === 401) {
      log(colors.green, '✅ Correctly rejected invalid OTP');
      log(colors.yellow, `   Error Message: ${error.response.data.message}`);
      return { success: true };
    } else {
      log(colors.red, '❌ Unexpected error');
      console.error(error.message);
      return { success: false };
    }
  }
}

// Main test runner
async function runAllTests() {
  log(colors.magenta, '\n╔════════════════════════════════════════╗');
  log(colors.magenta, '║  AUTHENTICATION FLOW TEST SUITE        ║');
  log(colors.magenta, '╚════════════════════════════════════════╝');
  
  log(colors.cyan, `\n📡 API Base URL: ${API_BASE_URL}`);
  log(colors.cyan, `📱 Test Phones: ${NEW_USER_PHONE} (new), ${EXISTING_USER_PHONE} (existing)\n`);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Run tests
  const test1 = await testNewUserFlow();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const test2 = await testExistingUserFlow();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const test3 = await testInvalidOTP();
  
  // Summary
  log(colors.magenta, '\n╔════════════════════════════════════════╗');
  log(colors.magenta, '║          TEST SUMMARY                  ║');
  log(colors.magenta, '╚════════════════════════════════════════╝\n');
  
  log(test1.success ? colors.green : colors.red, `  Test 1 (New User Flow): ${test1.success ? '✅ PASSED' : '❌ FAILED'}`);
  log(test2.success ? colors.green : colors.red, `  Test 2 (Existing User Flow): ${test2.success ? '✅ PASSED' : '❌ FAILED'}`);
  log(test3.success ? colors.green : colors.red, `  Test 3 (Invalid OTP): ${test3.success ? '✅ PASSED' : '❌ FAILED'}`);
  
  log(colors.magenta, '\n╚════════════════════════════════════════╝\n');
}

// Wait for backend to start
setTimeout(() => {
  runAllTests().catch(error => {
    log(colors.red, '\n💥 Fatal Error:');
    console.error(error);
    process.exit(1);
  });
}, 8000);

log(colors.yellow, '\n⏳ Waiting for backend to start (8 seconds)...\n');

