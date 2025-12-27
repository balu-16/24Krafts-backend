import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import axios from 'axios';

jest.mock('axios');

describe('NotificationsService', () => {
  let service: NotificationsService;
  let supabaseService: SupabaseService;

  const mockDbChain = {
    from: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
  };

  const mockSupabaseService = {
    getServiceRoleClient: jest.fn(() => mockDbChain),
    getAdminClient: jest.fn(() => mockDbChain),
  } as any;

  beforeEach(async () => {
    (axios.post as any).mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('saveToken upserts token with metadata', async () => {
    mockDbChain.single.mockResolvedValueOnce({ data: { id: 'uuid', token: 'ExpoPushToken[abc]' } });
    const result = await service.saveToken('user-123', { token: 'ExpoPushToken[abc]', platform: 'android' });
    expect(mockDbChain.from).toHaveBeenCalledWith('expo_push_tokens');
    expect(mockDbChain.upsert).toHaveBeenCalled();
    expect(result.token).toBe('ExpoPushToken[abc]');
  });

  it('send batches to Expo and revokes invalid tokens', async () => {
    (axios.post as any).mockResolvedValueOnce({
      data: {
        data: [
          { status: 'ok', to: 'ExpoPushToken[valid]' },
          { status: 'error', to: 'ExpoPushToken[invalid]', details: { error: 'DeviceNotRegistered' } },
        ],
      },
    });
    await service.send({ tokens: ['ExpoPushToken[valid]', 'ExpoPushToken[invalid]'], title: 'Hello', body: 'World' });
    expect(axios.post).toHaveBeenCalled();
    expect(mockDbChain.update).toHaveBeenCalledWith({ revoked: true });
    expect(mockDbChain.eq).toHaveBeenCalledWith('token', 'ExpoPushToken[invalid]');
  });
});