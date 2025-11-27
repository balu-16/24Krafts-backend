import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * SessionGuard validates `Authorization: Session <session_id>` headers.
 * If the session is valid, it populates `request.user` with user and profile info
 * to support controller decorators like `@CurrentUser()` and `@CurrentProfile()`.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'] as string | undefined;

    if (!authHeader || !authHeader.startsWith('Session ')) {
      throw new UnauthorizedException('Missing or invalid session header');
    }

    const sessionId = authHeader.substring('Session '.length).trim();
    if (!sessionId) {
      throw new UnauthorizedException('Invalid session');
    }

    const admin = this.supabaseService.getAdminClient();

    // Validate session
    const { data: session, error: sessionError } = await admin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('valid', true)
      .maybeSingle();

    if (sessionError || !session) {
      throw new UnauthorizedException('Session invalid or not found');
    }

    // Update last_used timestamp (best-effort)
    try {
      await admin
        .from('sessions')
        .update({ last_used: new Date().toISOString() })
        .eq('id', sessionId);
    } catch {
      // ignore
    }

    // Load user and profile with role
    const { data: user, error: userError } = await admin
      .from('users')
      .select('*, profiles(*)')
      .eq('id', session.user_id)
      .maybeSingle();

    if (userError || !user) {
      throw new UnauthorizedException('User not found for session');
    }

    const profile = user.profiles || null;

    // Populate request.user similar to JwtAuthGuard for compatibility
    request.user = {
      id: user.id,
      userId: user.id,
      email: user.email,
      phone: user.phone,
      profileId: profile?.id,
      role: profile?.role,
      firstName: profile?.first_name,
      lastName: profile?.last_name,
    };

    return true;
  }
}