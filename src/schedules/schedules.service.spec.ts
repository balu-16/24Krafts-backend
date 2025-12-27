import { Test, TestingModule } from '@nestjs/testing';
import { SchedulesService } from './schedules.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('SchedulesService', () => {
  let service: SchedulesService;
  let supabaseService: SupabaseService;

  const mockSupabaseService = {
    getAdminClient: jest.fn(() => ({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSchedule', () => {
    it('should create a new schedule', async () => {
      const createdBy = 'profile-123';
      const createDto = {
        project_id: 'project-123',
        title: 'Action Sequence Shoot',
        description: 'High-intensity fight scene',
        date: '2025-11-15',
        start_time: '06:00:00',
        end_time: '18:00:00',
        location: 'Marina Beach',
      };

      const mockSchedule = {
        id: 'schedule-123',
        ...createDto,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single.mockResolvedValueOnce({
        data: mockSchedule,
        error: null,
      });

      const result = await service.createSchedule(createdBy, createDto);

      expect(result).toEqual(mockSchedule);
    });
  });

  describe('updateMemberStatus', () => {
    it('should update member status', async () => {
      const scheduleId = 'schedule-123';
      const profileId = 'profile-123';
      const status = 'accepted';

      const mockMember = {
        schedule_id: scheduleId,
        profile_id: profileId,
        status,
      };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single.mockResolvedValueOnce({ data: mockMember, error: null });

      const result = await service.updateMemberStatus(
        scheduleId,
        profileId,
        status,
      );

      expect(result).toEqual(mockMember);
    });
  });
});

