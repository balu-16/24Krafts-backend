import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';
import { getOTPExpirationIST, getCurrentISTForComparison, getCurrentIST } from '../../utils/time.utils';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * Get SMS configuration from environment variables
   * All values must be configured in environment - no hardcoded defaults
   */
  private getSmsConfig() {
    const secret = this.configService.get<string>('SMS_SECRET');
    const sender = this.configService.get<string>('SMS_SENDER');
    const tempid = this.configService.get<string>('SMS_TEMPID');
    const route = this.configService.get<string>('SMS_ROUTE');
    const msgtype = this.configService.get<string>('SMS_MSGTYPE');
    const baseUrl = this.configService.get<string>('SMS_BASE_URL');

    if (!secret || !sender || !tempid || !baseUrl) {
      throw new Error(
        'SMS configuration incomplete. Required env vars: SMS_SECRET, SMS_SENDER, SMS_TEMPID, SMS_BASE_URL',
      );
    }

    return {
      secret,
      sender,
      tempid,
      route: route || 'TA',
      msgtype: msgtype || '1',
      baseUrl,
    };
  }

  /**
   * Generate a 6-digit OTP
   */
  generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Validate Indian phone number format
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    const cleanNumber = phoneNumber.replace(/[\s\-\+]/g, '');
    // Accept either 10 digits starting with 6-9, or 12 digits starting with 91
    const indianMobileRegex = /^([6-9]\d{9}|91[6-9]\d{9})$/;
    return indianMobileRegex.test(cleanNumber);
  }

  /**
   * Format phone number to consistent format (10 digits, no country code)
   */
  formatPhoneNumber(phoneNumber: string): string {
    // Remove all spaces, dashes, and special characters
    let cleanNumber = phoneNumber.replace(/[\s\-\+]/g, '');

    // If starts with 91 (country code), remove it
    if (cleanNumber.startsWith('91') && cleanNumber.length === 12) {
      cleanNumber = cleanNumber.substring(2);
    }

    // Return clean 10-digit number
    return cleanNumber;
  }

  /**
   * Store OTP in Supabase database
   */
  async storeOTP(phoneNumber: string, otp: string): Promise<any> {
    try {
      const supabase = this.supabaseService.getAdminClient();
      const expiresAt = getOTPExpirationIST();

      // Invalidate any existing unverified OTPs for this phone by expiring them immediately
      await supabase
        .from('otp_verifications')
        .update({ expires_at: getCurrentIST() })
        .eq('phone', phoneNumber)
        .is('verified_at', null);

      // Create new OTP record
      const { data, error } = await supabase
        .from('otp_verifications')
        .insert({
          phone: phoneNumber,
          otp: otp,
          created_at: getCurrentIST(),
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) {
        this.logger.error('Error storing OTP:', error);
        throw new Error(`Failed to store OTP: ${error.message}`);
      }

      this.logger.log(`✅ OTP stored successfully for ${phoneNumber}`);
      return data;
    } catch (error) {
      this.logger.error('Store OTP error:', error);
      throw error;
    }
  }

  /**
   * Verify OTP from Supabase database
   */
  async verifyOTP(phoneNumber: string, otp: string): Promise<{
    isValid: boolean;
    message: string;
    otpRecord?: any;
  }> {
    try {
      const supabase = this.supabaseService.getAdminClient();

      const { data: otpRecord, error } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', phoneNumber)
        .eq('otp', otp)
        .is('verified_at', null)
        .gt('expires_at', getCurrentISTForComparison())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !otpRecord) {
        this.logger.log(`❌ Invalid or expired OTP for ${phoneNumber}`);
        return { isValid: false, message: 'Invalid or expired OTP' };
      }

      // Mark OTP as verified
      const { error: updateError } = await supabase
        .from('otp_verifications')
        .update({ verified_at: getCurrentIST() })
        .eq('id', otpRecord.id);

      if (updateError) {
        this.logger.error('Error updating OTP status:', updateError);
        throw new Error(`Failed to update OTP status: ${updateError.message}`);
      }

      this.logger.log(`✅ OTP verified successfully for ${phoneNumber}`);
      return {
        isValid: true,
        message: 'OTP verified successfully',
        otpRecord,
      };
    } catch (error) {
      this.logger.error('Verify OTP error:', error);
      throw error;
    }
  }

  /**
   * Verify OTP OR accept already-verified OTP within validity window
   * Useful for flows that call verify first, then session login immediately
   */
  async verifyOrConfirmOTP(phoneNumber: string, otp: string): Promise<{
    isValid: boolean;
    message: string;
    otpRecord?: any;
  }> {
    try {
      const supabase = this.supabaseService.getAdminClient();

      const { data: otpRecord, error } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('phone', phoneNumber)
        .eq('otp', otp)
        .gt('expires_at', getCurrentISTForComparison())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !otpRecord) {
        this.logger.log(`❌ Invalid or expired OTP (confirm) for ${phoneNumber}`);
        return { isValid: false, message: 'Invalid or expired OTP' };
      }

      // If not yet verified, mark it verified
      if (!otpRecord.verified_at) {
        const { error: updateError } = await supabase
          .from('otp_verifications')
          .update({ verified_at: getCurrentIST() })
          .eq('id', otpRecord.id);

        if (updateError) {
          this.logger.error('Error updating OTP status (confirm):', updateError);
          throw new Error(`Failed to update OTP status: ${updateError.message}`);
        }
        this.logger.log(`✅ OTP confirmed and marked verified for ${phoneNumber}`);
      } else {
        this.logger.log(`ℹ️  OTP already verified for ${phoneNumber}`);
      }

      return {
        isValid: true,
        message: 'OTP verified successfully',
        otpRecord,
      };
    } catch (error) {
      this.logger.error('Verify or confirm OTP error:', error);
      throw error;
    }
  }

  /**
   * Send OTP via SMS
   */
  async sendOtpSms(phoneNumber: string, otp: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      this.logger.log(`📱 Sending OTP SMS to ${phoneNumber}`);

      // Get SMS configuration
      const smsConfig = this.getSmsConfig();

      // Format the SMS message - exactly matching the working version
      const message = `Welcome to NighaTech Global Your OTP for authentication is ${otp} don't share with anybody Thank you`;

      // Prepare SMS API parameters
      const params = new URLSearchParams({
        secret: smsConfig.secret || '',
        sender: smsConfig.sender,
        tempid: smsConfig.tempid,
        receiver: phoneNumber,
        route: smsConfig.route,
        msgtype: smsConfig.msgtype,
        sms: message,
      });

      const smsUrl = `${smsConfig.baseUrl}?${params.toString()}`;
      this.logger.debug(`📱 SMS URL: ${smsUrl}`);

      // Send SMS using fetch
      const response = await fetch(smsUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'NestJS SMS Service/1.0',
        },
      });

      const responseText = await response.text();
      this.logger.log(`📱 SMS API Response Status: ${response.status}`);
      this.logger.log(`📱 SMS API Response: ${responseText}`);

      if (response.status === 200) {
        this.logger.log(`✅ SMS sent successfully to ${phoneNumber}`);
        return {
          success: true,
          message: `SMS sent successfully to ${phoneNumber}`,
        };
      } else {
        this.logger.warn(`❌ SMS failed for ${phoneNumber}`);
        return {
          success: false,
          error: `SMS API returned status ${response.status}: ${responseText}`,
        };
      }
    } catch (error: any) {
      this.logger.error('📱 SMS Service Error:', error);
      return {
        success: false,
        error: `Failed to send SMS: ${error?.message || 'Unknown error'}`,
      };
    }
  }

  /**
   * Complete OTP flow: generate, store, and send
   */
  async sendOTP(phoneNumber: string): Promise<{
    success: boolean;
    message: string;
    phoneNumber: string;
    otp?: string;
    userExists?: boolean;
  }> {
    try {
      this.logger.log(`📱 Starting OTP process for ${phoneNumber}`);

      // Format and validate phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);

      if (!this.validatePhoneNumber(formattedPhone)) {
        throw new Error(
          'Invalid phone number format. Must be a valid 10-digit Indian mobile number starting with 6-9',
        );
      }

      // Check if user exists
      const supabase = this.supabaseService.getAdminClient();
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, phone')
        .eq('phone', formattedPhone)
        .maybeSingle();

      const userExists = !!existingUser;

      // Generate OTP
      const otp = this.generateOTP();
      // OTP generated (not logged for security)

      // Store OTP in database
      await this.storeOTP(formattedPhone, otp);

      // Send OTP via SMS
      const smsResult = await this.sendOtpSms(formattedPhone, otp);

      return {
        success: true,
        message: userExists
          ? 'OTP sent successfully for login'
          : 'OTP sent successfully. Please complete signup',
        phoneNumber: formattedPhone,
        userExists,
        // For development - remove in production
        otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      };
    } catch (error) {
      this.logger.error('Send OTP error:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired OTPs
   */
  async cleanupExpiredOTPs(): Promise<{ success: boolean; message: string }> {
    try {
      const supabase = this.supabaseService.getAdminClient();

      const { error } = await supabase
        .from('otp_verifications')
        .delete()
        .lt('expires_at', getCurrentISTForComparison());

      if (error) {
        throw new Error(`Failed to cleanup OTPs: ${error.message}`);
      }

      this.logger.log('✅ Expired OTPs cleaned up successfully');
      return {
        success: true,
        message: 'Expired OTPs cleaned up successfully',
      };
    } catch (error) {
      this.logger.error('Cleanup OTPs error:', error);
      throw error;
    }
  }
}

