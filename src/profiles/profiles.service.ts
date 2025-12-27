import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UpdateProfileDto, ListProfilesQuery, BecomeRecruiterDto, UpgradePremiumDto } from './dto/profile.dto';
import { encodeCursor, decodeCursor, PaginatedResponse } from '../utils/cursor.util';

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async listProfiles(query: ListProfilesQuery): Promise<PaginatedResponse<any>> {
    const { cursor, limit = 20, role } = query;
    const supabase = this.supabaseService.getAdminClient();

    let queryBuilder = supabase
      .from('profiles')
      .select('*, users!inner(phone, email)')
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    // Apply role filter if provided
    if (role) {
      queryBuilder = queryBuilder.eq('role', role);
    }

    // Apply cursor if provided
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        queryBuilder = queryBuilder.lt('created_at', decoded.timestamp);
      }
    }

    const { data, error } = await queryBuilder;

    if (error) {
      throw new BadRequestException(`Failed to fetch profiles: ${error.message}`);
    }

    const hasMore = data.length > limit;
    const profiles = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore
      ? encodeCursor(data[limit - 1].created_at, data[limit - 1].id)
      : null;

    return {
      data: profiles,
      nextCursor,
    };
  }

  async getProfileById(id: string) {
    this.logger.log(`🔍 getProfileById called with ID: ${id}`);
    const supabase = this.supabaseService.getAdminClient();

    this.logger.log(`🔄 Querying profile with joins...`);
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        users!inner(phone, email),
        profile_social_links(*),
        artist_profiles(*),
        recruiter_profiles(*),
        recruiter_companies:recruiter_profiles(recruiter_companies(*))
      `)
      .eq('id', id)
      .single();

    if (error) {
      this.logger.error(`❌ Error fetching profile: ${error.message}`, error);
      throw new NotFoundException('Profile not found');
    }

    if (!data) {
      this.logger.warn(`⚠️  No data returned for profile ID: ${id}`);
      throw new NotFoundException('Profile not found');
    }

    this.logger.log(`✅ Successfully fetched profile: ${data.first_name} ${data.last_name}, role: ${data.role}`);
    return data;
  }

  async updateProfile(id: string, updateData: UpdateProfileDto) {
    const supabase = this.supabaseService.getAdminClient();

    try {
      this.logger.log(`📝 updateProfile called for ID: ${id}`);
      this.logger.log(`📋 Update data received: ${JSON.stringify(updateData)}`);

      // Get current profile to determine role
      this.logger.log(`🔍 Fetching current profile to determine role...`);
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', id)
        .single();

      if (fetchError || !profile) {
        this.logger.error(`❌ Profile not found: ${fetchError?.message}`, fetchError);
        throw new NotFoundException('Profile not found');
      }

      this.logger.log(`📊 Profile role: ${profile.role}`);

      // Fields that belong to the profiles table
      const profileFields = ['first_name', 'last_name', 'profile_photo_url'];
      const profileUpdate: any = {};
      
      // Fields that belong to artist_profiles or recruiter_profiles
      const roleSpecificFields = ['email', 'phone', 'alt_phone', 'maa_associative_number', 'gender', 'department', 'state', 'city', 'bio'];
      const roleSpecificUpdate: any = {};

      // Separate fields based on which table they belong to
      this.logger.log(`🔄 Separating fields by table...`);
      Object.keys(updateData).forEach(key => {
        const value = (updateData as any)[key];
        if (profileFields.includes(key)) {
          profileUpdate[key] = value;
        } else if (roleSpecificFields.includes(key)) {
          roleSpecificUpdate[key] = value;
        }
      });

      this.logger.log(`📊 Profile table fields: ${Object.keys(profileUpdate).join(', ') || 'none'}`);
      this.logger.log(`📊 Role-specific fields: ${Object.keys(roleSpecificUpdate).join(', ') || 'none'}`);

      // Update profiles table if there are fields to update
      if (Object.keys(profileUpdate).length > 0) {
        this.logger.log(`💾 Updating profiles table with: ${JSON.stringify(profileUpdate)}`);
        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdate)
          .eq('id', id);

        if (profileError) {
          this.logger.error(`❌ Profile update error: ${profileError.message}`, profileError);
          throw new BadRequestException(`Failed to update profile: ${profileError.message}`);
        }
        this.logger.log(`✅ Profiles table updated successfully`);
      }

      // Update role-specific table if there are fields to update
      if (Object.keys(roleSpecificUpdate).length > 0) {
        const tableName = profile.role === 'artist' ? 'artist_profiles' : 'recruiter_profiles';
        
        this.logger.log(`💾 Updating ${tableName} table with: ${JSON.stringify(roleSpecificUpdate)}`);
        
        const { error: roleError } = await supabase
          .from(tableName)
          .update(roleSpecificUpdate)
          .eq('profile_id', id);

        if (roleError) {
          this.logger.error(`❌ ${tableName} update error: ${roleError.message}`, roleError);
          throw new BadRequestException(`Failed to update ${tableName}: ${roleError.message}`);
        }
        this.logger.log(`✅ ${tableName} table updated successfully`);
      }

      // Fetch and return the updated profile
      this.logger.log(`🔄 Fetching updated profile data...`);
      const { data: updatedProfile, error: selectError } = await supabase
        .from('profiles')
        .select()
        .eq('id', id)
        .single();

      if (selectError) {
        this.logger.error(`❌ Error fetching updated profile: ${selectError.message}`, selectError);
        throw new BadRequestException('Profile updated but failed to fetch updated data');
      }

      this.logger.log(`✅ Profile update completed successfully for ID: ${id}`);
      return updatedProfile;
    } catch (error) {
      this.logger.error('Update profile exception:', error);
      throw error;
    }
  }

  async becomeRecruiter(profileId: string, becomeRecruiterDto: BecomeRecruiterDto) {
    const supabase = this.supabaseService.getAdminClient();

    try {
      // Get profile to verify it exists and get user_id
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('user_id, role')
        .eq('id', profileId)
        .single();

      if (fetchError || !profile) {
        throw new NotFoundException('Profile not found');
      }

      // Check if already a recruiter
      if (profile.role === 'recruiter') {
        throw new BadRequestException('User is already a recruiter');
      }

      // Update profile role to recruiter
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'recruiter' })
        .eq('id', profileId);

      if (profileError) {
        this.logger.error('Failed to update profile role:', profileError);
        throw new BadRequestException('Failed to update role');
      }

      // Create recruiter profile first
      const { data: recruiterProfile, error: recruiterProfileError } = await supabase
        .from('recruiter_profiles')
        .insert({
          profile_id: profileId,
        })
        .select()
        .single();

      if (recruiterProfileError || !recruiterProfile) {
        this.logger.error('Failed to create recruiter profile:', recruiterProfileError);
        // Rollback profile update
        await supabase
          .from('profiles')
          .update({ role: 'artist' })
          .eq('id', profileId);
        throw new BadRequestException('Failed to create recruiter profile');
      }

      // Create company record
      const { data: company, error: companyError } = await supabase
        .from('recruiter_companies')
        .insert({
          recruiter_profile_id: recruiterProfile.id,
          name: becomeRecruiterDto.companyName,
          phone: becomeRecruiterDto.companyPhone,
          email: becomeRecruiterDto.companyEmail,
          logo_url: becomeRecruiterDto.companyLogo,
        })
        .select()
        .single();

      if (companyError) {
        this.logger.error('Failed to create company:', companyError);
        // Rollback profile update
        await supabase
          .from('profiles')
          .update({ role: 'artist' })
          .eq('id', profileId);
        throw new BadRequestException('Failed to create company');
      }

      this.logger.log(`Profile ${profileId} successfully became recruiter`);

      return {
        success: true,
        message: 'Successfully became a recruiter',
        company,
      };
    } catch (error) {
      this.logger.error('Become recruiter error:', error);
      throw error;
    }
  }

  async upgradePremium(profileId: string, upgradePremiumDto: UpgradePremiumDto) {
    const supabase = this.supabaseService.getAdminClient();

    try {
      // Verify profile exists
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('id, premium_until')
        .eq('id', profileId)
        .single();

      if (fetchError || !profile) {
        throw new NotFoundException('Profile not found');
      }

      // Calculate premium expiration based on plan
      const now = new Date();
      const currentExpiry = profile.premium_until ? new Date(profile.premium_until) : now;
      const startDate = currentExpiry > now ? currentExpiry : now;

      let premiumUntil: Date;
      if (upgradePremiumDto.planType === 'monthly') {
        premiumUntil = new Date(startDate);
        premiumUntil.setMonth(premiumUntil.getMonth() + 1);
      } else if (upgradePremiumDto.planType === 'yearly') {
        premiumUntil = new Date(startDate);
        premiumUntil.setFullYear(premiumUntil.getFullYear() + 1);
      } else {
        throw new BadRequestException('Invalid plan type. Must be "monthly" or "yearly"');
      }

      // Update profile with premium status
      const { data, error } = await supabase
        .from('profiles')
        .update({
          is_premium: true,
          premium_until: premiumUntil.toISOString(),
        })
        .eq('id', profileId)
        .select()
        .single();

      if (error) {
        this.logger.error('Failed to upgrade premium:', error);
        throw new BadRequestException('Failed to upgrade to premium');
      }

      // TODO: Here you would typically create a payment record
      // and integrate with payment gateway

      this.logger.log(`Profile ${profileId} upgraded to premium (${upgradePremiumDto.planType})`);

      return {
        success: true,
        message: 'Successfully upgraded to premium',
        premiumUntil: premiumUntil.toISOString(),
        planType: upgradePremiumDto.planType,
      };
    } catch (error) {
      this.logger.error('Upgrade premium error:', error);
      throw error;
    }
  }
}

