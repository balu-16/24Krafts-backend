import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Try default JWT strategy first
    const attempt = super.canActivate(context);
    // Handle promise case to attempt Supabase fallback on failure
    if (attempt instanceof Promise) {
      return attempt.catch(async (err) => {
        // Fallback: attempt to validate Supabase access token
        const request = context.switchToHttp().getRequest();
        const authHeader: string | undefined = request.headers['authorization'] as string | undefined;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring('Bearer '.length) : undefined;
        if (!token) {
          throw err || new UnauthorizedException('Invalid or expired token');
        }

        const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
        if (!supabaseUrl) {
          throw err || new UnauthorizedException('Invalid or expired token');
        }

        try {
          // Validate token with Supabase Auth endpoint
          const resp = await axios.get(`${supabaseUrl}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const supUser = resp.data;

          // Map Supabase user to our domain user via Supabase tables
          const admin = this.supabaseService.getAdminClient();
          const { data: user, error: userError } = await admin
            .from('users')
            .select('*, profiles(*)')
            .eq('id', supUser.id)
            .single();

          if (userError || !user) {
            throw new UnauthorizedException('User not found');
          }

          const profile = Array.isArray(user.profiles) ? (user.profiles[0] || null) : user.profiles;
          if (!profile) {
            throw new UnauthorizedException('User profile not found');
          }

          // Attach user to request for downstream handlers
          request.user = {
            id: user.id,
            profileId: profile.id,
            userId: profile.user_id,
            role: profile.role,
            email: user.email,
            phone: user.phone,
            firstName: profile.first_name,
            lastName: profile.last_name,
          };

          return true;
        } catch (fallbackErr) {
          throw err || new UnauthorizedException('Invalid or expired token');
        }
      });
    }
    return attempt;
  }

  handleRequest(err: any, user: any, info: any) {
    // You can throw an exception based on either "info" or "err" arguments
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
