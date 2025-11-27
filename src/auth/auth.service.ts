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
   * Verify OTP for existing users (login)
   * Returns error if user doesn't exist - they need to signup
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
        // User doesn't exist - they need to signup
        return {
          success: false,
          isNewUser: true,
          message: 'OTP verified. Please complete signup to continue.',
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
   * NEW: Uses separate tables for artists and recruiters
   */
  async signup(signupDto: SignupDto) {
    try {
      // Format phone number
      const formattedPhone = this.otpService.formatPhoneNumber(signupDto.phone);

      // Verify OTP first; if invalid, allow signup if a prior verification exists within a grace window
      const verification = await this.otpService.verifyOTP(formattedPhone, signupDto.otp);

      if (!verification.isValid) {
        const admin = this.supabaseService.getAdminClient();
        const { data: recent } = await admin
          .from('otp_verifications')
          .select('verified_at')
          .eq('phone', formattedPhone)
          .order('created_at', { ascending: false })
          .limit(1);
        const lastVerifiedAt = Array.isArray(recent) && recent.length > 0 ? recent[0]?.verified_at : null;
        const withinGrace = lastVerifiedAt && (Date.now() - new Date(lastVerifiedAt).getTime()) < 10 * 60 * 1000;
        if (!withinGrace) {
          throw new UnauthorizedException(verification.message);
        }
      }

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
        const isDataUri = /^data:image\//i.test(signupDto.profilePhoto);
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

      // Generate JWT token
      const token = this.generateToken(newUser);

      return {
        success: true,
        isNewUser: false,
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
        token: token,
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
   * Generate JWT token for user
   */
  private generateToken(user: any): string {
    const payload = {
      sub: user.id,
      phone: user.phone,
      email: user.email,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '30d',
    });
  }

  /**
   * Cleanup expired OTPs (should be called periodically)
   */
  async cleanupExpiredOtps() {
    return this.otpService.cleanupExpiredOTPs();
  }

  /**
   * Create a persistent session for user (no expiry)
   */
  async createSession(userId: string, deviceInfo?: string): Promise<{ session_id: string }> {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('sessions')
      .insert({ user_id: userId, device_info: deviceInfo, valid: true })
      .select()
      .single();
    if (error || !data) {
      this.logger.error('Failed to create session', error);
      throw new BadRequestException('Could not create session');
    }
    return { session_id: data.id };
  }

  /**
   * Invalidate an existing session
   */
  async invalidateSession(sessionId: string): Promise<{ success: boolean }> {
    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('sessions')
      .update({ valid: false })
      .eq('id', sessionId);
    if (error) {
      this.logger.error('Failed to invalidate session', error);
      throw new BadRequestException('Could not invalidate session');
    }
    return { success: true };
  }

  /**
   * Validate session and return user + profile
   */
  async validateSession(sessionId: string) {
    const admin = this.supabaseService.getAdminClient();
    const { data: session, error: sErr } = await admin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('valid', true)
      .maybeSingle();
    if (sErr || !session) {
      throw new UnauthorizedException('Session invalid');
    }
    const { data: user, error } = await admin
      .from('users')
      .select('*, profiles(*)')
      .eq('id', session.user_id)
      .maybeSingle();
    if (error || !user) {
      throw new UnauthorizedException('User not found');
    }
    let profile: any = Array.isArray(user.profiles) ? user.profiles[0] : user.profiles || null;
    if (profile?.id && profile.role === 'artist') {
      const { data: artistProfile } = await admin
        .from('artist_profiles')
        .select('profile_pic')
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (artistProfile?.profile_pic) {
        profile.profile_pic = artistProfile.profile_pic;
      }
    } else if (profile?.id && profile.role === 'recruiter') {
      const { data: recruiterProfile } = await admin
        .from('recruiter_profiles')
        .select('profile_pic')
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (recruiterProfile?.profile_pic) {
        profile.profile_pic = recruiterProfile.profile_pic;
      }
    }
    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
      },
      profile,
    };
  }

  /**
   * Login via OTP: verify, then create session and return session_id + role
   */
  async loginWithOtp(phone: string, otp: string, deviceInfo?: string) {
    // Allow session login immediately after a prior successful verify
    const formattedPhone = this.otpService.formatPhoneNumber(phone);
    const confirm = await this.otpService.verifyOrConfirmOTP(formattedPhone, otp);
    if (!confirm.isValid) {
      throw new UnauthorizedException(confirm.message || 'Invalid or expired OTP');
    }
    // Ensure TypeScript knows user is present
    // Lookup user by phone
    const supabase = this.supabaseService.getAdminClient();
    const { data: user } = await supabase
      .from('users')
      .select('*, profiles(*)')
      .eq('phone', formattedPhone)
      .maybeSingle();
    if (!user || !user.id) {
      throw new UnauthorizedException('User not found after OTP verification');
    }
    const session = await this.createSession(user.id, deviceInfo);
    return {
      session_id: session.session_id,
      role: user.role,
      user,
    };
  }
}

