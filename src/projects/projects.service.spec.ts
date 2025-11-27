import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let supabaseService: SupabaseService;

  const mockSupabaseService = {
    getAdminClient: jest.fn(() => ({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      const createdBy = 'profile-123';
      const createDto = {
        title: 'Test Project',
        description: 'A test project',
        start_date: '2025-11-01',
        end_date: '2026-02-28',
      };

      const mockProject = {
        id: 'project-123',
        ...createDto,
        created_by: createdBy,
        created_at: new Date().toISOString(),
      };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single.mockResolvedValueOnce({
        data: mockProject,
        error: null,
      });

      const result = await service.createProject(createdBy, createDto);

      expect(result).toEqual(mockProject);
    });
  });

  describe('addMember', () => {
    it('should add a member to a project', async () => {
      const projectId = 'project-123';
      const addMemberDto = {
        profile_id: 'profile-456',
        role_in_project: 'Lead Actor',
      };

      const mockMember = {
        project_id: projectId,
        profile_id: addMemberDto.profile_id,
        role_in_project: addMemberDto.role_in_project,
        joined_at: new Date().toISOString(),
      };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single.mockResolvedValueOnce({ data: mockMember, error: null });

      const result = await service.addMember(projectId, addMemberDto);

      expect(result).toEqual(mockMember);
    });
  });
});

