import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { PhotoService } from '../photo/photo.service';
import { OtpService } from './services/otp.service';
import { SignupDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly photoService: PhotoService,
    private readonly otpService: OtpService,
    private readonly jwtService: JwtService,
  ) { }

  /**
   * Send OTP to phone number
   * Checks if user exists and returns that information
   */
  async sendOtp(phone: string) {
    this.logger.log(`📱 sendOtp called for phone: ${phone}`);
    try {
      const result = await this.otpService.sendOTP(phone);
      this.logger.log(`✅ OTP sent successfully to ${phone}, userExists: ${result.userExists}`);
      return result;
    } catch (error: any) {
      this.logger.error(`❌ Send OTP error for ${phone}:`, error);
      throw new BadRequestException(error?.message || 'Failed to send OTP');
    }
  }

  /**
   * Verify OTP for existing users (login) or new users (signup)
   * For existing users: Returns access_token for authenticated requests
   * For new users: Returns access_token to be used for signup endpoint
   */
  async verifyOtp(phone: string, otp: string) {
    this.logger.log(`🔐 verifyOtp called for phone: ${phone}`);
    try {
      // Format phone number
      const formattedPhone = this.otpService.formatPhoneNumber(phone);
      this.logger.log(`📞 Formatted phone: ${formattedPhone}`);

      // Verify OTP
      this.logger.log(`🔄 Verifying OTP...`);
      const verification = await this.otpService.verifyOTP(formattedPhone, otp);

      if (!verification.isValid) {
        this.logger.warn(`⚠️  Invalid OTP for phone: ${formattedPhone}`);
        throw new UnauthorizedException(verification.message);
      }

      this.logger.log(`✅ OTP verified successfully`);

      // Check if user exists
      this.logger.log(`🔍 Checking if user exists in database...`);
      const supabase = this.supabaseService.getAdminClient();
      const { data: user, error } = await supabase
        .from('users')
        .select('*, profiles(*)')
        .eq('phone', formattedPhone)
        .maybeSingle();

      if (error || !user) {
        this.logger.log(`ℹ️  User not found - needs signup`);
        // User doesn't exist - generate a signup token with phone number
        const signupToken = this.generateSignupToken(formattedPhone);
        this.logger.log(`🎫 Signup token generated for new user`);

        return {
          success: true,
          isNewUser: true,
          message: 'OTP verified. Please complete signup using the provided access_token.',
          access_token: signupToken,
        };
      }

      this.logger.log(`👤 User found: ID=${user.id}, email=${user.email}`);

      // Handle profiles - could be array, object, or null
      let profile = user.profiles;
      if (Array.isArray(profile)) {
        profile = profile.length > 0 ? profile[0] : null;
      }

      if (profile) {
        this.logger.log(`📋 Profile loaded: role=${profile.role}, name=${profile.first_name} ${profile.last_name}`);
      }

      // Generate JWT token
      const token = this.generateToken(user);
      this.logger.log(`🎫 JWT token generated`);

      this.logger.log(`✅ Login successful for user: ${user.id}`);
      return {
        success: true,
        isNewUser: false,
        message: 'Login successful',
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          role: profile?.role,
          firstName: profile?.first_name,
          lastName: profile?.last_name,
        },
        profile: profile,
        access_token: token,
      };
    } catch (error: any) {
      this.logger.error(`❌ Verify OTP error:`, error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(error?.message || 'Failed to verify OTP');
    }
  }

  /**
   * Complete user signup with all details
   * Requires a valid signup token (obtained from verify-otp for new users)
   * The phone number is extracted from the token, not from request body
   */
  async signup(signupDto: SignupDto, signupToken: string) {
    try {
      // Verify signup token
      const tokenPayload = this.verifySignupToken(signupToken);
      if (!tokenPayload || !tokenPayload.phone) {
        throw new UnauthorizedException('Invalid or expired signup token. Please verify OTP again.');
      }

      const formattedPhone = tokenPayload.phone;
      this.logger.log(`📱 Signup initiated for phone: ${formattedPhone}`);

      // Check if user already exists
      const supabase = this.supabaseService.getAdminClient();
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', formattedPhone)
        .maybeSingle();

      if (existingUser) {
        throw new BadRequestException('User already exists. Please login instead.');
      }

      // Create user
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          phone: formattedPhone,
          email: signupDto.email,
        })
        .select()
        .single();

      if (userError || !newUser) {
        this.logger.error('Error creating user:', userError);
        throw new BadRequestException('Failed to create user account');
      }

      // Upload or accept profile picture URL if provided (NEW USERS ONLY)
      let profilePicUrl: string | null = null;
      if (signupDto.profilePhoto) {
        const isUrl = /^https?:\/\//i.test(signupDto.profilePhoto);
        try {
          if (isUrl) {
            profilePicUrl = signupDto.profilePhoto;
          } else {
            this.logger.log('📸 Uploading profile picture to Storage...');
            // Use appropriate method based on role
            if (signupDto.role === 'artist') {
              profilePicUrl = await this.photoService.uploadArtistProfilePicFromBase64(
                signupDto.profilePhoto,
                newUser.id,
              );
            } else if (signupDto.role === 'recruiter') {
              profilePicUrl = await this.photoService.uploadRecruiterProfilePicFromBase64(
                signupDto.profilePhoto,
                newUser.id,
              );
            }
            this.logger.log(`✅ Profile picture uploaded: ${profilePicUrl}`);
          }
        } catch (e) {
          this.logger.warn('Failed to process profile picture, proceeding without image:', e);
          profilePicUrl = null;
        }
      }

      // Create base profile
      const { data: baseProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: newUser.id,
          role: signupDto.role,
          first_name: signupDto.firstName,
          last_name: signupDto.lastName,
          // Optional legacy field retained for base profile display
          profile_photo_url: profilePicUrl,
        })
        .select()
        .single();

      if (profileError || !baseProfile) {
        this.logger.error('Error creating base profile:', profileError);
        await supabase.from('users').delete().eq('id', newUser.id);
        throw new BadRequestException('Failed to create user profile');
      }

      // Create role-specific profile
      if (signupDto.role === 'artist') {
        const { error: artistProfileError } = await supabase
          .from('artist_profiles')
          .insert({
            profile_id: baseProfile.id,
            email: signupDto.email,
            phone: formattedPhone,
            alt_phone: signupDto.alternativePhone,
            maa_associative_number: signupDto.maaAssociativeNumber,
            gender: signupDto.gender,
            department: signupDto.department,
            state: signupDto.state,
            city: signupDto.city,
            aadhar_number: signupDto.aadharNumber,
            bio: signupDto.bio,
            // Store Supabase Storage URL (new users only)
            profile_pic: profilePicUrl,
          });

        if (artistProfileError) {
          this.logger.error('Error creating artist profile:', artistProfileError);
          await supabase.from('profiles').delete().eq('id', baseProfile.id);
          await supabase.from('users').delete().eq('id', newUser.id);
          throw new BadRequestException('Failed to create artist profile');
        }
      } else if (signupDto.role === 'recruiter') {
        const { data: recruiterProfile, error: recruiterProfileError } = await supabase
          .from('recruiter_profiles')
          .insert({
            profile_id: baseProfile.id,
            email: signupDto.email,
            phone: formattedPhone,
            alt_phone: signupDto.alternativePhone,
            maa_associative_number: signupDto.maaAssociativeNumber,
            gender: signupDto.gender,
            department: signupDto.department,
            state: signupDto.state,
            city: signupDto.city,
            aadhar_number: signupDto.aadharNumber,
            bio: signupDto.bio,
            // Store Supabase Storage URL (new users only)
            profile_pic: profilePicUrl,
          })
          .select()
          .single();

        if (recruiterProfileError || !recruiterProfile) {
          this.logger.error('Error creating recruiter profile:', recruiterProfileError);
          await supabase.from('profiles').delete().eq('id', baseProfile.id);
          await supabase.from('users').delete().eq('id', newUser.id);
          throw new BadRequestException('Failed to create recruiter profile');
        }

        // Create company if provided
        if (signupDto.companyName) {
          const { error: companyError } = await supabase
            .from('recruiter_companies')
            .insert({
              recruiter_profile_id: recruiterProfile.id,
              name: signupDto.companyName,
              phone: signupDto.companyPhone,
              email: signupDto.companyEmail,
              logo_url: signupDto.companyLogo,
              website: signupDto.website,
            });

          if (companyError) {
            this.logger.error('Error creating company:', companyError);
          }
        }
      }

      // Create social links if provided
      const socialLinks: Array<{ platform: string; url: string; is_custom?: boolean }> = [];
      if (signupDto.website) socialLinks.push({ platform: 'website', url: signupDto.website });
      if (signupDto.facebook) socialLinks.push({ platform: 'facebook', url: signupDto.facebook });
      if (signupDto.twitter) socialLinks.push({ platform: 'twitter', url: signupDto.twitter });
      if (signupDto.instagram) socialLinks.push({ platform: 'instagram', url: signupDto.instagram });
      if (signupDto.youtube) socialLinks.push({ platform: 'youtube', url: signupDto.youtube });

      // Add custom links
      if (signupDto.customLinks && signupDto.customLinks.length > 0) {
        signupDto.customLinks.forEach((url, index) => {
          if (url) {
            socialLinks.push({ platform: `custom_${index + 1}`, url, is_custom: true });
          }
        });
      }

      if (socialLinks.length > 0) {
        const linksToInsert = socialLinks.map((link, index) => ({
          profile_id: baseProfile.id,
          platform: link.platform,
          url: link.url,
          is_custom: link.is_custom || false,
          order_index: index,
        }));

        await supabase.from('profile_social_links').insert(linksToInsert);
      }

      // Generate JWT access token for the new user
      const accessToken = this.generateToken(newUser);

      return {
        success: true,
        message: 'Signup successful',
        user: {
          id: newUser.id,
          phone: newUser.phone,
          email: newUser.email,
          role: baseProfile.role,
          firstName: baseProfile.first_name,
          lastName: baseProfile.last_name,
        },
        profile: baseProfile,
        access_token: accessToken,
      };
    } catch (error: any) {
      this.logger.error('Signup error:', error);
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error?.message || 'Failed to complete signup');
    }
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string) {
    try {
      this.logger.log(`Getting profile for user ID: ${userId}`);
      const supabase = this.supabaseService.getAdminClient();

      // Query user first
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        this.logger.error('User not found:', userError);
        throw new UnauthorizedException('User not found');
      }

      // Query profile separately
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId);

      const profile = profiles && profiles.length > 0 ? profiles[0] : null;

      if (profile?.id && profile.role === 'artist') {
        const { data: artistProfile } = await supabase
          .from('artist_profiles')
          .select('profile_pic')
          .eq('profile_id', profile.id)
          .maybeSingle();
        if (artistProfile?.profile_pic) {
          profile.profile_pic = artistProfile.profile_pic;
        }
      } else if (profile?.id && profile.role === 'recruiter') {
        const { data: recruiterProfile } = await supabase
          .from('recruiter_profiles')
          .select('profile_pic')
          .eq('profile_id', profile.id)
          .maybeSingle();
        if (recruiterProfile?.profile_pic) {
          profile.profile_pic = recruiterProfile.profile_pic;
        }
      }

      // Query social links
      const { data: socialLinks } = await supabase
        .from('profile_social_links')
        .select('*')
        .eq('profile_id', profile?.id);

      this.logger.log(`Profile found: ${!!profile}, Role: ${profile?.role}`);

      return {
        success: true,
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
        },
        profile: profile,
        socialLinks: socialLinks || [],
      };
    } catch (error) {
      this.logger.error('Get profile error:', error);
      throw new UnauthorizedException('Failed to get user profile');
    }
  }

  /**
   * Generate JWT token for authenticated user
   */
  private generateToken(user: any): string {
    const payload = {
      sub: user.id,
      phone: user.phone,
      email: user.email,
      type: 'access',
    };

    return this.jwtService.sign(payload, {
      expiresIn: '30d',
    });
  }

  /**
   * Generate JWT token for signup (new users who verified OTP)
   * This token contains only the phone number and is valid for 10 minutes
   */
  private generateSignupToken(phone: string): string {
    const payload = {
      phone: phone,
      type: 'signup',
    };

    return this.jwtService.sign(payload, {
      expiresIn: '10m',
    });
  }

  /**
   * Verify and decode signup token
   */
  verifySignupToken(token: string): { phone: string; type: string } | null {
    try {
      const payload = this.jwtService.verify(token);
      if (payload.type !== 'signup') {
        return null;
      }
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cleanup expired OTPs (should be called periodically)
   */
  async cleanupExpiredOtps() {
    return this.otpService.cleanupExpiredOTPs();
  }
}

