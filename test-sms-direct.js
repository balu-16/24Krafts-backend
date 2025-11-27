/**
 * Direct SMS Test - Using exact code from otp.js
 * This will test if the SMS gateway is working
 */

// SMS configuration - exactly matching otp.js
const SMS_CONFIG = {
  secret: 'xledocqmXkNPrTesuqWr',
  sender: 'NIGHAI',
  tempid: '1207174264191607433',
  route: 'TA',
  msgtype: '1',
  baseUrl: 'http://43.252.88.250/index.php/smsapi/httpapi/'
};

const TEST_PHONE = '8184930950';
const TEST_OTP = '123456';

async function sendTestSms() {
  console.log('📱 Testing Direct SMS Send...');
  console.log(`📞 Phone: ${TEST_PHONE}`);
  console.log(`🔑 OTP: ${TEST_OTP}`);
  console.log('');

  try {
    // Format the SMS message exactly like otp.js
    const message = `Welcome to NighaTech Global Your OTP for authentication is ${TEST_OTP} don't share with anybody Thank you`;
    
    // Prepare SMS API parameters exactly like otp.js
    const params = new URLSearchParams({
      secret: SMS_CONFIG.secret,
      sender: SMS_CONFIG.sender,
      tempid: SMS_CONFIG.tempid,
      receiver: TEST_PHONE,
      route: SMS_CONFIG.route,
      msgtype: SMS_CONFIG.msgtype,
      sms: message
    });

    const smsUrl = `${SMS_CONFIG.baseUrl}?${params.toString()}`;
    console.log('🌐 SMS URL:');
    console.log(smsUrl);
    console.log('');

    // Send SMS
    const response = await fetch(smsUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Node.js SMS Test/1.0'
      }
    });

    const responseText = await response.text();
    
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📄 Response Body: ${responseText}`);
    console.log('');

    if (response.status === 200) {
      console.log('✅ SMS API call successful!');
      console.log('📱 Please check your phone for the SMS');
    } else {
      console.log('❌ SMS API call failed');
      console.log('Check the response above for error details');
    }
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

// Run the test
sendTestSms();

