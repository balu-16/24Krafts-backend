import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PhotoService } from './photo.service';
import { SupabaseService } from '../supabase/supabase.service';
import sharp from 'sharp';

describe('PhotoService', () => {
  let service: PhotoService;
  let supabaseService: SupabaseService;
  let mockSupabaseClient: any;

  beforeEach(async () => {
    mockSupabaseClient = {
      storage: {
        from: jest.fn().mockReturnThis(),
        upload: jest.fn(),
        getPublicUrl: jest.fn(),
        remove: jest.fn(),
      },
    };

    const mockSupabaseService = {
      getAdminClient: jest.fn().mockReturnValue(mockSupabaseClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotoService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<PhotoService>(PhotoService);
    supabaseService = module.get<SupabaseService>(SupabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadBufferToBucket', () => {
    it('should upload buffer and return public URL', async () => {
      const buffer = Buffer.from('test image data');
      const destPath = 'test/image.jpg';
      const publicUrl = 'https://example.com/test/image.jpg';

      mockSupabaseClient.storage.upload = jest.fn().mockResolvedValue({
        data: { path: destPath },
        error: null,
      });

      mockSupabaseClient.storage.getPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl },
      });

      const result = await service.uploadBufferToBucket(
        buffer,
        destPath,
        'image/jpeg',
      );

      expect(result).toBe(publicUrl);
      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('photos');
      expect(mockSupabaseClient.storage.upload).toHaveBeenCalledWith(
        destPath,
        buffer,
        {
          contentType: 'image/jpeg',
          upsert: true,
        },
      );
    });

    it('should throw error if upload fails', async () => {
      const buffer = Buffer.from('test');
      mockSupabaseClient.storage.upload = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' },
      });

      await expect(
        service.uploadBufferToBucket(buffer, 'test/path.jpg', 'image/jpeg'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if file size exceeds limit', async () => {
      const largeBuffer = Buffer.alloc(7 * 1024 * 1024); // 7MB
      await expect(
        service.uploadBufferToBucket(
          largeBuffer,
          'test/path.jpg',
          'image/jpeg',
        ),
      ).rejects.toThrow('Image size exceeds 6MB limit');
    });
  });

  describe('processAndUploadImage', () => {
    it('should process and upload image', async () => {
      const mockFile = {
        buffer: Buffer.from('fake image data'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const publicUrl = 'https://example.com/test/image.jpg';

      // Mock sharp processing
      jest.spyOn(sharp.prototype, 'resize').mockReturnThis();
      jest.spyOn(sharp.prototype, 'jpeg').mockReturnThis();
      jest
        .spyOn(sharp.prototype, 'toBuffer')
        .mockResolvedValue(Buffer.from('processed'));

      mockSupabaseClient.storage.upload = jest.fn().mockResolvedValue({
        data: { path: 'test/path.jpg' },
        error: null,
      });

      mockSupabaseClient.storage.getPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl },
      });

      const result = await service.processAndUploadImage(
        mockFile,
        'test/path.jpg',
      );

      expect(result).toBe(publicUrl);
    });

    it('should reject invalid file types', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;

      await expect(
        service.processAndUploadImage(mockFile, 'test/path.txt'),
      ).rejects.toThrow('Invalid file type');
    });
  });

  describe('uploadProfilePhoto', () => {
    it('should upload profile photo with correct path', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'avatar.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const userId = 'user-123';
      const publicUrl = 'https://example.com/profiles/user-123/avatar.jpg';

      jest.spyOn(service, 'processAndUploadImage').mockResolvedValue(publicUrl);

      const result = await service.uploadProfilePhoto(mockFile, userId);

      expect(result).toBe(publicUrl);
      expect(service.processAndUploadImage).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining(`profiles/${userId}/`),
      );
    });
  });

  describe('uploadPostImage', () => {
    it('should upload post image with correct path', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'post.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const postId = 'post-123';
      const publicUrl = 'https://example.com/posts/post-123/post.jpg';

      jest.spyOn(service, 'processAndUploadImage').mockResolvedValue(publicUrl);

      const result = await service.uploadPostImage(mockFile, postId);

      expect(result).toBe(publicUrl);
      expect(service.processAndUploadImage).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining(`posts/${postId}/`),
      );
    });
  });

  describe('uploadPostImageFromBase64', () => {
    it('should process base64 and upload', async () => {
      const base64Data = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      const postId = 'post-123';
      const publicUrl = 'https://example.com/posts/post-123/image.jpg';

      jest
        .spyOn(service, 'uploadBufferToBucket')
        .mockResolvedValue(publicUrl);
      jest.spyOn(sharp.prototype, 'resize').mockReturnThis();
      jest.spyOn(sharp.prototype, 'jpeg').mockReturnThis();
      jest
        .spyOn(sharp.prototype, 'toBuffer')
        .mockResolvedValue(Buffer.from('processed'));

      const result = await service.uploadPostImageFromBase64(base64Data, postId);

      expect(result).toBe(publicUrl);
    });

    it('should handle base64 without data URI prefix', async () => {
      const base64Data = '/9j/4AAQSkZJRg==';
      const postId = 'post-123';

      jest.spyOn(service, 'uploadBufferToBucket').mockResolvedValue('url');
      jest.spyOn(sharp.prototype, 'resize').mockReturnThis();
      jest.spyOn(sharp.prototype, 'jpeg').mockReturnThis();
      jest
        .spyOn(sharp.prototype, 'toBuffer')
        .mockResolvedValue(Buffer.from('processed'));

      await service.uploadPostImageFromBase64(base64Data, postId);

      expect(service.uploadBufferToBucket).toHaveBeenCalled();
    });

    it('should throw error for invalid base64', async () => {
      const invalidBase64 = 'not valid base64!!!';
      const postId = 'post-123';

      await expect(
        service.uploadPostImageFromBase64(invalidBase64, postId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteImage', () => {
    it('should delete image from storage', async () => {
      const path = 'test/image.jpg';

      mockSupabaseClient.storage.remove = jest.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      await service.deleteImage(path);

      expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith('photos');
      expect(mockSupabaseClient.storage.remove).toHaveBeenCalledWith([path]);
    });

    it('should throw error if delete fails', async () => {
      const path = 'test/image.jpg';

      mockSupabaseClient.storage.remove = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      await expect(service.deleteImage(path)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
