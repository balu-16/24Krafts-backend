import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateConversationDto,
  SendMessageDto,
  ListConversationsQuery,
  ListMessagesQuery,
} from './dto/chat.dto';
import { encodeCursor, decodeCursor, PaginatedResponse } from '../utils/cursor.util';
import { getCurrentIST } from '../utils/time.utils';

@Injectable()
export class ChatService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listConversations(
    query: ListConversationsQuery,
    accessToken?: string,
  ): Promise<PaginatedResponse<any>> {
    const { profileId, cursor, limit = 20 } = query;
    // Prefer user-scoped client when token is provided; otherwise fall back
    const supabase = accessToken
      ? this.supabaseService.getUserClient(accessToken)
      : (this.supabaseService.getServiceRoleClient?.() || this.supabaseService.getAdminClient());

    // Get conversations where profile is a member
    let queryBuilder = supabase
      .from('conversation_members')
      .select(`
        conversation_id,
        joined_at,
        conversations!inner(*)
      `)
      .eq('profile_id', profileId)
      .order('joined_at', { ascending: false })
      .limit(limit + 1);

    // Apply cursor if provided
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        queryBuilder = queryBuilder.lt('joined_at', decoded.timestamp);
      }
    }

    const { data, error } = await queryBuilder;

    if (error) {
      // Gracefully degrade to an empty list instead of 500
      return {
        data: [],
        nextCursor: null,
      };
    }

    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;

    // Get last message for each conversation
    const conversations = await Promise.all(
      items.map(async (item: any) => {
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', item.conversation_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get unread count
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', item.conversation_id)
          .not('sender_profile_id', 'eq', profileId)
          .not('read_by', 'cs', `["${profileId}"]`);

        return {
          ...item.conversations,
          last_message: lastMessage,
          unread_count: unreadCount || 0,
        };
      }),
    );

    const nextCursor = hasMore
      ? encodeCursor(data[limit - 1].joined_at, data[limit - 1].conversation_id)
      : null;

    return {
      data: conversations,
      nextCursor,
    };
  }

  async getConversationById(id: string, accessToken?: string) {
    const supabase = accessToken
      ? this.supabaseService.getUserClient(accessToken)
      : (this.supabaseService.getServiceRoleClient?.() || this.supabaseService.getAdminClient());

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        conversation_members(
          profile_id,
          is_admin,
          profiles(id, first_name, last_name, profile_photo_url)
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Conversation not found');
    }

    return data;
  }

  async createConversation(
    createdBy: string,
    createConversationDto: CreateConversationDto,
    accessToken?: string,
  ) {
    let client = accessToken
      ? this.supabaseService.getUserClient(accessToken)
      : (this.supabaseService.getServiceRoleClient?.() || this.supabaseService.getAdminClient());

    let conversation;
    let convError;

    {
      const result = await client
        .from('conversations')
        .insert({
          is_group: createConversationDto.is_group || false,
          name: createConversationDto.name,
          created_by: createdBy,
        })
        .select()
        .single();
      conversation = result.data;
      convError = result.error;
    }

    if (convError) {
      client = this.supabaseService.getServiceRoleClient();
      const retry = await client
        .from('conversations')
        .insert({
          is_group: createConversationDto.is_group || false,
          name: createConversationDto.name,
          created_by: createdBy,
        })
        .select()
        .single();
      conversation = retry.data;
      convError = retry.error;
    }

    if (!conversation || convError) {
      throw new ForbiddenException('Failed to create conversation');
    }

    const members = createConversationDto.member_ids.map((profileId) => ({
      conversation_id: conversation.id,
      profile_id: profileId,
      is_admin: profileId === createdBy,
    }));

    const { error: membersError } = await client
      .from('conversation_members')
      .insert(members);

    if (membersError) {
      throw new ForbiddenException('Failed to add conversation members');
    }

    return conversation;
  }

  async getMessages(
    conversationId: string,
    query: ListMessagesQuery,
    accessToken?: string,
  ): Promise<PaginatedResponse<any>> {
    const { cursor, limit = 40 } = query;
    const supabase = accessToken
      ? this.supabaseService.getUserClient(accessToken)
      : (this.supabaseService.getServiceRoleClient?.() || this.supabaseService.getAdminClient());

    let queryBuilder = supabase
      .from('messages')
      .select(`
        *,
        profiles!sender_profile_id(id, first_name, last_name, profile_photo_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    // Apply cursor if provided (for loading older messages)
    if (cursor) {
      const decoded = decodeCursor(cursor);
      if (decoded) {
        queryBuilder = queryBuilder.lt('created_at', decoded.timestamp);
      }
    }

    const { data, error } = await queryBuilder;

    if (error) {
      throw new Error('Failed to fetch messages');
    }

    const hasMore = data.length > limit;
    const messages = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore
      ? encodeCursor(data[limit - 1].created_at, data[limit - 1].id.toString())
      : null;

    return {
      data: messages.reverse(), // Return in ascending order for display
      nextCursor,
    };
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    sendMessageDto: SendMessageDto & { client_msg_id?: string },
    accessToken?: string,
  ) {
    const supabase = accessToken
      ? this.supabaseService.getUserClient(accessToken)
      : (this.supabaseService.getServiceRoleClient?.() || this.supabaseService.getAdminClient());

    // Verify sender is a member of the conversation
    const { data: membership } = await supabase
      .from('conversation_members')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('profile_id', senderId)
      .single();

    if (!membership) {
      throw new ForbiddenException('User is not a member of this conversation');
    }

    // Insert message
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_profile_id: senderId,
        content: sendMessageDto.content,
        metadata: sendMessageDto.metadata || null,
        client_msg_id: sendMessageDto.client_msg_id || null,
        delivered: true,
      })
      .select(`
        *,
        profiles!sender_profile_id(id, first_name, last_name, profile_photo_url)
      `)
      .single();

    if (error) {
      throw new Error('Failed to send message');
    }

    // Supabase Realtime will broadcast this insert to subscribed clients
    return data;
  }

  async updateTyping(conversationId: string, profileId: string, isTyping: boolean, accessToken?: string) {
    const supabase = accessToken
      ? this.supabaseService.getUserClient(accessToken)
      : (this.supabaseService.getServiceRoleClient?.() || this.supabaseService.getAdminClient());

    // Upsert presence
    const { data, error } = await supabase
      .from('presence')
      .upsert(
        {
          conversation_id: conversationId,
          profile_id: profileId,
          is_typing: isTyping,
          last_seen_at: getCurrentIST(),
        },
        {
          onConflict: 'conversation_id,profile_id',
        },
      )
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update typing status');
    }

    return data;
  }

  async updatePresence(conversationId: string, profileId: string, accessToken?: string) {
    const supabase = accessToken
      ? this.supabaseService.getUserClient(accessToken)
      : (this.supabaseService.getServiceRoleClient?.() || this.supabaseService.getAdminClient());

    // Upsert presence
    const { data, error } = await supabase
      .from('presence')
      .upsert(
        {
          conversation_id: conversationId,
          profile_id: profileId,
          last_seen_at: getCurrentIST(),
          is_typing: false,
        },
        {
          onConflict: 'conversation_id,profile_id',
        },
      )
      .select()
      .single();

    if (error) {
      throw new Error('Failed to update presence');
    }

    return data;
  }
}

