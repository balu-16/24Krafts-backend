import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ForbiddenException } from '@nestjs/common';

describe('ChatService', () => {
  let service: ChatService;
  let supabaseService: SupabaseService;

  const mockSupabaseService = {
    getAdminClient: jest.fn(() => ({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      cs: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createConversation', () => {
    it('should create a new conversation with members', async () => {
      const createdBy = 'profile-123';
      const createDto = {
        is_group: false,
        name: undefined,
        member_ids: ['profile-123', 'profile-456'],
      };

      const mockConversation = {
        id: 'conv-123',
        is_group: false,
        name: null,
        created_by: createdBy,
      };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single.mockResolvedValueOnce({
        data: mockConversation,
        error: null,
      });
      mockClient.insert.mockResolvedValueOnce({ error: null });

      const result = await service.createConversation(createdBy, createDto);

      expect(result).toEqual(mockConversation);
    });
  });

  describe('sendMessage', () => {
    it('should throw ForbiddenException if sender is not a member', async () => {
      const conversationId = 'conv-123';
      const senderId = 'profile-999';
      const messageDto = { content: 'Hello' };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        service.sendMessage(conversationId, senderId, messageDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should send message successfully if sender is a member', async () => {
      const conversationId = 'conv-123';
      const senderId = 'profile-123';
      const messageDto = { content: 'Hello', metadata: null };

      const mockMembership = {
        conversation_id: conversationId,
        profile_id: senderId,
      };

      const mockMessage = {
        id: 1,
        conversation_id: conversationId,
        sender_profile_id: senderId,
        content: 'Hello',
        created_at: new Date().toISOString(),
      };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single
        .mockResolvedValueOnce({ data: mockMembership, error: null })
        .mockResolvedValueOnce({ data: mockMessage, error: null });

      const result = await service.sendMessage(
        conversationId,
        senderId,
        messageDto,
      );

      expect(result).toEqual(mockMessage);
    });
  });

  describe('updateTyping', () => {
    it('should update typing status', async () => {
      const conversationId = 'conv-123';
      const profileId = 'profile-123';
      const isTyping = true;

      const mockPresence = {
        conversation_id: conversationId,
        profile_id: profileId,
        is_typing: isTyping,
        last_seen_at: expect.any(String),
      };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single.mockResolvedValueOnce({
        data: mockPresence,
        error: null,
      });

      const result = await service.updateTyping(
        conversationId,
        profileId,
        isTyping,
      );

      expect(result).toMatchObject({
        conversation_id: conversationId,
        profile_id: profileId,
        is_typing: isTyping,
      });
    });
  });
});

