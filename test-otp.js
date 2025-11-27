/**
 * OTP Test Script
 * 
 * This script tests the OTP sending and verification flow
 * Run with: node test-otp.js
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';
const TEST_PHONE = '8184930950';

// Colors for console output
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

async function testSendOTP() {
  log(colors.cyan, '\n🧪 Testing OTP Send...');
  log(colors.blue, `📱 Phone: ${TEST_PHONE}`);
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, {
      phone: TEST_PHONE,
    });

    log(colors.green, '✅ OTP Sent Successfully!');
    console.log(colors.yellow + 'Response:' + colors.reset, JSON.stringify(response.data, null, 2));
    
    // Return OTP for next test
    return response.data.otp || null;
  } catch (error) {
    log(colors.red, '❌ Send OTP Failed!');
    if (error.response) {
      console.error(colors.red + 'Error Response:' + colors.reset, JSON.stringify(error.response.data, null, 2));
      console.error(colors.red + 'Status:' + colors.reset, error.response.status);
    } else if (error.request) {
      console.error(colors.red + 'No Response from Server' + colors.reset);
      console.error('Request:', error.request);
    } else {
      console.error(colors.red + 'Error:' + colors.reset, error.message);
    }
    return null;
  }
}

async function testVerifyOTP(otp) {
  if (!otp) {
    log(colors.yellow, '\n⚠️  No OTP to verify. Please check your phone for SMS or enter manually.');
    log(colors.cyan, '\nTo verify manually, run:');
    log(colors.blue, `curl -X POST ${API_BASE_URL}/auth/verify-otp -H "Content-Type: application/json" -d '{"phone":"${TEST_PHONE}","otp":"YOUR_OTP_HERE"}'`);
    return;
  }

  log(colors.cyan, '\n🧪 Testing OTP Verification...');
  log(colors.blue, `📱 Phone: ${TEST_PHONE}`);
  log(colors.blue, `🔑 OTP: ${otp}`);
  
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, {
      phone: TEST_PHONE,
      otp: otp,
    });

    log(colors.green, '✅ OTP Verified Successfully!');
    console.log(colors.yellow + 'Response:' + colors.reset, JSON.stringify(response.data, null, 2));
    
    if (response.data.token) {
      log(colors.green, '🎉 JWT Token Generated!');
      log(colors.cyan, '\n📝 You can now use this token for authenticated requests:');
      log(colors.blue, `Authorization: Bearer ${response.data.token.substring(0, 50)}...`);
    }
  } catch (error) {
    log(colors.red, '❌ Verify OTP Failed!');
    if (error.response) {
      console.error(colors.red + 'Error Response:' + colors.reset, JSON.stringify(error.response.data, null, 2));
      console.error(colors.red + 'Status:' + colors.reset, error.response.status);
    } else if (error.request) {
      console.error(colors.red + 'No Response from Server' + colors.reset);
    } else {
      console.error(colors.red + 'Error:' + colors.reset, error.message);
    }
  }
}

async function runTests() {
  log(colors.magenta, '\n╔════════════════════════════════════════╗');
  log(colors.magenta, '║     OTP AUTHENTICATION TEST SUITE     ║');
  log(colors.magenta, '╚════════════════════════════════════════╝');
  
  log(colors.cyan, '\n🚀 Starting tests...');
  log(colors.blue, `📡 API Base URL: ${API_BASE_URL}`);
  
  // Test 1: Send OTP
  const otp = await testSendOTP();
  
  if (!otp) {
    log(colors.yellow, '\n⚠️  OTP not returned in response (production mode).');
    log(colors.cyan, 'Please check:');
    log(colors.blue, '  1. Your phone for SMS');
    log(colors.blue, '  2. Backend logs for OTP (if in development mode)');
    log(colors.blue, '  3. Supabase database "otp_verifications" table');
    return;
  }
  
  // Wait a bit before verification
  log(colors.yellow, '\n⏳ Waiting 2 seconds before verification...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 2: Verify OTP
  await testVerifyOTP(otp);
  
  log(colors.magenta, '\n╔════════════════════════════════════════╗');
  log(colors.magenta, '║          TEST SUITE COMPLETE           ║');
  log(colors.magenta, '╚════════════════════════════════════════╝\n');
}

// Run the tests
runTests().catch(error => {
  log(colors.red, '\n💥 Fatal Error:');
  console.error(error);
  process.exit(1);
});

