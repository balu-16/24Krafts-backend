import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../supabase/supabase.service';
import { SaveTokenDto } from './dto/save-token.dto';
import { RevokeTokenDto } from './dto/revoke-token.dto';
import { SendPushDto } from './dto/send.dto';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: any;
  sound?: string | null;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async saveToken(userId: string, dto: SaveTokenDto) {
    const admin = this.supabaseService.getServiceRoleClient?.() || this.supabaseService.getAdminClient();
    const now = new Date().toISOString();
    const payload = {
      user_id: userId,
      token: dto.token,
      platform: dto.platform,
      device_name: dto.device_name || null,
      app_version: dto.app_version || null,
      os_version: dto.os_version || null,
      timezone: dto.timezone || null,
      last_seen_at: now,
      revoked: false,
      created_at: now,
    };
    this.logger.log(`🔐 Saving push token for user ${userId} on ${dto.platform}`);
    const { data, error } = await admin
      .from('expo_push_tokens')
      .upsert(payload, { onConflict: 'user_id,token' })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async revokeToken(userId: string, dto: RevokeTokenDto) {
    const admin = this.supabaseService.getServiceRoleClient?.() || this.supabaseService.getAdminClient();
    this.logger.log(`🚫 Revoking push token for user ${userId}`);
    const { data, error } = await admin
      .from('expo_push_tokens')
      .update({ revoked: true })
      .eq('user_id', userId)
      .eq('token', dto.token)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  async listDevices(userId: string) {
    const admin = this.supabaseService.getServiceRoleClient?.() || this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('expo_push_tokens')
      .select('id, token, platform, device_name, app_version, os_version, timezone, last_seen_at, created_at, revoked')
      .eq('user_id', userId)
      .eq('revoked', false)
      .order('last_seen_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async send(dto: SendPushDto) {
    const messages: ExpoPushMessage[] = dto.tokens.map((token) => ({
      to: token,
      title: dto.title,
      body: dto.body,
      data: dto.data || {},
      sound: 'default',
    }));

    const BATCH_SIZE = 100;
    const results: any[] = [];
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      try {
        const resp = await axios.post('https://exp.host/--/api/v2/push/send', batch, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
        });
        const data = resp.data?.data || [];
        results.push(...data);
        await this.handleExpoResponses(data);
      } catch (err: any) {
        this.logger.error('Expo push batch failed', err?.message || err);
      }
    }
    return { status: 'ok', results };
  }

  private async handleExpoResponses(responses: any[]) {
    const admin = this.supabaseService.getServiceRoleClient?.() || this.supabaseService.getAdminClient();
    for (const res of responses) {
      if (res?.status === 'error') {
        const token = res?.to;
        const error = res?.details?.error || res?.message;
        // Mark invalid tokens revoked
        if (token && this.isInvalidTokenError(error)) {
          this.logger.warn(`Revoking invalid token: ${token} (${error})`);
          await admin
            .from('expo_push_tokens')
            .update({ revoked: true })
            .eq('token', token);
        }
      }
    }
  }

  private isInvalidTokenError(error?: string): boolean {
    if (!error) return false;
    const invalidMarkers = ['DeviceNotRegistered', 'MessageRateExceeded', 'InvalidCredentials', 'NotRegistered', 'invalid token'];
    return invalidMarkers.some((m) => error.includes(m));
  }
}