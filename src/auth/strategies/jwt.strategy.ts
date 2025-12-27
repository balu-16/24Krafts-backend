import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    this.logger.log(`🔐 JWT validate called - payload.sub: ${payload?.sub}`);
    
    if (!payload || !payload.sub) {
      this.logger.warn(`⚠️  Invalid token payload`);
      throw new UnauthorizedException('Invalid token payload');
    }

    try {
      // payload.sub contains the user ID from the users table
      // Fetch user and profile from Supabase
      this.logger.log(`🔍 Fetching user from database: ${payload.sub}`);
      const supabase = this.supabaseService.getAdminClient();
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, phone, email')
        .eq('id', payload.sub)
        .single();

      if (userError || !user) {
        this.logger.error(`❌ User not found: ${payload.sub}`, userError);
        throw new UnauthorizedException('User not found');
      }

      this.logger.log(`✅ User found: ${user.email}`);

      // Fetch associated profile
      this.logger.log(`🔍 Fetching profile for user: ${user.id}`);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, user_id, role, first_name, last_name')
        .eq('user_id', user.id);

      const profile = profiles && profiles.length > 0 ? profiles[0] : null;

      if (!profile) {
        this.logger.error(`❌ Profile not found for user: ${user.id}`);
        throw new UnauthorizedException('User profile not found');
      }

      this.logger.log(`✅ Profile found: ${profile.id}, role: ${profile.role}`);

      // Return user data that will be attached to request.user
      return {
        id: user.id,
        profileId: profile.id,
        userId: profile.user_id,
        role: profile.role,
        email: user.email,
        phone: user.phone,
        firstName: profile.first_name,
        lastName: profile.last_name,
      };
    } catch (error) {
      this.logger.error(`❌ JWT validation error:`, error);
      throw new UnauthorizedException('Invalid token');
    }
  }
}


