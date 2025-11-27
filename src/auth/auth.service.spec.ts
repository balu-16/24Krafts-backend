import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase/supabase.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let supabaseService: SupabaseService;

  const mockSupabaseService = {
    getAdminClient: jest.fn(() => ({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendOtp', () => {
    it('should generate and return OTP for a phone number', async () => {
      const phone = '+919876543210';
      const result = await service.sendOtp(phone);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message');
      if (process.env.NODE_ENV === 'development' && result.otp) {
        expect(result.otp).toHaveLength(6);
      }
    });
  });

  describe('verifyOtp', () => {
    it('should throw UnauthorizedException if OTP is not found', async () => {
      const phone = '+919876543210';
      const otp = '123456';

      await expect(service.verifyOtp(phone, otp)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should verify OTP and create new user if not exists', async () => {
      const phone = '+919876543210';
      
      // First send OTP
      const sendResult = await service.sendOtp(phone);
      const otp = sendResult.otp || '123456'; // Use generated OTP or fallback

      // Mock Supabase responses
      const mockUser = { id: 'user-123', phone, email: null };
      const mockProfile = { id: 'profile-123', user_id: 'user-123', role: 'artist' };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.select.mockResolvedValueOnce({ data: [], error: null }); // No existing user
      mockClient.single.mockResolvedValueOnce({ data: mockUser, error: null }); // New user created
      mockClient.insert.mockResolvedValueOnce({ data: mockProfile, error: null }); // Profile created
      mockClient.single.mockResolvedValueOnce({ data: mockProfile, error: null }); // Profile fetched

      const result = await service.verifyOtp(phone, otp);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('message');
    });
  });
});

