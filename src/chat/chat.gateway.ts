import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Throttle } from '@nestjs/throttler';

// WS payloads
interface JoinPayload {
  conversationId: string;
}
interface LeavePayload {
  conversationId: string;
}
interface SendMessagePayload {
  conversationId: string;
  clientMsgId: string;
  content: string;
  metadata?: Record<string, unknown>;
}
interface MarkReadPayload {
  conversationId: string;
  lastMessageId: number;
}
interface TypingPayload {
  conversationId: string;
  isTyping: boolean;
}

// Socket data types
interface AuthenticatedUser {
  userId: string;
  profileId: string;
}

interface SocketData {
  user?: AuthenticatedUser;
  userToken?: string;
}

@WebSocketGateway({ cors: true, namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
  ) {}

  private async authenticate(client: Socket): Promise<AuthenticatedUser | null> {
    // Prefer token via auth; fallback to Authorization header
    const token = (client.handshake.auth as { token?: string })?.token || client.handshake.headers['authorization']?.toString().replace('Bearer ', '');
    if (!token) return null;

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    try {
      const resp = await axios.get(`${supabaseUrl}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const supUser = resp.data;
      // Stash user token for user-scoped RLS operations
      (client.data as SocketData).userToken = token;
      // Map to local user profile via Supabase tables
      const admin = this.chatService['supabaseService'].getAdminClient();
      const { data: user, error: userError } = await admin
        .from('users')
        .select('*, profiles(*)')
        .eq('id', supUser.id)
        .single();
      if (userError || !user) return null;
      const profile = Array.isArray(user.profiles) ? (user.profiles[0] || null) : user.profiles;
      if (!profile) return null;
      return { userId: user.id, profileId: profile.id };
    } catch (_) {
      return null;
    }
  }

  async handleConnection(client: Socket) {
    const authUser = await this.authenticate(client);
    if (!authUser) {
      client.emit('error', { code: 'unauthorized', message: 'Invalid or expired token' });
      client.disconnect(true);
      return;
    }
    (client.data as SocketData).user = authUser;
  }

  async handleDisconnect(client: Socket) {
    // Optional: update presence offline
  }

  @SubscribeMessage('join_conversation')
  async onJoinConversation(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinPayload) {
    const { conversationId } = payload || {};
    const user = (client.data as SocketData).user;
    if (!user || !conversationId) return client.emit('error', { code: 'bad_request', message: 'Missing fields' });

    // Verify membership
    const userClient = this.chatService['supabaseService'].getUserClient((client.data as SocketData)?.userToken);
    const { data: membership } = await userClient
      .from('conversation_members')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('profile_id', user.profileId)
      .maybeSingle();
    if (!membership) return client.emit('error', { code: 'forbidden', message: 'Not a member of this conversation' });

    await client.join(`room:${conversationId}`);
  }

  @SubscribeMessage('leave_conversation')
  async onLeaveConversation(@ConnectedSocket() client: Socket, @MessageBody() payload: LeavePayload) {
    const { conversationId } = payload || {};
    if (!conversationId) return;
    await client.leave(`room:${conversationId}`);
  }

  @SubscribeMessage('send_message')
  @Throttle({ default: { limit: 10, ttl: 1000 } })
  async onSendMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: SendMessagePayload) {
    const { conversationId, clientMsgId, content, metadata } = payload || {} as SendMessagePayload;
    const user = (client.data as SocketData).user;
    if (!user || !conversationId || !clientMsgId || !content) {
      return client.emit('error', { code: 'bad_request', message: 'Missing fields' });
    }
    // Persist message (idempotent via unique constraint on client_msg_id)
    const msg = await this.chatService.sendMessage(
      conversationId,
      user.profileId,
      { content, metadata, client_msg_id: clientMsgId } as any,
      (client.data as SocketData)?.userToken,
    );
    // Broadcast message to conversation room
    this.server.to(`room:${conversationId}`).emit('message', {
      messageId: msg.id,
      conversationId,
      senderId: msg.sender_profile_id,
      content: msg.content,
      createdAt: msg.created_at,
    });
    // ACK to sender
    client.emit('message_ack', { clientMsgId, messageId: msg.id, createdAt: msg.created_at });
  }

  @SubscribeMessage('mark_read')
  async onMarkRead(@ConnectedSocket() client: Socket, @MessageBody() payload: MarkReadPayload) {
    const { conversationId, lastMessageId } = payload || {} as MarkReadPayload;
    const user = (client.data as SocketData).user;
    if (!user || !conversationId || !lastMessageId) {
      return client.emit('error', { code: 'bad_request', message: 'Missing fields' });
    }
    // Update receipts up to lastMessageId
    const userClient = this.chatService['supabaseService'].getUserClient((client.data as SocketData)?.userToken);
    const { error: rpcError } = await userClient.rpc('mark_messages_read_up_to', {
      p_conversation_id: conversationId,
      p_profile_id: user.profileId,
      p_last_message_id: lastMessageId,
    });
    if (rpcError) {
      // Fallback: update messages with id <= lastMessageId
      const { data: toUpdate } = await userClient
        .from('messages')
        .select('id, read_by')
        .eq('conversation_id', conversationId)
        .lte('id', lastMessageId);
      for (const m of toUpdate || []) {
        const readBy = Array.isArray(m.read_by) ? m.read_by : [];
        if (!readBy.includes(user.profileId)) {
          await userClient
            .from('messages')
            .update({ read_by: [...readBy, user.profileId] })
            .eq('id', m.id);
          this.server
            .to(`room:${conversationId}`)
            .emit('receipt_update', { messageId: m.id, status: 'read' });
        }
      }
    }
  }

  @SubscribeMessage('typing')
  async onTyping(@ConnectedSocket() client: Socket, @MessageBody() payload: TypingPayload) {
    const { conversationId, isTyping } = payload || {} as TypingPayload;
    const user = (client.data as SocketData).user;
    if (!user || !conversationId || typeof isTyping !== 'boolean') {
      return client.emit('error', { code: 'bad_request', message: 'Missing fields' });
    }
    await this.chatService.updateTyping(conversationId, user.profileId, !!isTyping, (client.data as SocketData)?.userToken);
    this.server.to(`room:${conversationId}`).emit('user_typing', { conversationId, userId: user.profileId, isTyping: !!isTyping });
  }
}