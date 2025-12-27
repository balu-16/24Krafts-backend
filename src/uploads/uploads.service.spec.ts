import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from './uploads.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PhotoService } from '../photo/photo.service';

describe('UploadsService', () => {
  let service: UploadsService;
  let photoService: PhotoService;

  beforeEach(async () => {
    const mockPhotoService = {
      uploadProfilePhoto: jest.fn(),
    };

    const mockSupabaseService = {
      getAdminClient: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        {
          provide: PhotoService,
          useValue: mockPhotoService,
        },
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
    photoService = module.get<PhotoService>(PhotoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should delegate to PhotoService and return public URL', async () => {
      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const userId = 'user-123';
      const publicUrl = 'https://example.com/profiles/user-123/test.jpg';

      (photoService.uploadProfilePhoto as jest.Mock).mockResolvedValue(
        publicUrl,
      );

      const result = await service.uploadFile(mockFile, userId);

      expect(result).toEqual({
        success: true,
        publicUrl,
        url: publicUrl,
      });
      expect(photoService.uploadProfilePhoto).toHaveBeenCalledWith(
        mockFile,
        userId,
      );
    });
  });

  describe('processImageToBase64', () => {
    it('should process image and return base64', async () => {
      const mockFile = {
        buffer: Buffer.from('test image data'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      // Mock sharp - in real implementation it processes the image
      const result = await service.processImageToBase64(mockFile);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('image');
      expect(result).toHaveProperty('buffer');
      expect(typeof result.image).toBe('string');
    });
  });
});
