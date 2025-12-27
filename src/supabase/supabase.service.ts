import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabaseAdmin: SupabaseClient;
  private supabaseServiceRole?: SupabaseClient;
  private supabaseUrl!: string;
  private supabaseAnonKey!: string;

  constructor(private readonly configService: ConfigService) { }

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'SUPABASE_URL and SUPABASE_ANON_KEY must be defined in environment variables'
      );
    }

    this.supabaseUrl = supabaseUrl;
    this.supabaseAnonKey = supabaseAnonKey;

    this.supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    if (supabaseServiceRoleKey) {
      this.supabaseServiceRole = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
  }

  getAdminClient(): SupabaseClient {
    if (!this.supabaseAdmin) {
      throw new Error('Supabase client not initialized');
    }
    return this.supabaseAdmin;
  }

  getServiceRoleClient(): SupabaseClient {
    if (this.supabaseServiceRole) {
      return this.supabaseServiceRole;
    }
    // Fallback for development: use admin (anon) client to avoid crashes
    // Note: Without service role, RLS may block some operations.
    console.warn('[SupabaseService] Service role key missing. Falling back to anon client.');
    return this.getAdminClient();
  }

  /**
   * Returns a Supabase client that uses the provided Supabase access token,
   * enabling RLS-authenticated operations without requiring the service role.
   */
  getUserClient(accessToken?: string): SupabaseClient {
    if (!accessToken) {
      return this.getAdminClient();
    }
    return createClient(this.supabaseUrl, this.supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }
}
