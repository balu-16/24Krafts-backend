import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('PostsService', () => {
  let service: PostsService;
  let supabaseService: SupabaseService;

  const mockSupabaseService = {
    getAdminClient: jest.fn(() => ({
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPost', () => {
    it('should create a new post', async () => {
      const profileId = 'profile-123';
      const createDto = {
        title: 'Test Project',
        description: 'Test project description',
        caption: 'Test post',
        image: 'iVBORw0KGgoAAAANSUhEUgAA...',
      };

      const mockProfile = {
        id: profileId,
        role: 'recruiter',
      };

      const mockPost = {
        id: 'post-123',
        author_profile_id: profileId,
        title: createDto.title,
        description: createDto.description,
        caption: createDto.caption,
        image: createDto.image,
        created_at: new Date().toISOString(),
      };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single.mockResolvedValueOnce({ data: mockProfile, error: null }); // Profile check
      mockClient.single.mockResolvedValueOnce({ data: mockPost, error: null }); // Post creation

      const result = await service.createPost(profileId, createDto);

      expect(result).toEqual(mockPost);
    });
  });

  describe('toggleLike', () => {
    it('should like a post if not already liked', async () => {
      const postId = 'post-123';
      const profileId = 'profile-123';

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single.mockResolvedValueOnce({ data: null, error: null }); // No existing like
      mockClient.insert.mockResolvedValueOnce({ error: null });

      const result = await service.toggleLike(postId, profileId);

      expect(result).toEqual({ liked: true });
    });

    it('should unlike a post if already liked', async () => {
      const postId = 'post-123';
      const profileId = 'profile-123';

      const mockLike = { post_id: postId, profile_id: profileId };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single.mockResolvedValueOnce({ data: mockLike, error: null });
      mockClient.delete.mockResolvedValueOnce({ error: null });

      const result = await service.toggleLike(postId, profileId);

      expect(result).toEqual({ liked: false });
    });
  });

  describe('addComment', () => {
    it('should add a comment to a post', async () => {
      const postId = 'post-123';
      const profileId = 'profile-123';
      const content = 'Great post!';

      const mockComment = {
        id: 'comment-123',
        post_id: postId,
        author_profile_id: profileId,
        content,
        created_at: new Date().toISOString(),
      };

      const mockClient = supabaseService.getAdminClient() as any;
      mockClient.single.mockResolvedValueOnce({
        data: mockComment,
        error: null,
      });

      const result = await service.addComment(postId, profileId, content);

      expect(result).toEqual(mockComment);
    });
  });
});

